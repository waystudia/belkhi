// Account administration uses the caller's verified API adapter in both live and preview mode.
// Navigation snapshots stay in memory and are scoped to the administrator and browser entry.
const snapshots = new Map();
const epochs = new WeakMap();
let pendingRestore;

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {dateStyle: 'medium', timeStyle: 'short'});
const eventLabels = {
  block_requested: 'Блокировка аккаунта',
  unblock_requested: 'Восстановление доступа',
  read_messages: 'Просмотр переписки',
  tender_hidden: 'Тендер скрыт',
  tender_restored: 'Тендер восстановлен'
};
const date = value => {
  const number = value && Date.parse(value);
  return Number.isFinite(number) ? dateFormatter.format(new Date(number)) : '—';
};
const pageNumber = value => Math.min(10000, Math.max(0, Math.trunc(Number(value)) || 0));
const nameOf = user => user.display_name || user.email || user.phone || 'Без имени';
const modified = event => event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
const roleNames = {customer: 'Заказчик', worker: 'Специалист'};

function safeOrigin(value, prefix) {
  if (typeof value !== 'string' || value.length > 8192) return '';
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^' + escaped + '(?:/[A-Za-z0-9_-]{1,80})?(?:\\?[^#]*)?$').test(value) ? value : '';
}

/** Call after the application's async render, before its default focus/scroll reset. */
export function restoreAdminAccountsNavigation() {
  const restore = pendingRestore;
  pendingRestore = null;
  if (!restore || restore.hash !== location.hash || !restore.root.isConnected) return false;
  const {root, snapshot} = restore;
  const focus = snapshot.focus && root.querySelector('#' + CSS.escape(snapshot.focus));
  focus?.focus({preventScroll: true});
  root.scrollTop = snapshot.rootTop || 0;
  root.scrollLeft = snapshot.rootLeft || 0;
  window.scrollTo(snapshot.x || 0, snapshot.y || 0);
  return true;
}

export async function renderAdminAccounts(options) {
  const {root, api, route, esc, notify = () => {}, isCurrent = () => true,
    preview = false, currentUserId = '', rerender} = options;
  const epoch = (epochs.get(root) || 0) + 1;
  epochs.set(root, epoch);
  const hash = location.hash;
  const alive = () => epochs.get(root) === epoch && isCurrent() && location.hash === hash;
  const prefix = preview ? '#admin-preview' : '#admin';
  const scope = prefix + '/' + currentUserId;
  const params = new URLSearchParams(route.params);
  const panel = ['users', 'customers', 'specialists'].includes(params.get('panel')) ? params.get('panel') : 'users';
  const id = route.id || '';
  const state = history.state && typeof history.state === 'object' ? history.state : {};
  const entry = state.adAccountsEntry?.scope === scope
    ? state.adAccountsEntry : {scope, key: crypto.randomUUID()};
  history.replaceState({...state, adAccountsEntry: entry}, '');
  const snapshotKey = scope + '|' + entry.key + '|' + hash;
  const saved = snapshots.get(snapshotKey);
  let reader = saved?.reader || null;
  pendingRestore = null;

  const statusBadge = user => '<span class="ad-badge ' + (user.blocked_at ? 'ad-badge-danger' : 'ad-badge-success') + '">' +
    (user.blocked_at ? 'Заблокирован' : 'Активен') + '</span>';
  const profileLabels = user => [
    user.customer_enabled ? 'Заказчик' : '', user.worker_enabled ? 'Специалист' : '', user.owner ? 'Администратор' : ''
  ].filter(Boolean).join(' · ') || 'Профили не настроены';
  const listParams = new URLSearchParams(params);
  listParams.set('panel', panel);
  listParams.delete('returnTo');
  if (id) {
    listParams.delete('tab'); listParams.delete('jp');
  }
  const href = (recordId, next) => prefix + (recordId ? '/' + encodeURIComponent(recordId) : '') + (next.size ? '?' + next : '');
  const fallback = href('', listParams);
  const origin = safeOrigin(params.get('returnTo'), prefix) ||
    (state.adAccountsOrigin?.scope === scope ? safeOrigin(state.adAccountsOrigin.hash, prefix) : '') || fallback;
  const accountHref = accountId => {
    const next = new URLSearchParams({panel, tab: 'info', returnTo: hash});
    return href(accountId, next);
  };

  function remember(focus) {
    const form = root.querySelector('[data-ad-account-search]');
    snapshots.set(snapshotKey, {
      hash, x: window.scrollX, y: window.scrollY, rootTop: root.scrollTop, rootLeft: root.scrollLeft,
      focus: focus?.id || document.activeElement?.id || '',
      query: form?.elements.q?.value, status: form?.elements.status?.value, reader
    });
    // Bound private in-memory snapshots; never serialize message bodies or reasons into URLs or storage.
    if (snapshots.size > 60) snapshots.delete(snapshots.keys().next().value);
  }

  function bindLinks() {
    root.querySelectorAll('[data-ad-account-link]').forEach(link => {
      link.onclick = event => {
        if (modified(event)) return;
        event.preventDefault();
        remember(link);
        const destination = link.hash;
        location.hash = destination;
        const nextState = history.state && typeof history.state === 'object' ? history.state : {};
        history.replaceState({...nextState, adAccountsOrigin: {scope, hash, key: entry.key}}, '');
      };
    });
    const back = root.querySelector('[data-ad-account-back]');
    if (back) back.onclick = event => {
      if (modified(event)) return;
      const marker = history.state?.adAccountsOrigin;
      if (marker?.scope === scope && marker.hash === origin && marker.key) {
        event.preventDefault(); remember(back); history.back();
      }
    };
    root.querySelectorAll('[data-ad-account-tab]').forEach(link => {
      link.onclick = event => {
        if (modified(event)) return;
        event.preventDefault(); remember(link);
        history.replaceState(history.state, '', link.hash);
        if (rerender) void rerender();
        else {
          const next = new URLSearchParams(location.hash.split('?')[1] || '');
          void renderAdminAccounts({...options, route: {...route, params: next}});
        }
      };
    });
  }

  function finish() {
    root.removeAttribute('aria-busy');
    bindLinks();
    if (saved) pendingRestore = {root, hash, snapshot: saved};
  }

  function errorBlock(error, retry) {
    return '<div class="ad-error" role="alert"><p>' + esc(error?.message || 'Не удалось загрузить данные.') +
      '</p>' + (retry ? '<button type="button" class="ad-button" data-ad-retry>Повторить</button>' : '') + '</div>';
  }

  function pagination(page, hasNext, makeHref, tabs = false) {
    if (!page && !hasNext) return '';
    const attr = tabs ? ' data-ad-account-tab' : '';
    return '<nav class="ad-pagination" aria-label="Страницы результатов">' +
      (page ? '<a class="ad-button"' + attr + ' href="' + esc(makeHref(page - 1)) + '">Предыдущая</a>' : '') +
      '<span class="ad-muted">Страница ' + (page + 1) + '</span>' +
      (hasNext ? '<a class="ad-button"' + attr + ' href="' + esc(makeHref(page + 1)) + '">Следующая</a>' : '') + '</nav>';
  }

  root.setAttribute('aria-busy', 'true');
  root.innerHTML = '<div class="ad-loading" role="status">Загрузка аккаунтов…</div>';
  try {
    if (!id) {
      const tab = ['all', 'active', 'blocked', 'admins'].includes(params.get('tab')) ? params.get('tab') : 'all';
      const query = (params.get('q') || '').slice(0, 150);
      const status = ['active', 'blocked'].includes(params.get('status')) ? params.get('status') :
        ['active', 'blocked'].includes(tab) ? tab : '';
      const page = pageNumber(params.get('p'));
      const role = tab === 'admins' ? 'admins' : ({customers: 'customers', specialists: 'specialists'})[panel] || 'all';
      const rows = await api('accounts', {search: query, status, page, role});
      if (!alive()) return;
      const visible = Array.isArray(rows) ? rows.slice(0, 30) : [];
      const listTabHref = value => {
        const next = new URLSearchParams(params);
        next.set('panel', panel); next.set('tab', value); next.delete('p');
        if (['active', 'blocked'].includes(value)) next.set('status', value); else next.delete('status');
        return href('', next);
      };
      const tabs = [['all', 'Все'], ['active', 'Активные'], ['blocked', 'Заблокированные']];
      if (panel === 'users') tabs.push(['admins', 'Администраторы']);
      root.innerHTML = '<div class="ad-section-heading"><div><h2>' +
        ({users: 'Аккаунты', customers: 'Заказчики', specialists: 'Специалисты'})[panel] + '</h2>' +
        '<p class="ad-muted">' + (panel === 'users' ? 'Аккаунты, зарегистрированные в «Белхи». Один человек может быть заказчиком и специалистом.' :
          panel === 'customers' ? 'Аккаунты с профилем заказчика или собственными тендерами.' :
            'Аккаунты с профилем специалиста или отправленными откликами.') + '</p></div></div>' +
        '<nav class="ad-tabs" aria-label="Статус аккаунтов">' + tabs.map(([value, label]) =>
          '<a class="ad-tab" href="' + esc(listTabHref(value)) + '"' + (tab === value ? ' aria-current="page"' : '') + '>' + label + '</a>').join('') + '</nav>' +
        '<form class="ad-toolbar ad-search-form" data-ad-account-search>' +
        '<label class="ad-field">Поиск<input class="ad-input" id="ad-account-query" name="q" type="search" maxlength="150" value="' + esc(saved?.query ?? query) + '" placeholder="Имя, почта, телефон или ID"></label>' +
        '<label class="ad-field">Доступ<select class="ad-select" id="ad-account-status" name="status">' +
        [['', 'Все статусы'], ['active', 'Активен'], ['blocked', 'Заблокирован']].map(([value, label]) =>
          '<option value="' + value + '"' + ((saved?.status ?? status) === value ? ' selected' : '') + '>' + label + '</option>').join('') + '</select></label>' +
        '<button class="ad-button ad-button-primary" type="submit">Найти</button>' +
        (query || status ? '<a class="ad-button ad-button-ghost" href="' + esc(href('', new URLSearchParams({panel, tab: 'all'}))) + '">Сбросить</a>' : '') + '</form>' +
        (visible.length ? '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th scope="col">Пользователь</th><th scope="col">Профили</th><th scope="col">Регистрация</th><th scope="col">Доступ</th></tr></thead><tbody>' +
          visible.map(user => '<tr><td><a class="ad-account-link" data-ad-account-link id="ad-account-' + esc(user.id) + '" href="' + esc(accountHref(user.id)) + '">' +
            '<span class="ad-avatar" aria-hidden="true">' + esc(nameOf(user).slice(0, 1).toUpperCase()) + '</span><span class="ad-person"><strong>' + esc(nameOf(user)) +
            '</strong><small>' + esc(user.email || user.phone || user.id) + '</small></span></a></td><td data-label="Профили">' + esc(profileLabels(user)) +
            '</td><td data-label="Регистрация"><time>' + esc(date(user.created_at)) + '</time></td><td data-label="Доступ">' + statusBadge(user) + '</td></tr>').join('') + '</tbody></table></div>' :
          '<div class="ad-empty"><h3>Аккаунты не найдены</h3><p>' + (query || status ? 'Измените запрос или сбросьте фильтры.' : 'Здесь появятся пользователи этого раздела.') + '</p></div>') +
        pagination(page, rows?.length > 30, nextPage => {
          const next = new URLSearchParams(params); next.set('panel', panel);
          if (nextPage) next.set('p', nextPage); else next.delete('p');
          return href('', next);
        });
      const form = root.querySelector('[data-ad-account-search]');
      form.onsubmit = event => {
        event.preventDefault();
        const values = new FormData(form);
        const next = new URLSearchParams({panel});
        const search = String(values.get('q') || '').trim();
        const access = String(values.get('status') || '');
        if (search) next.set('q', search);
        if (access) next.set('status', access);
        next.set('tab', tab === 'admins' ? 'admins' : access || 'all');
        location.hash = href('', next);
      };
      finish();
      return;
    }

    let user = await api('account', {id});
    if (!alive()) return;
    if (!user || typeof user !== 'object' || Array.isArray(user)) throw Error('Аккаунт не найден.');
    const tab = ['info', 'access', 'messages', 'activity'].includes(params.get('tab')) ? params.get('tab') : 'info';
    const tabHref = value => {
      const next = new URLSearchParams(params); next.set('panel', panel); next.set('tab', value);
      if (!next.has('returnTo')) next.set('returnTo', origin);
      return href(id, next);
    };
    root.innerHTML = '<a class="ad-back-link" data-ad-account-back id="ad-account-back" href="' + esc(origin) + '">← Назад</a>' +
      '<div class="ad-detail-header"><div class="ad-person"><h2>' + esc(nameOf(user)) + '</h2><p class="ad-muted">' + esc(profileLabels(user)) + '</p></div>' +
      '<div class="ad-status-line" data-ad-account-badge>' + statusBadge(user) + '</div></div>' +
      '<nav class="ad-tabs" aria-label="Карточка аккаунта">' + [['info', 'Обзор'], ['access', 'Доступ'], ['messages', 'Переписка'], ['activity', 'История']].map(([value, label]) =>
        '<a class="ad-tab" data-ad-account-tab id="ad-account-tab-' + value + '" href="' + esc(tabHref(value)) + '"' + (tab === value ? ' aria-current="page"' : '') + '>' + label + '</a>').join('') + '</nav><div data-ad-account-section></div>';
    const section = root.querySelector('[data-ad-account-section]');
    if (tab === 'info') {
      const facts = [
        ['Почта', user.email || 'Не указана'], ['Телефон', user.phone || 'Не указан'],
        ['Дата регистрации', date(user.created_at)], ['Подтверждение аккаунта', date(user.confirmed_at)],
        ['Последний вход', date(user.last_sign_in_at)], ['Стартовый режим', roleNames[user.starting_mode] || 'Не выбран'],
        ['ID аккаунта', user.id]
      ];
      section.innerHTML = '<dl class="ad-info-grid">' + facts.map(([label, value]) => '<div class="ad-info-item"><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>').join('') +
        '</dl><p class="ad-muted">Стартовый режим определяет первый экран после входа и не ограничивает человека одной ролью. Локальные данные профиля и CRM с другого устройства здесь не отображаются.</p>';
    } else if (tab === 'access') {
      const protectedAccount = user.owner || user.id === currentUserId;
      section.innerHTML = '<section class="ad-card"><h3>Доступ к «Белхи»</h3><p>' +
        (user.blocked_at ? 'Доступ заблокирован с ' + esc(date(user.blocked_at)) + '.' : 'Пользователь может пользоваться своим аккаунтом.') + '</p>' +
        (protectedAccount ? '<p class="ad-notice">Аккаунт администратора и собственный аккаунт защищены от блокировки.</p>' :
          '<p class="ad-muted">Блокировка действует только в «Белхи». Укажите причину — действие будет записано в журнал.</p>' +
          '<form class="ad-reason-form" data-ad-access-form><label class="ad-field">Причина<textarea class="ad-input" name="reason" minlength="3" maxlength="500" required rows="3" placeholder="Опишите причину решения"></textarea></label>' +
          '<p class="ad-error" role="alert" data-ad-action-error hidden></p><button type="submit" class="ad-button ' + (user.blocked_at ? 'ad-button-primary' : 'ad-button-danger') + '">' +
          (user.blocked_at ? 'Восстановить доступ' : 'Заблокировать аккаунт') + '</button></form>') + '</section>';
      const form = section.querySelector('[data-ad-access-form]');
      if (form) form.onsubmit = async event => {
        event.preventDefault();
        const reason = String(new FormData(form).get('reason') || '').trim();
        const error = form.querySelector('[data-ad-action-error]');
        error.hidden = true;
        if (reason.length < 3 || reason.length > 500) {
          error.textContent = 'Укажите причину от 3 до 500 символов.'; error.hidden = false; form.elements.reason.focus(); return;
        }
        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true; form.elements.reason.disabled = true;
        try {
          const action = user.blocked_at ? 'unblock' : 'block';
          const updated = await api(action, {id, reason});
          if (!alive()) return;
          if (updated?.id) user = updated;
          notify((preview ? 'Тестовый аккаунт: ' : '') + (action === 'block' ? 'доступ заблокирован.' : 'доступ восстановлен.'));
          if (rerender) await rerender(); else await renderAdminAccounts(options);
        } catch (failure) {
          if (alive()) {error.textContent = failure.message || 'Действие не выполнено. Попробуйте ещё раз.'; error.hidden = false;}
        } finally {
          if (alive()) {submit.disabled = false; form.elements.reason.disabled = false;}
        }
      };
    } else if (tab === 'messages') {
      section.innerHTML = '<section class="ad-card"><h3>Переписка в «Белхи»</h3><p class="ad-muted">Просмотр требует причины и фиксируется в журнале. Здесь доступны только сообщения, сохранённые в «Белхи»; письма регистрации и SMS не входят.</p>' +
        '<form class="ad-reason-form" data-ad-message-form><label class="ad-field">Причина просмотра<textarea class="ad-input" name="reason" minlength="3" maxlength="500" required rows="2" placeholder="Например, проверка обращения пользователя">' + esc(reader?.reason || '') + '</textarea></label>' +
        '<button type="submit" class="ad-button ad-button-primary">Открыть сообщения</button></form><div data-ad-messages aria-live="polite"></div></section>';
      const form = section.querySelector('[data-ad-message-form]');
      const result = section.querySelector('[data-ad-messages]');
      const paintMessages = () => {
        const rows = reader.rows || [];
        result.innerHTML = rows.length ? '<ul class="ad-message-list">' + rows.slice(0, 30).map((message, index) => {
          const outgoing = message.sender_id === id;
          const other = outgoing ? message.recipient_id : message.sender_id;
          return '<li class="ad-message"><div class="ad-inline-actions"><strong>' + (outgoing ? 'Исходящее' : 'Входящее') + '</strong><time class="ad-muted">' + esc(date(message.sent_at)) + '</time></div>' +
            '<p class="ad-message-body">' + esc(message.body || '') + '</p><small>Собеседник: <a class="ad-account-link" data-ad-account-link id="ad-message-peer-' + index + '" href="' + esc(accountHref(other)) + '">' + esc(other) + '</a></small></li>';
        }).join('') + '</ul>' : '<div class="ad-empty"><p>У этого аккаунта нет сохранённых сообщений.</p></div>';
        if (reader.page || rows.length > 30) result.insertAdjacentHTML('beforeend', '<nav class="ad-pagination" aria-label="Страницы сообщений">' +
          (reader.page ? '<button type="button" class="ad-button" data-ad-message-page="' + (reader.page - 1) + '">Новее</button>' : '') +
          '<span class="ad-muted">Страница ' + (reader.page + 1) + '</span>' +
          (rows.length > 30 ? '<button type="button" class="ad-button" data-ad-message-page="' + (reader.page + 1) + '">Ранее</button>' : '') + '</nav>');
        result.querySelectorAll('[data-ad-message-page]').forEach(button => button.onclick = () => loadMessages(reader.reason, pageNumber(button.dataset.adMessagePage)));
        bindLinks();
      };
      const loadMessages = async (reason, page) => {
        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        result.innerHTML = '<p class="ad-loading" role="status">Загрузка сообщений…</p>';
        try {
          const rows = await api('messages', {id, reason, page});
          if (!alive()) return;
          reader = {reason, page, rows: Array.isArray(rows) ? rows : []}; paintMessages();
        } catch (failure) {
          if (alive()) result.innerHTML = errorBlock(failure, false);
        } finally { if (alive()) submit.disabled = false; }
      };
      form.onsubmit = event => {
        event.preventDefault();
        const reason = String(new FormData(form).get('reason') || '').trim();
        if (reason.length < 3 || reason.length > 500) {
          result.innerHTML = errorBlock({message: 'Укажите причину от 3 до 500 символов.'}, false); form.elements.reason.focus(); return;
        }
        void loadMessages(reason, 0);
      };
      if (reader) paintMessages();
    } else {
      section.innerHTML = '<p class="ad-loading" role="status">Загрузка истории…</p>';
      const page = pageNumber(params.get('jp'));
      try {
        const rows = await api('journal', {target: id, page});
        if (!alive()) return;
        const list = Array.isArray(rows) ? rows : [];
        const ownRows = list.filter(row => row.target === id).slice(0, 30);
        const scoped = list.every(row => row.target === id);
        section.innerHTML = '<p class="ad-muted">Действия модераторов, связанные с этим аккаунтом. ' +
          (scoped ? 'На странице показано до 30 записей; это не полная история всех действий пользователя.' : 'Сервис вернул общий журнал: показаны только связанные записи из полученной страницы.') + '</p>' +
          (ownRows.length ? '<ol class="ad-log-list">' + ownRows.map(event => '<li class="ad-log-item"><div class="ad-inline-actions"><strong>' + esc(eventLabels[event.action] || event.action || 'Действие модератора') +
            '</strong><time class="ad-muted">' + esc(date(event.at)) + '</time></div><p>' + esc(event.reason || 'Причина не указана') + '</p><small class="ad-muted">Администратор: ' + esc(event.actor || '—') + '</small></li>').join('') + '</ol>' :
            '<div class="ad-empty"><p>Связанных записей на этой странице нет.</p></div>') +
          pagination(page, list.length > 30, nextPage => {
            const next = new URLSearchParams(params); next.set('panel', panel); next.set('tab', 'activity');
            if (nextPage) next.set('jp', nextPage); else next.delete('jp');
            return href(id, next);
          }, true);
      } catch (failure) {
        if (!alive()) return;
        section.innerHTML = errorBlock(failure, true);
        section.querySelector('[data-ad-retry]').onclick = () => rerender ? rerender() : renderAdminAccounts(options);
      }
    }
    finish();
  } catch (error) {
    if (!alive()) return;
    root.innerHTML = (id ? '<a class="ad-back-link" data-ad-account-back href="' + esc(origin) + '">← Назад</a>' : '') + errorBlock(error, true);
    root.querySelector('[data-ad-retry]').onclick = () => rerender ? rerender() : renderAdminAccounts(options);
    finish();
  }
}
