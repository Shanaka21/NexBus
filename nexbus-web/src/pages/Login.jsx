import { useState } from 'react'
import { useAuth } from '../auth'
import { Button, Field } from '../ui'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand">
          <div className="brand-mark">🚌</div>
          <div className="brand-name">NexBus</div>
        </div>
        <h1>Operator &amp; admin dashboard</h1>
        <p className="muted">Sign in to monitor your fleet and manage trips.</p>

        <form onSubmit={submit}>
          {error && <div className="error-box" role="alert">{error}</div>}
          <Field label="Email">
            <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password">
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Button type="submit" busy={busy}>Sign in</Button>
        </form>

        {import.meta.env.DEV && (
          <div className="demo-hint">
            Demo accounts (development only)<br />
            Operator: operator@nexbus.lk / Operator@1234<br />
            Admin: admin@nexbus.lk / Admin@1234
          </div>
        )}
      </div>
    </div>
  )
}
