import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth'
import { BuildingIcon, BusIcon, CalendarIcon, ChartIcon, ChevronLeftIcon, GridIcon, LogoutIcon, MoonIcon, RadarIcon, RouteIcon, ShieldIcon, SunIcon, TicketIcon, UserIcon, UsersIcon } from '../icons'

const OPERATOR_NAV = [
  { to: '/', label: 'Overview', Icon: GridIcon, end: true },
  { to: '/fleet', label: 'Fleet Monitor', Icon: RadarIcon },
  { to: '/vehicles', label: 'Vehicles', Icon: BusIcon },
  { to: '/drivers', label: 'Drivers', Icon: UserIcon },
  { to: '/trips', label: 'Trips', Icon: CalendarIcon },
  { to: '/routes', label: 'Routes & Stops', Icon: RouteIcon },
  { to: '/bookings', label: 'Bookings & Payments', Icon: TicketIcon },
  { to: '/reports', label: 'Reports', Icon: ChartIcon },
]

const ADMIN_NAV = [
  { to: '/', label: 'Overview', Icon: GridIcon, end: true },
  { to: '/fleet', label: 'Fleet Monitor', Icon: RadarIcon },
  { to: '/routes', label: 'Routes & Stops', Icon: RouteIcon },
  { to: '/operators', label: 'Operators', Icon: BuildingIcon },
  { to: '/users', label: 'Users', Icon: UsersIcon },
  { to: '/logs', label: 'Audit Logs', Icon: ShieldIcon },
]

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?'

const read = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback } catch { return fallback } }
const write = (key, value) => { try { localStorage.setItem(key, value) } catch { /* storage unavailable */ } }

export default function Layout() {
  const { user, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(() => read('nexbus-sidebar', 'open') === 'closed')
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light')
  const nav = user.role === 'admin' ? ADMIN_NAV : OPERATOR_NAV

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    write('nexbus-theme', theme)
  }, [theme])

  const toggleSidebar = () => setCollapsed((c) => { write('nexbus-sidebar', c ? 'open' : 'closed'); return !c })

  return (
    <div className={`shell${collapsed ? ' collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src="/logo.png" alt="NexBus" />
          <img className="brand-logo-mark" src="/logo-mark.png" alt="NexBus" />
          <button className="collapse-btn" onClick={toggleSidebar} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand' : 'Collapse'}>
            <ChevronLeftIcon size={16} />
          </button>
        </div>
        <div className="nav-title">{user.role === 'admin' ? 'Administration' : 'Operations'}</div>
        {nav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} title={item.label} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <item.Icon size={19} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <div className="sidebar-foot">
          <div className="user-chip">
            <div className="avatar">{initials(user.name)}</div>
            <div className="user-meta">
              <strong>{user.name}</strong>
              <span>{user.role}</span>
            </div>
          </div>
          <div className="foot-actions">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title={theme === 'dark' ? 'Light mode' : 'Dark mode'} aria-label="Toggle theme">
              {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
            </button>
            <button onClick={logout} title="Sign out"><LogoutIcon size={16} /><span>Sign out</span></button>
          </div>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
