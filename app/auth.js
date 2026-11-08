import {projectUrl, publishableKey, publicEmailSignupEnabled} from './cloud.js';

const key = 'belkhi-auth-session';
const verifierKey = 'belkhi-signup-verifier';
const signupVersion = 'email-first-v1';
const identityPath = '/rest/v1/belkhi_identities';
const blockPath = '/rest/v1/belkhi_account_blocks?select=user_id';
let auth = null;
let identity = null;
let refreshing;
window.addEventListener('storage', event => {
  if (event.key === key && !event.newValue && auth) location.reload();
});

export const currentAuth = () => auth;
export const currentIdentity = () => identity;
export const isOwner = () => auth?.user?.app_metadata?.belkhi_role === 'owner';
export const emailSignupEnabled = publicEmailSignupEnabled || ['localhost', '127.0.0.1'].includes(location.hostname);

function save(next) {
  if (auth?.user?.id !== next?.user?.id) identity = null;
  auth = next;
  if (next) localStorage.setItem(key, JSON.stringify(next));
  else localStorage.removeItem(key);
}

export async function api(path, {method = 'GET', body, token, representation = false, merge = false} = {}) {
  if (token === undefined && auth) {
    if (auth.expires_at <= Date.now() / 1000 + 30) {
      refreshing ||= restoreAuth().catch(error => {
        if (!auth) location.reload();
        throw error;
      }).finally(() => { refreshing = null; });
      await refreshing;
    }
    token = auth?.access_token;
  }
  const headers = {apikey: publishableKey, 'Content-Type': 'application/json'};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (representation) headers.Prefer = merge ? 'return=representation,resolution=merge-duplicates' : 'return=representation';
  const response = await fetch(projectUrl + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(path.startsWith('/functions/') ? 35000 : 15000)
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = null; }
  if (response.ok) return data;
  const message = ({
    invalid_credentials: 'Проверьте почту и пароль.',
    email_not_confirmed: 'Подтвердите почту по ссылке из письма.',
    user_banned: 'Аккаунт заблокирован.',
    over_email_send_rate_limit: 'Слишком много запросов. Попробуйте позже.',
    over_request_rate_limit: 'Подождите минуту и попробуйте ещё раз.',
    otp_expired: 'Код истёк или введён неверно. Проверьте код или запросите новый.',
    PGRST205: 'Регистрация временно недоступна. Попробуйте позже.',
    weak_password: 'Придумайте более надёжный пароль.'
  })[data?.error_code || data?.code];
  throw Object.assign(new Error(message || data?.message || data?.msg || 'Запрос не выполнен. Попробуйте ещё раз.'), {
    status: response.status, code: data?.error_code || data?.code
  });
}

export async function restoreAuth() {
  const url = new URL(location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const code = url.searchParams.get('code');
  const failed = url.searchParams.has('error_description') || fragment.has('error_description');
  if (code || failed || fragment.has('access_token')) {
    for (const key of ['code', 'error', 'error_code', 'error_description']) url.searchParams.delete(key);
    url.hash = '';
    history.replaceState(null, '', url);
  }
  if (failed) throw new Error('Ссылка подтверждения недействительна. Запросите новое письмо.');
  let stored;
  try { stored = JSON.parse(localStorage.getItem(key) || 'null'); } catch { save(null); }
  if (code) {
    const verifier = localStorage.getItem(verifierKey);
    if (!verifier) throw new Error('Откройте ссылку в браузере, где начали регистрацию, или запросите новый код.');
    stored = await api('/auth/v1/token?grant_type=pkce', {
      method: 'POST', body: {auth_code: code, code_verifier: verifier}, token: null
    });
    localStorage.removeItem(verifierKey);
  }
  if (!stored?.access_token || !stored.refresh_token) return null;
  try {
    if (!stored.expires_at || stored.expires_at <= Date.now() / 1000 + 30) {
      stored = await api('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', body: {refresh_token: stored.refresh_token}, token: null
      });
    }
    const user = await api('/auth/v1/user', {token: stored.access_token});
    await acceptSession({...stored, user});
    if (user.user_metadata?.belkhi_registration === signupVersion && user.user_metadata?.belkhi_password_set) {
      await loadIdentity();
    }
    return auth;
  } catch (error) {
    if ([401, 403].includes(error.status) || (error.status === 400 && !auth)) save(null);
    throw error;
  }
}

export async function signIn(email, password) {
  await acceptSession(await api('/auth/v1/token?grant_type=password', {method: 'POST', body: {email, password}, token: null}));
}

async function acceptSession(session) {
  const blocks = await api(blockPath, {token: session.access_token});
  if (Date.parse(session.user.banned_until) > Date.now() || blocks.length) {
    throw Object.assign(new Error('Доступ к «Белхи» заблокирован.'), {status: 403});
  }
  save(session);
}

export async function sendSignupEmail(email) {
  if (!emailSignupEnabled) throw new Error('Подтверждение почты пока недоступно.');
  const returnUrl = location.origin + location.pathname;
  const verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte =>
    byte.toString(16).padStart(2, '0')).join('');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  const previousVerifier = localStorage.getItem(verifierKey);
  localStorage.setItem(verifierKey, verifier);
  try {
    await api('/auth/v1/otp?redirect_to=' + encodeURIComponent(returnUrl), {
      method: 'POST', token: null, body: {
        email, create_user: true, data: {belkhi_registration: signupVersion},
        code_challenge: challenge, code_challenge_method: 's256'
      }
    });
  } catch (error) {
    if (localStorage.getItem(verifierKey) === verifier) {
      if (previousVerifier) localStorage.setItem(verifierKey, previousVerifier);
      else localStorage.removeItem(verifierKey);
    }
    throw error;
  }
}

export async function verifySignupEmail(email, token) {
  const session = await api('/auth/v1/verify', {
    method: 'POST', token: null, body: {email, token, type: 'email'}
  });
  await acceptSession(session);
  localStorage.removeItem(verifierKey);
}

function identityQuery() {
  return '?user_id=eq.' + encodeURIComponent(auth.user.id);
}

async function loadIdentity() {
  const [row] = await api(identityPath + identityQuery() + '&select=birth_date,username');
  identity = row || null;
}

export async function setSignupPassword(password) {
  const user = await api('/auth/v1/user', {
    method: 'PUT', body: {password, data: {belkhi_password_set: true}}
  });
  save({...auth, user});
}

export async function setBirthDate(birthDate) {
  const [row] = await api(identityPath + '?on_conflict=user_id', {
    method: 'POST', body: {user_id: auth.user.id, birth_date: birthDate}, representation: true, merge: true
  });
  identity = row;
}

export async function usernameAvailable(candidate) {
  return api('/rest/v1/rpc/belkhi_username_available', {method: 'POST', body: {candidate}});
}

export async function claimUsername(username) {
  let row;
  try {
    [row] = await api(identityPath + identityQuery(), {
      method: 'PATCH', body: {username}, representation: true
    });
  } catch (error) {
    if (error.code === '23505' || error.code === '23514') {
      throw new Error('Этот @логин недоступен. Выберите другой.');
    }
    throw error;
  }
  if (row) identity = row;
  else await loadIdentity();
  if (!identity?.username) throw new Error('Не удалось сохранить @логин. Попробуйте ещё раз.');
}

export function registrationStep() {
  const metadata = auth?.user?.user_metadata;
  if (metadata?.belkhi_registration !== signupVersion || isOwner()) return null;
  if (!metadata.belkhi_password_set) return 'signup-password';
  if (!identity?.birth_date) return 'signup-birthday';
  if (!identity?.username) return 'signup-username';
  return null;
}

async function updateAccountPreferences(data) {
  const user = await api('/auth/v1/user', {method: 'PUT', body: {data}});
  save({...auth, user});
}

export function setStartingMode(mode) {
  return updateAccountPreferences({
    belkhi_starting_mode: mode,
    ...(mode === 'worker' || auth?.user?.user_metadata?.belkhi_starting_mode === 'worker'
      ? {belkhi_worker_enabled: true} : {})
  });
}

export function enableWorkerProfile() {
  return updateAccountPreferences({belkhi_worker_enabled: true});
}

export async function signOut() {
  try {
    await api('/auth/v1/logout?scope=local', {method: 'POST'});
  } finally {
    save(null);
  }
}

export function accountDestination() {
  if (isOwner()) return 'admin';
  const step = registrationStep();
  if (step) return step;
  return ({customer: 'list', worker: 'market'})[auth?.user?.user_metadata?.belkhi_starting_mode] || 'start';
}

export function watchSession() {
  if (!auth) return;
  let checking = false;
  async function check() {
    if (checking || document.hidden || !auth) return;
    checking = true;
    const id = auth.user.id;
    let expired = false;
    try {
      const user = await api('/auth/v1/user');
      const blocks = await api(blockPath);
      expired = Date.parse(user.banned_until) > Date.now() || Boolean(blocks.length);
    } catch (error) {
      expired = [401, 403].includes(error.status);
    } finally {
      checking = false;
    }
    if (expired && auth?.user.id === id) {
      save(null);
      location.reload();
    }
  }
  window.addEventListener('focus', check);
  window.setInterval(check, 60000);
}
