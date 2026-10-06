import { useState } from 'react'
import { useAuth } from '../auth'
import { Button } from '../ui'
import { CalendarIcon, ChartIcon, EyeIcon, EyeOffIcon, LockIcon, MailIcon, PinIcon } from '../icons'

const DEMO_ACCOUNTS = [
  { role: 'Operator', email: 'operator@nexbus.lk', password: 'Operator@1234' },
  { role: 'Admin', email: 'admin@nexbus.lk', password: 'Admin@1234' },
]

const FEATURES = [
  { Icon: PinIcon, title: 'Live fleet tracking', text: 'Watch every bus move on the map in real time.' },
  { Icon: CalendarIcon, title: 'Trips & schedules', text: 'Plan routes, assign drivers and manage departures.' },
  { Icon: ChartIcon, title: 'Reports & audit logs', text: 'Bookings, revenue and a full activity trail.' },
]

function RouteArt() {
  return (
    <svg className="route-art" viewBox="0 0 420 220" fill="none" aria-hidden="true">
      <path id="route-path" d="M20 170 C 90 170, 90 60, 170 70 S 270 170, 330 110 S 380 40, 400 50" stroke="rgba(255,255,255,0.28)" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
      {[[20, 170], [170, 70], [330, 110], [400, 50]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="11" fill="rgba(255,255,255,0.14)" />
          <circle cx={x} cy={y} r="5" fill="#fff" />
        </g>
      ))}
      <g>
        <circle r="13" fill="#34d399" opacity="0.25">
          <animate attributeName="r" values="13;22;13" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.35;0;0.35" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle r="9" fill="#34d399" stroke="#fff" strokeWidth="3" />
        <animateMotion dur="9s" repeatCount="indefinite" rotate="0">
          <mpath href="#route-path" />
        </animateMotion>
      </g>
    </svg>
  )
}

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
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
      <aside className="login-hero">
        <div className="brand">
          <img className="brand-logo" src="/logo.png" alt="NexBus" />
        </div>

        <div className="hero-copy">
          <span className="hero-pill"><span className="live-dot" /> Fleet online</span>
          <h2>Run your fleet<br />with confidence.</h2>
          <p>One control room for operators and admins to track buses, schedule trips and keep every journey on time.</p>
        </div>

        <RouteArt />

        <ul className="feature-list">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <span className="feature-icon"><f.Icon /></span>
              <span><strong>{f.title}</strong><small>{f.text}</small></span>
            </li>
          ))}
        </ul>
      </aside>

      <main className="login-panel">
        <div className="login-card">
          <div className="brand brand-mobile">
            <img className="brand-logo" src="/logo.png" alt="NexBus" />
          </div>

          <h1>Welcome Back</h1>
          <p className="muted">Sign in to monitor your fleet and manage trips.</p>

          <form onSubmit={submit}>
            {error && <div className="error-box" role="alert">{error}</div>}

            <div className="field">
              <label className="field-label" htmlFor="login-email">Email address</label>
              <div className="input-wrap">
                <span className="input-icon"><MailIcon size={18} /></span>
                <input id="login-email" className="input input-icon-left" type="email" placeholder="you@company.lk" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="login-password">Password</label>
              <div className="input-wrap">
                <span className="input-icon"><LockIcon size={18} /></span>
                <input id="login-password" className="input input-icon-left input-icon-right" type={showPw ? 'text' : 'password'} placeholder="Enter your password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" className="input-toggle" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
            </div>

            <Button type="submit" busy={busy} className="btn-block">{busy ? 'Signing in…' : 'Log in →'}</Button>
          </form>

          {import.meta.env.DEV && (
            <div className="demo-hint">
              <div className="demo-title">Demo accounts · development only</div>
              <div className="demo-list">
                {DEMO_ACCOUNTS.map((a) => (
                  <button key={a.role} type="button" className="demo-chip" onClick={() => { setEmail(a.email); setPassword(a.password); setError('') }}>
                    <strong>{a.role}</strong>
                    <span>{a.email}</span>
                  </button>
                ))}
              </div>
              <small>Click an account to fill the form.</small>
            </div>
          )}

          <p className="login-foot">© {new Date().getFullYear()} NEXBUS SYSTEMS INC.</p>
        </div>
      </main>
    </div>
  )
}
