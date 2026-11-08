import {api, currentAuth, signOut} from './auth.js';

const modes = {customer: 'Заказчик', worker: 'Исполнитель'};
const actions = {
  block_requested: 'Запрос на блокировку',
  unblock_requested: 'Запрос на разблокировку',
  read_messages: 'Просмотр сообщений'
};
const dateFormat = new Intl.DateTimeFormat('ru-RU', {dateStyle: 'medium', timeStyle: 'short'});
const date = value => value ? dateFormat.format(new Date(value)) : '—';
const blocked = account => Boolean(account.blocked_at);
const accountName = account => account.display_name || account.email || account.phone || 'Без имени';
const request = (action, fields = {}) => api('/functions/v1/belkhi-moderation', {
  method: 'POST', body: {action, ...fields}
});

export async function moderation(id, params, {show, notice, esc}, isCurrent) {
  const root = document.querySelector('#screen');
  const query = params.get('q') || '';
  const status = params.get('status') || '';
  const journal = params.get('view') === 'journal';
  const page = Math.max(0, Math.min(10000, Math.trunc(Number(params.get('p'))) || 0));
  const listUrl = new URLSearchParams();
  if (query) listUrl.set('q', query);
  if (status) listUrl.set('status', status);
  if (page) listUrl.set('p', page);
  const suffix = listUrl.size ? '?' + listUrl : '';
  const listHref = '#admin' + suffix;
  const title = id ? 'Карточка аккаунта' : journal ? 'Журнал модерации' : 'Аккаунты';
  const heading = id ? '<a class="back" id="moderation-back" href="' + esc(listHref) + '">К списку аккаунтов</a>' : '';
  const badge = user => '<span class="moderation-badge' + (blocked(user) ? ' blocked' : '') + '">' +
    (blocked(user) ? 'Заблокирован' : 'Активен') + '</span>';

  function paint(body) {
    show(null, title, `<nav class="moderation-tabs" aria-label="Разделы администрирования">
      <a href="#admin" ${!journal ? 'aria-current="page"' : ''}>Аккаунты</a>
      <a href="#admin?view=journal" ${journal ? 'aria-current="page"' : ''}>Журнал</a>
      <a href="#admin?section=Тендеры">Демокаталог</a>
      <button type="button" id="moderation-exit">Выйти</button>
    </nav>${heading}${body}`);
    const back = root.querySelector('#moderation-back');
    if (back && history.state?.moderationOrigin === listHref) {
      back.onclick = event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        history.back();
      };
    }
    root.querySelector('#moderation-exit').onclick = async event => {
      event.currentTarget.disabled = true;
      try { await signOut(); } finally { location.reload(); }
    };
  }

  function paging(rows) {
    const url = next => {
      const p = new URLSearchParams(listUrl);
      if (journal) p.set('view', 'journal');
      if (next) p.set('p', next); else p.delete('p');
      return '#admin' + (p.size ? '?' + p : '');
    };
    return `<div class="moderation-pages">
      ${page ? '<a class="btn" href="' + esc(url(page - 1)) + '">Предыдущая</a>' : ''}
      ${rows.length === 31 ? '<a class="btn" href="' + esc(url(page + 1)) + '">Следующая</a>' : ''}
    </div>`;
  }

  paint('<p class="muted" role="status">Загрузка…</p>');
  try {
    if (journal) {
      const rows = await request('journal', {page});
      if (!isCurrent()) return;
      paint('<p class="muted">Причины запросов на блокировку и просмотров переписки.</p>' +
        (rows.length ? '<ul class="moderation-log">' + rows.slice(0, 30).map(row => `<li>
          <strong>${esc(actions[row.action] || row.action)}</strong><time>${esc(date(row.at))}</time>
          <p>${esc(row.reason)}</p><small>Администратор ${esc(row.actor)}</small>
          <small>Аккаунт <a href="#admin/${esc(row.target)}">${esc(row.target)}</a></small>
        </li>`).join('') + '</ul>' : '<p class="moderation-empty">В журнале пока нет записей.</p>') + paging(rows));
      return;
    }

    if (!id) {
      const rows = await request('accounts', {search: query, status, page});
      if (!isCurrent()) return;
      paint(`<p class="muted">Найдите пользователя, чтобы проверить данные, статус доступа или переписку.</p>
        <form class="moderation-search">
          <label>Поиск<input name="q" type="search" maxlength="150" placeholder="Имя, почта, телефон или ID" value="${esc(query)}"></label>
          <label>Статус<select name="status">
            <option value="">Все аккаунты</option>
            <option value="active" ${status === 'active' ? 'selected' : ''}>Активные</option>
            <option value="blocked" ${status === 'blocked' ? 'selected' : ''}>Заблокированные</option>
          </select></label>
          <button>Найти</button>
        </form>
        ${rows.length ? '<div class="moderation-table-head" aria-hidden="true"><span>Пользователь</span><span>Режим</span><span>Регистрация</span><span>Статус</span></div>' +
          rows.slice(0, 30).map(user => `<a class="moderation-row" href="#admin/${esc(user.id + suffix)}">
            <span class="moderation-person"><strong>${esc(accountName(user))}</strong><small>${esc(user.email || user.phone || user.id)}</small></span>
            <span>${esc(user.owner ? 'Администратор' : modes[user.starting_mode] || 'Не выбран')}</span>
            <time>${esc(date(user.created_at))}</time>
            ${badge(user)}
          </a>`).join('') : '<p class="moderation-empty">Аккаунты не найдены.</p>'}${paging(rows)}`);
      const searchForm = root.querySelector('.moderation-search');
      const snapshot = history.state?.moderationList;
      if (snapshot?.hash === location.hash) {
        searchForm.elements.q.value = snapshot.query;
        searchForm.elements.status.value = snapshot.status;
        requestAnimationFrame(() => {
          if (!isCurrent()) return;
          [...root.querySelectorAll('.moderation-row')].find(row => row.hash === snapshot.focus)?.focus({preventScroll: true});
          window.scrollTo(0, snapshot.scroll);
        });
      }
      root.querySelectorAll('.moderation-row').forEach(row => row.onclick = event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const origin = location.hash;
        history.replaceState({...history.state, moderationList: {
          hash: origin, focus: row.hash, scroll: window.scrollY,
          query: searchForm.elements.q.value, status: searchForm.elements.status.value
        }}, '');
        location.hash = row.hash;
        history.replaceState({moderationOrigin: origin}, '');
      });
      searchForm.onsubmit = event => {
        event.preventDefault();
        const next = new URLSearchParams(new FormData(event.currentTarget));
        for (const key of ['q', 'status']) if (!next.get(key)?.trim()) next.delete(key);
        location.hash = 'admin' + (next.size ? '?' + next : '');
      };
      return;
    }

    let user = await request('account', {id});
    if (!isCurrent()) return;
    const protectedAccount = user.owner || user.id === currentAuth()?.user?.id;
    const info = [
      ['ID аккаунта', user.id], ['Почта', user.email], ['Телефон', user.phone],
      ['Рабочий режим', user.owner ? 'Администратор' : modes[user.starting_mode] || 'Не выбран'],
      ['Создан', date(user.created_at)], ['Последний вход', date(user.last_sign_in_at)],
      ['Подтверждён', date(user.confirmed_at)]
    ];
    paint(`<div class="moderation-detail-head"><h2>${esc(accountName(user))}</h2><div id="moderation-status">${badge(user)}</div></div>
      <dl class="moderation-fields">${info.map(([label, value]) => '<div><dt>' + esc(label) + '</dt><dd>' + esc(value || '—') + '</dd></div>').join('')}</dl>
      ${protectedAccount ? '<p class="muted">Аккаунт администратора защищён от блокировки.</p>' : '<button type="button" id="account-moderate"></button>'}
      <section class="moderation-messages" aria-labelledby="messages-title">
        <h2 id="messages-title">Сообщения в «Белхи»</h2>
        <p class="muted">Укажите причину доступа к переписке. Просмотр появится в журнале модерации.</p>
        <form id="read-messages">
          <label>Причина просмотра<input name="reason" minlength="3" maxlength="500" required></label>
          <button>Открыть сообщения</button>
        </form>
        <div id="moderation-messages-result" aria-live="polite"></div>
      </section>`);

    const button = root.querySelector('#account-moderate');
    const label = () => blocked(user) ? 'Разблокировать' : 'Заблокировать';
    if (button) {
      button.textContent = label();
      button.classList.toggle('moderation-danger', !blocked(user));
      button.onclick = () => {
        const dialog = document.querySelector('#confirmation');
        const action = blocked(user) ? 'unblock' : 'block';
        dialog.innerHTML = `<form class="moderation-confirm">
          <h2>${label()} аккаунт?</h2>
          <p>${esc(accountName(user))}</p>
          <label>Причина<input name="reason" minlength="3" maxlength="500" required></label>
          <p role="alert" class="account-error"></p>
          <div class="actions"><button type="button" data-cancel>Отмена</button><button class="${action === 'block' ? 'moderation-danger' : 'primary'}">${label()}</button></div>
        </form>`;
        dialog.showModal();
        dialog.querySelector('input').focus();
        dialog.querySelector('form').onsubmit = async event => {
          event.preventDefault();
          const form = event.currentTarget;
          const submit = event.submitter;
          submit.disabled = true;
          button.disabled = true;
          try {
            user = await request(action, {id, reason: new FormData(form).get('reason')});
            if (!isCurrent()) return;
            root.querySelector('#moderation-status').innerHTML = badge(user);
            button.textContent = label();
            button.classList.toggle('moderation-danger', !blocked(user));
            dialog.close();
            button.disabled = false;
            button.focus();
            notice(blocked(user) ? 'Аккаунт заблокирован.' : 'Доступ восстановлен.');
          } catch (error) {
            if (isCurrent()) form.querySelector('[role="alert"]').textContent = error.message;
          } finally {
            submit.disabled = false;
            button.disabled = false;
          }
        };
      };
    }

    const form = root.querySelector('#read-messages');
    const result = root.querySelector('#moderation-messages-result');
    async function messages(reason, messagePage) {
      const submit = form.querySelector('button');
      submit.disabled = true;
      result.textContent = 'Загрузка сообщений…';
      try {
        const rows = await request('messages', {id, reason, page: messagePage});
        if (!isCurrent()) return;
        result.innerHTML = rows.length ? '<ul class="moderation-log">' + rows.slice(0, 30).map(row => `<li>
          <strong>${row.sender_id === id ? 'Исходящее' : 'Входящее'}</strong><time>${esc(date(row.sent_at))}</time>
          <p>${esc(row.body)}</p><small>Собеседник <a href="#admin/${esc(row.sender_id === id ? row.recipient_id : row.sender_id)}">${esc(row.sender_id === id ? row.recipient_id : row.sender_id)}</a></small>
        </li>`).join('') + '</ul>' : '<p class="moderation-empty">У этого аккаунта пока нет сообщений.</p>';
        if (messagePage) result.insertAdjacentHTML('beforeend', '<button type="button" data-page="previous">Новее</button>');
        if (rows.length === 31) result.insertAdjacentHTML('beforeend', '<button type="button" data-page="next">Ранее</button>');
        result.querySelectorAll('button').forEach(control => control.onclick = () =>
          messages(reason, messagePage + (control.dataset.page === 'next' ? 1 : -1)));
      } catch (error) {
        if (isCurrent()) result.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    }
    form.onsubmit = event => {
      event.preventDefault();
      void messages(new FormData(form).get('reason'), 0);
    };
  } catch (error) {
    if (isCurrent()) paint('<p class="account-error" role="alert">' + esc(error.status === 404 && !id
      ? 'Сервис модерации ещё не подключён.' : error.message) + '</p>');
  }
}
