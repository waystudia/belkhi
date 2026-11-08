import {accountDestination, currentAuth, currentIdentity, enableWorkerProfile, setStartingMode, signIn, signOut} from './auth.js';

import {openWorkspaceRoute, replaceWorkspaceRoute} from './workspace-nav.js';

export const demoMode = () => sessionStorage.getItem('belkhi-demo-session') === '1';

export function reloadAt(page) {
  history.replaceState(null, '', '#' + page);
  location.reload();
}

export function accountScreen(page, {show, notice, esc, link, workerEnabled, activeProfile, render}, authError) {
  const root = document.querySelector('#screen');
  const user = currentAuth()?.user;
  const name = user?.user_metadata?.display_name;
  if (page === 'start') {
    show(null, 'С чего начнём?', `<div class="entry-screen">
      <p class="muted">Выберите, что хотите сделать сейчас. Другой режим доступен из настроек аккаунта.</p>
      <form class="starting-modes">
        <button name="mode" value="customer"><span><strong>Стать заказчиком</strong><small>Вы сможете найти специалистов и создать тендер.</small></span><svg aria-hidden="true" viewBox="0 0 16 16"><path d="m6 4 4 4-4 4"/></svg></button>
        <button name="mode" value="worker" data-view-key="choose-worker"><span><strong>Стать исполнителем</strong><small>Смотрите тендеры. Профиль для откликов можно заполнить позже.</small></span><svg aria-hidden="true" viewBox="0 0 16 16"><path d="m6 4 4 4-4 4"/></svg></button>
      </form></div>`, user.user_metadata?.belkhi_starting_mode ? 'account' : '');
    root.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      const mode = event.submitter.value;
      if (mode === 'worker' && !workerEnabled()) {
        openWorkspaceRoute('#activate-worker?start=1', event.submitter);
        return;
      }
      const buttons = [...event.currentTarget.querySelectorAll('button')];
      buttons.forEach(button => button.disabled = true);
      try {
        await setStartingMode(mode);
        location.hash = mode === 'worker' ? 'market' : 'list';
      } catch (error) {
        notice(error.message);
      } finally {
        buttons.forEach(button => button.disabled = false);
      }
    };
    return;
  }
  if (page === 'activate-worker') {
    const params = new URLSearchParams(location.hash.split('?')[1]);
    const tender = params.get('tender');
    const switchMode = params.has('start');
    const returnToTender = tender && /^[a-z0-9-]+$/i.test(tender);
    show(null, 'Стать исполнителем?', `<div class="worker-activation">
      <p>Подключите профиль исполнителя, чтобы добавить работы и откликаться на тендеры.</p>
      <p class="muted">Своими тендерами по-прежнему можно управлять в профиле заказчика.</p>
      <button class="primary wide" type="button" id="confirm-worker">Подтвердить</button>
      <a href="#${returnToTender ? 'apply/' + tender : switchMode ? 'start' : 'account'}" class="back activation-cancel" data-workspace-back>Отмена</a>
    </div>`, returnToTender ? 'apply/' + tender : switchMode ? 'start' : 'account');
    root.querySelector('#confirm-worker').onclick = async event => {
      const button = event.currentTarget;
      const here = location.hash;
      button.disabled = true;
      try {
        await (switchMode ? setStartingMode('worker') : enableWorkerProfile());
        if (location.hash !== here) return;
        const target = switchMode ? '#market' : returnToTender ? '#worker?edit=1&tender=' + tender : '#worker';
        replaceWorkspaceRoute(target);
        await render();
        root.focus({preventScroll: true});
        window.scrollTo(0, 0);
      } catch (error) {
        if (location.hash === here) notice(error.message);
      } finally {
        button.disabled = false;
      }
    };
    return;
  }
  if (page === 'account') {
    const enabled = workerEnabled();
    const username = currentIdentity()?.username;
    show(null, 'Настройки аккаунта', `<div class="account-settings">
      <div class="account-identity"><span class="settings-avatar" aria-hidden="true">${esc((name || username || 'Б').slice(0,1).toUpperCase())}</span>
        <div><strong>${esc(name || (username ? '@' + username : 'Аккаунт Белхи'))}</strong>
        <span class="muted">${esc(user.email || user.phone || '')}</span></div></div>
      <div class="account-links">${link('customer', 'Профиль заказчика', 'btn')}
      <a class="btn" data-view-key="worker-profile-action" href="#${enabled ? 'worker' : 'activate-worker'}">${enabled ? 'Профиль исполнителя' : 'Стать исполнителем'}</a>
      ${enabled ? link('start', 'Выбрать рабочий режим', 'btn') : ''}
      <button type="button" id="account-logout">Выйти</button></div></div>`, activeProfile());
    root.querySelector('#account-logout').onclick = async event => {
      event.currentTarget.disabled = true;
      try { await signOut(); } finally { reloadAt('login'); }
    };
    return;
  }

  const admin = page === 'admin';
  show(null, admin ? 'Вход для администратора' : 'Войти в Белхи', `<div class="entry-screen">
    <p class="muted">${admin ? 'Используйте почту администратора «Белхи».' : 'Строительные тендеры и работа на объектах.'}</p>
    ${authError ? '<p class="account-error" role="alert">' + esc(authError) + '</p>' : ''}
    <form id="account-auth">
      <label>Почта<input name="email" type="email" autocomplete="username" maxlength="254" required></label>
      <label>Пароль<input name="password" type="password" autocomplete="current-password" required></label>
      <p id="auth-feedback" role="status" class="form-note"></p>
      <button class="primary wide">Войти</button>
    </form>
    <div class="entry-links">${admin ? link('login', 'Войти в аккаунт', 'back') : link('signup', 'Создать аккаунт', 'back')}
      ${!admin ? '<button class="demo-link" type="button" id="demo-entry">Демонстрационная версия</button>' : ''}</div>
    </div>`);
  root.querySelector('#demo-entry')?.addEventListener('click', () => {
    sessionStorage.setItem('belkhi-demo-session', '1');
    reloadAt('market');
  });
  root.querySelector('form').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    const feedback = form.querySelector('#auth-feedback');
    const values = new FormData(form);
    button.disabled = true;
    feedback.textContent = '';
    try {
      const email = values.get('email').trim(), password = values.get('password');
      await signIn(email, password);
      sessionStorage.removeItem('belkhi-demo-session');
      reloadAt(admin ? 'admin' : accountDestination());
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}
