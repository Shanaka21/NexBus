import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { ToastProvider, Spinner } from './ui'
import Layout from './pages/Layout'
import Login from './pages/Login'
import Overview from './pages/Overview'
import FleetMonitor from './pages/FleetMonitor'
import Vehicles from './pages/Vehicles'
import Drivers from './pages/Drivers'
import Trips from './pages/Trips'
import RoutesStops from './pages/RoutesStops'
import Bookings from './pages/Bookings'
import Reports from './pages/Reports'
import Operators from './pages/Operators'
import Users from './pages/Users'
import AuditLogs from './pages/AuditLogs'

// Sends visitors who are not signed in to the login page
function RequireAuth() {
  const { user, ready } = useAuth()
  if (!ready) return <Spinner />
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

// Pages are limited to the roles that may use them (the API enforces the same rules)
function RequireRole({ roles }) {
  const { user } = useAuth()
  return roles.includes(user.role) ? <Outlet /> : <Navigate to="/" replace />
}

function LoginRoute() {
  const { user, ready } = useAuth()
  if (!ready) return <Spinner />
  return user ? <Navigate to="/" replace /> : <Login />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route index element={<Overview />} />
                <Route path="fleet" element={<FleetMonitor />} />
                <Route path="routes" element={<RoutesStops />} />

                <Route element={<RequireRole roles={['operator']} />}>
                  <Route path="vehicles" element={<Vehicles />} />
                  <Route path="drivers" element={<Drivers />} />
                  <Route path="trips" element={<Trips />} />
                  <Route path="bookings" element={<Bookings />} />
                  <Route path="reports" element={<Reports />} />
                </Route>

                <Route element={<RequireRole roles={['admin']} />}>
                  <Route path="operators" element={<Operators />} />
                  <Route path="users" element={<Users />} />
                  <Route path="logs" element={<AuditLogs />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
