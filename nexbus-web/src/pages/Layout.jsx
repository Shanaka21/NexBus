import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth'

const OPERATOR_NAV = [
  { to: '/', label: 'Overview', icon: '▦', end: true },
  { to: '/fleet', label: 'Fleet Monitor', icon: '◉' },
  { to: '/vehicles', label: 'Vehicles', icon: '🚌' },
  { to: '/drivers', label: 'Drivers', icon: '👤' },
  { to: '/trips', label: 'Trips', icon: '🗓' },
  { to: '/routes', label: 'Routes & Stops', icon: '⌖' },
  { to: '/bookings', label: 'Bookings & Payments', icon: '🎫' },
  { to: '/reports', label: 'Reports', icon: '📊' },
]

const ADMIN_NAV = [
  { to: '/', label: 'Overview', icon: '▦', end: true },
  { to: '/fleet', label: 'Fleet Monitor', icon: '◉' },
  { to: '/routes', label: 'Routes & Stops', icon: '⌖' },
  { to: '/operators', label: 'Operators', icon: '🏢' },
  { to: '/users', label: 'Users', icon: '👥' },
  { to: '/logs', label: 'Audit Logs', icon: '🛡' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const nav = user.role === 'admin' ? ADMIN_NAV : OPERATOR_NAV

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">🚌</div>
          <div className="brand-name">NexBus</div>
        </div>
        <div className="nav-title">{user.role === 'admin' ? 'Administration' : 'Operations'}</div>
        {nav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
        <div className="sidebar-foot">
          <strong>{user.name}</strong>
          <span>{user.role}</span>
          <button onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
