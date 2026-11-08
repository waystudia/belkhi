import {
  accountDestination, claimUsername, currentAuth, emailSignupEnabled, sendSignupEmail, setBirthDate,
  setSignupPassword, signOut, usernameAvailable, verifySignupEmail
} from './auth.js';
import {reloadAt} from './account.js';

const emailKey = 'belkhi-registration-email';
const usernamePattern = /^(?=.*[a-z0-9])[a-z0-9._]{3,30}$/;
const normalizeUsername = value => value.trim().replace(/^@/, '').toLowerCase();
const steps = {
  signup: ['Укажите электронную почту', 1],
  'signup-confirm': ['Подтвердите почту', 1],
  'signup-password': ['Создайте пароль', 2],
  'signup-birthday': ['Укажите дату рождения', 3],
  'signup-username': ['Выберите @логин', 4]
};
export const registrationPages = Object.keys(steps);

const today = () => new Intl.DateTimeFormat('sv-SE', {
  year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());

function setFieldStatus(input, feedback, state, message) {
  input.setAttribute('aria-invalid', String(state === 'error'));
  feedback.dataset.state = state;
  feedback.textContent = message;
}

export function registrationScreen(page, {show, esc, link}, authError) {
  const [title, step] = steps[page];
  if (!emailSignupEnabled && ['signup', 'signup-confirm'].includes(page)) {
    show(null, 'Создать аккаунт', `<div class="registration">
      <p class="registration-intro">Подтверждение почты пока недоступно.</p>
      <div class="account-links">${link('login', 'Войти в аккаунт', 'btn')}
      ${link('catalog', 'Посмотреть демокаталог', 'btn')}</div>
    </div>`);
    return;
  }
  const email = sessionStorage.getItem(emailKey) || '';
  if (page === 'signup-confirm' && !email) {
    location.replace('#signup');
    return;
  }

  let intro, field, action, submitLabel = 'Далее', secondary = '';
  const input = attributes => '<input id="registration-field" required aria-describedby="registration-feedback" ' + attributes + '>';
  if (page === 'signup') {
    intro = 'На эту почту придёт письмо для подтверждения. Почта не будет видна в профиле.';
    field = '<label for="registration-field">Электронная почта</label>' +
      input('name="email" type="email" autocomplete="email" maxlength="254" value="' + esc(email) + '"');
    action = async value => {
      await sendSignupEmail(value);
      sessionStorage.setItem(emailKey, value);
      location.hash = 'signup-confirm';
    };
  } else if (page === 'signup-confirm') {
    intro = 'Мы запросили письмо на <strong>' + esc(email) + '</strong>. Введите код из письма или откройте ссылку в этом браузере.';
    field = '<label for="registration-field">Код из письма</label>' +
      input('name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="6 цифр"');
    secondary = '<button class="registration-secondary" type="button" id="registration-resend">Отправить письмо ещё раз</button>';
    action = async value => {
      await verifySignupEmail(email, value);
      reloadAt(accountDestination());
    };
  } else if (page === 'signup-password') {
    intro = 'Минимум 8 символов. С этим паролем вы сможете войти в «Белхи» с другого устройства.';
    field = '<label for="registration-field">Пароль</label><div class="registration-password">' +
      input('name="password" type="password" autocomplete="new-password" minlength="8"') +
      '<button type="button" id="registration-password-toggle" aria-controls="registration-field">Показать</button></div>';
    action = setSignupPassword;
  } else if (page === 'signup-birthday') {
    intro = 'Дата рождения хранится в данных аккаунта и не отображается в публичном профиле.';
    field = '<label for="registration-field">Дата рождения</label>' +
      input('name="birth_date" type="date" autocomplete="bday" min="1900-01-01" max="' + today() + '"');
    action = setBirthDate;
  } else {
    intro = 'По @логину можно будет узнать ваш профиль. Используйте от 3 до 30 символов: латинские буквы, цифры, точку и подчёркивание.';
    field = '<label for="registration-field">Имя пользователя</label><div class="registration-handle"><span aria-hidden="true">@</span>' +
      input('name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="31" placeholder="master_grozny"') + '</div>';
    action = async value => {
      const username = normalizeUsername(value);
      if (!usernamePattern.test(username)) {
        throw new Error('Введите от 3 до 30 символов. Нужна хотя бы одна буква или цифра.');
      }
      await claimUsername(username);
    };
    submitLabel = 'Сохранить @логин';
  }

  const progress = Array.from({length: 4}, (_, index) => '<span' + (index < step ? ' class="filled"' : '') + '></span>').join('');
  show(null, title, `<div class="registration">
    <div class="registration-progress" role="img" aria-label="Шаг ${step} из 4">${progress}</div>
    <p class="registration-intro">${intro}</p>
    ${authError ? '<p class="account-error" role="alert">' + esc(authError) + '</p>' : ''}
    <form id="registration-form">
      ${field}
      <p id="registration-feedback" class="registration-feedback" role="status"></p>
      <button type="submit" class="primary wide">${submitLabel}</button>
      ${secondary}
    </form>
    <div class="registration-footer">
      ${page === 'signup-confirm' ? link('signup', 'Изменить почту', 'back') : ''}
      ${currentAuth() ? '<button type="button" class="demo-link" id="registration-exit">Выйти из аккаунта</button>' : link('login', 'У меня уже есть аккаунт', 'back')}
    </div></div>`);
  const form = document.querySelector('#registration-form');
  const fieldInput = form.querySelector('input');
  const feedback = form.querySelector('#registration-feedback');
  const button = form.querySelector('[type="submit"]');
  const resend = form.querySelector('#registration-resend');
  let busy = false;
  let checkTimer;
  let checkVersion = 0;
  const status = (state, message) => setFieldStatus(fieldInput, feedback, state, message);

  fieldInput.oninput = () => {
    clearTimeout(checkTimer);
    const version = ++checkVersion;
    status('', '');
    if (page !== 'signup-username') return;
    const username = normalizeUsername(fieldInput.value);
    if (!usernamePattern.test(username)) return;
    checkTimer = setTimeout(async () => {
      if (busy || !form.isConnected) return;
      status('', 'Проверяем @логин…');
      try {
        const available = await usernameAvailable(username);
        if (version !== checkVersion || !form.isConnected) return;
        status(available ? 'ok' : 'error', available ? '@логин свободен.' : 'Этот @логин уже занят или недоступен. Выберите другой.');
      } catch {
        if (version === checkVersion && form.isConnected) status('', 'Проверим @логин при сохранении.');
      }
    }, 350);
  };

  form.onsubmit = async event => {
    event.preventDefault();
    if (busy) return;
    const value = page === 'signup-password' ? fieldInput.value : fieldInput.value.trim();
    ++checkVersion;
    clearTimeout(checkTimer);
    busy = button.disabled = fieldInput.disabled = true;
    if (resend) resend.disabled = true;
    status('', page === 'signup' ? 'Отправляем письмо…' : 'Сохраняем…');
    try {
      await action(value);
      if (!form.isConnected || page === 'signup' || page === 'signup-confirm') return;
      const next = accountDestination();
      if (page === 'signup-username') sessionStorage.removeItem(emailKey);
      location.replace('#' + next);
    } catch (error) {
      if (form.isConnected) {
        fieldInput.disabled = false;
        status('error', error.message);
        fieldInput.focus();
      }
    } finally {
      busy = button.disabled = fieldInput.disabled = false;
      if (resend) resend.disabled = false;
    }
  };

  if (resend) resend.onclick = async () => {
    if (busy) return;
    busy = resend.disabled = button.disabled = true;
    status('', 'Отправляем письмо…');
    try {
      await sendSignupEmail(email);
      status('ok', 'Письмо запрошено повторно. Используйте код из последнего письма.');
    } catch (error) {
      status('error', error.message);
    } finally {
      busy = resend.disabled = button.disabled = false;
    }
  };
  const toggle = form.querySelector('#registration-password-toggle');
  if (toggle) toggle.onclick = () => {
    const visible = fieldInput.type === 'password';
    fieldInput.type = visible ? 'text' : 'password';
    toggle.textContent = visible ? 'Скрыть' : 'Показать';
  };
  const exit = document.querySelector('#registration-exit');
  if (exit) exit.onclick = async () => {
    exit.disabled = true;
    try { await signOut(); } finally { reloadAt('login'); }
  };
}
