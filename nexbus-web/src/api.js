export const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

let session = { idToken: null, refreshToken: null }
let onExpired = () => {}

export const setTokens = (tokens) => { session = { ...session, ...tokens } }
export const clearTokens = () => { session = { idToken: null, refreshToken: null } }
export const getRefreshToken = () => session.refreshToken
export const setExpiredHandler = (fn) => { onExpired = fn }

let refreshing = null

// ID tokens last one hour: swap the refresh token for a new one when the API answers 401
export function refreshSession() {
  if (!session.refreshToken) return Promise.resolve(false)
  if (!refreshing) {
    refreshing = fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.idToken) return false
        setTokens({ idToken: d.idToken, refreshToken: d.refreshToken })
        return true
      })
      .catch(() => false)
      .finally(() => { refreshing = null })
  }
  return refreshing
}

// JSON request to the NexBus API with the user's token. Throws ApiError for HTTP errors.
export async function api(path, { method = 'GET', body } = {}) {
  // no-store: always ask the server. A response cached for another localhost port (e.g. the mobile web app on :8081)
  // carries that port's CORS header and would be reused here, which the browser then blocks.
  const run = () => fetch(`${API}${path}`, {
    method,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(session.idToken ? { Authorization: `Bearer ${session.idToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  let res
  try {
    res = await run()
    if (res.status === 401 && session.idToken && await refreshSession()) res = await run()
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection.', 0, 'NETWORK')
  }

  if (res.status === 401 && session.idToken) onExpired()
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.code, data?.details)
  return data
}
