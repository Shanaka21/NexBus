import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { API, api, setTokens, clearTokens, refreshSession, getRefreshToken, setExpiredHandler } from './api'
import { signInFirebase, signOutFirebase } from './firebase'

const AuthContext = createContext(null)
const STORAGE_KEY = 'nexbus_dashboard_session'
const ALLOWED_ROLES = ['operator', 'admin']

const readStored = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(() => !readStored()?.refreshToken)

  const logout = useCallback(() => {
    clearTokens()
    localStorage.removeItem(STORAGE_KEY)
    signOutFirebase()
    setUser(null)
  }, [])

  // Restore the session after a page reload
  useEffect(() => {
    setExpiredHandler(logout)
    const stored = readStored()
    if (!stored?.refreshToken) return

    setTokens({ refreshToken: stored.refreshToken })
    refreshSession().then(async (ok) => {
      if (!ok) { logout(); return }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: stored.user, refreshToken: getRefreshToken() }))
      setUser(stored.user)
      try {
        const { customToken } = await api('/auth/firebase-token')
        await signInFirebase(customToken)
      } catch { /* live listeners fall back to polling */ }
    }).finally(() => setReady(true))
  }, [logout])

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).catch(() => null)
    if (!res) throw new Error('Cannot reach the server. Check your connection.')
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Login failed')
    if (!ALLOWED_ROLES.includes(data.role)) {
      throw new Error('This dashboard is for bus operators and administrators. Passengers and drivers use the mobile app.')
    }

    setTokens({ idToken: data.idToken, refreshToken: data.refreshToken })
    const profile = { uid: data.uid, name: data.name, email: data.email, role: data.role, operator_id: data.operator_id }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: profile, refreshToken: data.refreshToken }))
    await signInFirebase(data.customToken)
    setUser(profile)
  }, [])

  const value = useMemo(() => ({ user, ready, login, logout }), [user, ready, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
