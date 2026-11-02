// Talks to the HOTELGO JSON API (PHP, /api). The access token lives in memory only; the refresh token in sessionStorage.
// The API lives on another website (its own Render service). Its address comes from config.js (see README).
const BASE = String((window.HOTELGO_CONFIG && window.HOTELGO_CONFIG.apiUrl) || 'http://localhost:8000/api').replace(/\/+$/, '');
const RK = 'hg_refresh'; const RR = 'hg_role';
let access = null;
let refreshing = null;

/* The refresh token and the role live in sessionStorage (gone when the tab closes), or in localStorage when the guest ticks "Remember me". */
const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };          // storage can be blocked (private mode)
let keepAfterClose = safe(() => !!localStorage.getItem(RK), false);                                  // true = the sign-in is in localStorage
const readKey = (k) => safe(() => sessionStorage.getItem(k)) || safe(() => localStorage.getItem(k));
const writeKey = (k, v) => {
  safe(() => { sessionStorage.removeItem(k); localStorage.removeItem(k); });
  if (v) safe(() => (keepAfterClose ? localStorage : sessionStorage).setItem(k, v));
};

export const store = {
  get refresh() { return readKey(RK); },
  set refresh(v) { writeKey(RK, v); },
};

/* 'guest' (the website visitor) or 'staff' (front desk / owner): decides which "who am I" address restore() asks */
export const role = {
  get now() { return readKey(RR); },
  set now(v) { writeKey(RR, v); },
};

export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data || {}; }
}

function send(method, path, body, token) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  return fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

async function readJson(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; } catch { return { error: 'The server sent an unexpected answer.' }; }
}

async function renew() {
  if (!store.refresh) return false;
  if (!refreshing) {
    refreshing = (async () => {
      const res = await send('POST', '/auth/refresh', { refresh_token: store.refresh });
      if (!res.ok) { access = null; store.refresh = null; return false; }
      const j = await readJson(res);
      access = j.tokens.access_token; store.refresh = j.tokens.refresh_token;
      return true;
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function api(method, path, body) {
  let res = await send(method, path, body, access);
  if (res.status === 401 && (await renew())) res = await send(method, path, body, access);
  const j = await readJson(res);
  if (!res.ok) throw new ApiError(j.error || j.message || 'Something went wrong.', res.status, j);
  return j;
}

/* keep the tokens of a finished sign-in (staff or guest) and remember who is signed in */
export function startSession(j, who, remember = false) { keepAfterClose = !!remember; access = j.tokens.access_token; store.refresh = j.tokens.refresh_token; role.now = who; return j.user; }

/* GUEST sign-in (the website). A guest who has not verified yet gets an ApiError with data.need_verify. */
export async function guestSignIn(identifier, password, remember = true) {
  const res = await send('POST', '/guest/login', { identifier, password });
  const j = await readJson(res);
  if (!res.ok) throw new ApiError(j.error || 'Could not sign in.', res.status, j);
  return startSession(j, 'guest', remember);
}

/* download a file the API protects with the token (the calendar .ics) */
export async function download(path, filename) {
  let res = await send('GET', path, undefined, access);
  if (res.status === 401 && (await renew())) res = await send('GET', path, undefined, access);
  if (!res.ok) throw new ApiError('Could not download the file.', res.status);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function signIn(email, password) {
  const res = await send('POST', '/auth/login', { email, password });
  const j = await readJson(res);
  if (!res.ok) throw new ApiError(j.error || 'Could not sign in.', res.status);
  return startSession(j, 'staff');
}

export async function restore() {
  if (!store.refresh || !(await renew())) return null;
  try { return (await api('GET', role.now === 'guest' ? '/guest/me' : '/me')).user; } catch { return null; }
}

export async function signOut() {
  const t = store.refresh;
  access = null; store.refresh = null; role.now = null;
  if (t) { try { await send('POST', '/auth/logout', { refresh_token: t }); } catch { /* offline: token expires by itself */ } }
}
