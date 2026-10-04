import { API_URL } from "./config";
import { getIdToken, getRefreshToken, setTokens, clearSession } from "./userSession";

let onAuthExpired = null;
// The root layout registers a handler that sends the user back to the login screen
export const setAuthExpiredHandler = (fn) => { onAuthExpired = fn; };

let refreshing = null;

// Exchanges the refresh token for a new ID token (ID tokens last one hour)
function refreshSession() {
  const token = getRefreshToken();
  if (!token) return Promise.resolve(false);
  if (!refreshing) {
    refreshing = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: token }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.idToken) { setTokens(data); return true; }
        return false;
      })
      .catch(() => false)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

// fetch() against the NexBus API with the signed-in user's token attached.
// A 401 triggers one token refresh and one retry; if that fails the user is signed out.
export async function apiFetch(path, options = {}) {
  const run = () => {
    const token = getIdToken();
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  };

  let res = await run();
  if (res.status === 401 && getIdToken()) {
    if (await refreshSession()) res = await run();
    if (res.status === 401) {
      clearSession();
      if (onAuthExpired) onAuthExpired();
    }
  }
  return res;
}

// Same as apiFetch but parses the JSON body. Never throws on HTTP errors; network errors still reject.
export async function apiJson(path, options) {
  const res = await apiFetch(path, options);
  let data = null;
  try { data = await res.json(); } catch { /* empty body, e.g. 204 */ }
  return { ok: res.ok, status: res.status, data };
}

export const jsonBody = (body) => ({ body: JSON.stringify(body) });
