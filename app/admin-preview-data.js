import {demoCustomers, demoSpecialists, tenderDetails} from './demo-fixtures.js';

// This adapter never calls the network or writes authentication/application storage.
// Its synthetic changes live only in this tab's own, versioned sessionStorage key.
const storageKey = 'belkhi-admin-preview-v1';
export const previewAdminId = 'a1000000-0000-4000-8000-000000000001';
const userId = index => 'a1000000-0000-4000-8000-' + String(index).padStart(12, '0');
const tenderId = index => 'a2000000-0000-4000-8000-' + String(index).padStart(12, '0');
const reference = Date.UTC(2026, 10, 27, 9);
const iso = days => new Date(reference - days * 86400000).toISOString();
const copy = value => JSON.parse(JSON.stringify(value));
let memory;

function failure(status, message) {
  return Object.assign(new Error(message), {status});
}

function fixtureState() {
  const admin = {
    id: previewAdminId, display_name: 'Администратор Белхи', email: 'admin@example.invalid', phone: '',
    starting_mode: 'customer', owner: true, created_at: iso(60), last_sign_in_at: iso(0),
    confirmed_at: iso(60), blocked_at: null, customer_enabled: false, worker_enabled: false
  };
  const customers = demoCustomers.map((person, index) => ({
    id: userId(index + 2), display_name: person.name, email: 'customer' + (index + 1) + '@example.invalid',
    phone: '', starting_mode: 'customer', owner: false, created_at: iso(25 - index * 5),
    last_sign_in_at: iso(index), confirmed_at: iso(25 - index * 5), blocked_at: null,
    customer_enabled: true, worker_enabled: false
  }));
  const specialists = demoSpecialists.map((person, index) => ({
    id: userId(index + 5), display_name: person.name, email: 'specialist' + (index + 1) + '@example.invalid',
    phone: '', starting_mode: 'worker', owner: false, created_at: iso(21 - index * 4),
    last_sign_in_at: iso(index + 1), confirmed_at: iso(21 - index * 4),
    blocked_at: index === 2 ? iso(1) : null, customer_enabled: false, worker_enabled: true
  }));
  const kinds = ['Строительство дома', 'Отделочные работы', 'Кровля', 'Фундамент'];
  const districts = ['Истра', 'Москва', 'Урус-Мартан', 'Грозный'];
  const budgets = [3000000, 450000, 350000, 400000];
  const periods = ['3–5 месяцев', '1–2 месяца', 'До 1 месяца', 'До 2 недель'];
  const photos = ['house', 'room', 'roof', 'site'];
  const owners = [customers[0].id, customers[1].id, customers[2].id, customers[0].id];
  const tenders = tenderDetails.map((details, index) => ({
    id: tenderId(index + 1), owner_id: owners[index], created_at: iso(9 - index * 2),
    status: index === 1 ? 'in_progress' : 'open', bid_count: 3,
    details: {...copy(details), kind: kinds[index], district: districts[index], budget: budgets[index],
      period: periods[index], photo: photos[index]},
    files: index === 1 ? [] : [{name: index === 3 ? 'Схема основания.pdf' : 'Проект работ.pdf',
      type: 'application/pdf', size: 145120 + index * 2048}]
  }));
  return {
    version: 1,
    users: [admin, ...customers, ...specialists], tenders,
    log: [
      {id: 3, at: iso(1), actor: previewAdminId, target: specialists[2].id,
        action: 'block_requested', reason: 'Тестовая блокировка для проверки работы панели.'},
      {id: 2, at: iso(2), actor: previewAdminId, target: customers[0].id,
        action: 'read_messages', reason: 'Демонстрация журнала доступа к сообщениям.'},
      {id: 1, at: iso(3), actor: previewAdminId, target: specialists[1].id,
        action: 'unblock_requested', reason: 'Демонстрация восстановления доступа.'}
    ],
    messages: [
      {id: 2, sent_at: iso(2), sender_id: specialists[0].id, recipient_id: customers[0].id,
        body: 'Демонстрационное сообщение: готов уточнить объём работ после замера.'},
      {id: 1, sent_at: iso(3), sender_id: customers[0].id, recipient_id: specialists[0].id,
        body: 'Демонстрационное сообщение: проект и описание работ добавлены к тендеру.'}
    ]
  };
}

function load() {
  if (memory) return memory;
  try {
    const stored = JSON.parse(globalThis.sessionStorage?.getItem(storageKey) || 'null');
    if (stored?.version === 1 && Array.isArray(stored.users) && Array.isArray(stored.tenders) &&
        Array.isArray(stored.log) && Array.isArray(stored.messages) &&
        stored.users.some(user => user.id === previewAdminId && user.owner === true)) {
      memory = stored;
    }
  } catch { /* Session storage may be disabled; in-memory preview remains usable. */ }
  memory ||= fixtureState();
  return memory;
}

function persist() {
  try { globalThis.sessionStorage?.setItem(storageKey, JSON.stringify(memory)); } catch { /* Tab memory is enough. */ }
}

export function resetAdminPreview() {
  memory = fixtureState();
  try { globalThis.sessionStorage?.removeItem(storageKey); } catch { /* Keep the reset in memory. */ }
}

function page(rows, index) {
  const number = Number(index ?? 0);
  if (!Number.isSafeInteger(number) || number < 0 || number > 10000) {
    throw failure(400, 'Неверная страница. Вернитесь к началу списка.');
  }
  return rows.slice(number * 30, number * 30 + 31);
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function user(state, id) {
  const account = state.users.find(item => item.id === id);
  if (!account) throw failure(404, 'Тестовый аккаунт не найден.');
  return account;
}

function reason(value) {
  const result = text(value);
  if (result.length < 3 || result.length > 500) {
    throw failure(400, 'Укажите причину от 3 до 500 символов.');
  }
  return result;
}

function audit(state, action, target, note) {
  state.log.unshift({id: Math.max(0, ...state.log.map(item => item.id)) + 1,
    at: new Date().toISOString(), actor: previewAdminId, target, action, reason: note});
  persist();
}

function tenderSummary(tender) {
  const {id, owner_id, created_at, status, bid_count, details} = tender;
  const {title, kind, district, budget, period} = details;
  return {id, owner_id, created_at, status, title, kind, district, budget, period, bid_count};
}

export function createAdminPreviewAPI() {
  return async (action, fields = {}) => {
    const state = load();
    let result;
    switch (action) {
      case 'overview':
        result = {
          accounts: {
            total: state.users.length,
            customers: state.users.filter(item => item.customer_enabled).length,
            specialists: state.users.filter(item => item.worker_enabled).length,
            admins: state.users.filter(item => item.owner).length,
            blocked: state.users.filter(item => item.blocked_at).length
          },
          tenders: {
            total: state.tenders.length,
            open: state.tenders.filter(item => item.status === 'open').length,
            in_progress: state.tenders.filter(item => item.status === 'in_progress').length
          },
          bids: {total: state.tenders.reduce((total, item) => total + item.bid_count, 0)}
        };
        break;
      case 'accounts': {
        const search = text(fields.search).slice(0, 150).toLocaleLowerCase('ru');
        const role = text(fields.role) || 'all';
        if (!['all', 'customers', 'specialists', 'admins'].includes(role)) {
          throw failure(400, 'Выберите существующий раздел пользователей.');
        }
        const rows = state.users.filter(item =>
          (role === 'all' || role === 'customers' && item.customer_enabled ||
            role === 'specialists' && item.worker_enabled || role === 'admins' && item.owner) &&
          (!fields.status || fields.status === 'active' && !item.blocked_at ||
            fields.status === 'blocked' && Boolean(item.blocked_at)) &&
          (!search || [item.id, item.display_name, item.email, item.phone].join(' ').toLocaleLowerCase('ru').includes(search))
        ).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
        result = page(rows, fields.page);
        break;
      }
      case 'account':
        result = user(state, fields.id);
        break;
      case 'block':
      case 'unblock': {
        const account = user(state, fields.id);
        const note = reason(fields.reason);
        if (account.owner || account.id === previewAdminId) {
          throw failure(403, 'Тестовый аккаунт администратора защищён от блокировки.');
        }
        account.blocked_at = action === 'block' ? new Date().toISOString() : null;
        audit(state, action === 'block' ? 'block_requested' : 'unblock_requested', account.id, note);
        result = account;
        break;
      }
      case 'journal': {
        const event = text(fields.event);
        result = page(state.log.filter(item => (!fields.target || item.target === fields.target) &&
          (!event || item.action === event)).sort((a, b) => b.id - a.id), fields.page);
        break;
      }
      case 'messages': {
        const account = user(state, fields.id);
        const note = reason(fields.reason);
        // Validate pagination before recording an attempted read.
        result = page(state.messages.filter(item => item.sender_id === account.id ||
          item.recipient_id === account.id).sort((a, b) => b.id - a.id), fields.page);
        audit(state, 'read_messages', account.id, note);
        break;
      }
      case 'tenders': {
        const search = text(fields.search).slice(0, 150).toLocaleLowerCase('ru');
        result = page(state.tenders.filter(item => (!fields.status || item.status === fields.status) &&
          (!fields.owner_id || item.owner_id === fields.owner_id) &&
          (!search || [item.id, item.owner_id, item.details.title, item.details.kind, item.details.district]
            .join(' ').toLocaleLowerCase('ru').includes(search)))
          .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
          .map(tenderSummary), fields.page);
        break;
      }
      case 'tender': {
        const tender = state.tenders.find(item => item.id === fields.id);
        if (!tender) throw failure(404, 'Тестовый тендер не найден.');
        result = tender;
        break;
      }
      default:
        throw failure(400, 'Такого действия в демонстрации панели нет.');
    }
    return copy(result);
  };
}
