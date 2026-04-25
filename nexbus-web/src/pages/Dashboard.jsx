import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { collection, onSnapshot } from 'firebase/firestore'
import { ref, onValue } from 'firebase/database'
import { db, rtdb } from '../firebase'

const API = 'http://localhost:5000'

// Fix Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const STATUS_CFG = {
  active:    { label: 'ACTIVE',    color: '#4caf50', bg: '#e8f5e9' },
  delayed:   { label: 'DELAYED',   color: '#ff9800', bg: '#fff3e0' },
  emergency: { label: 'EMERGENCY', color: '#f44336', bg: '#ffebee' },
  inactive:  { label: 'INACTIVE',  color: '#888',    bg: '#f5f5f5' },
  on_route:  { label: 'ON ROUTE',  color: '#1a3cff', bg: '#e8edff' },
}
const statusCfg = (s) => STATUS_CFG[s] || STATUS_CFG.inactive

const createBusIcon = (color) => L.divIcon({
  className: 'custom-bus-marker',
  html: `<div style="background:${color};width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
      <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10z"/>
    </svg>
  </div>`,
  iconSize: [36, 36], iconAnchor: [18, 18],
})

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  return res.json()
}

// ─── Shared Modal Shell ───────────────────────────────────────────────────────
function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, width }} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>{title}</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={s.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

function Input({ ...props }) {
  return <input style={s.input} {...props} />
}

function Select({ value, onChange, options }) {
  return (
    <select style={s.input} value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function PrimaryBtn({ onClick, disabled, children, danger }) {
  return (
    <button
      style={{
        ...s.primaryBtn,
        backgroundColor: danger ? '#f44336' : '#1a3cff',
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function GhostBtn({ onClick, children }) {
  return <button style={s.ghostBtn} onClick={onClick}>{children}</button>
}

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────
function OverviewTab({ buses, locations, stats }) {
  const [selectedBus, setSelectedBus] = useState(null)
  const [fleetModalOpen, setFleetModalOpen] = useState(false)
  const [updatingBus, setUpdatingBus] = useState(null)
  const [newStatus, setNewStatus] = useState('')
  const [saving, setSaving] = useState(false)

  const mapMarkers = buses
    .map(bus => {
      const key = `bus_${(bus.bus_number || '').replace('-', '')}`
      const gps = locations[key]
      if (!gps?.lat || !gps?.lng) return null
      return { ...bus, position: [gps.lat, gps.lng] }
    })
    .filter(Boolean)

  const handleUpdateStatus = async () => {
    if (!updatingBus || !newStatus) return
    setSaving(true)
    try {
      await apiFetch(`/buses/${updatingBus.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      })
      setFleetModalOpen(false)
      setUpdatingBus(null)
    } catch (e) {
      alert('Failed to update status')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.overviewLayout}>
      {/* Map */}
      <div style={s.mapWrap}>
        <MapContainer center={[6.88, 79.88]} zoom={11} style={{ width: '100%', height: '100%' }} zoomControl={false}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          {mapMarkers.map(bus => (
            <Marker
              key={bus.id}
              position={bus.position}
              icon={createBusIcon(statusCfg(bus.status).color)}
              eventHandlers={{ click: () => setSelectedBus(bus) }}
            >
              <Popup>
                <div style={{ fontWeight: 'bold', fontSize: 14 }}>Bus {bus.bus_number}</div>
                <div style={{ fontSize: 12, color: '#666' }}>Route {bus.route_number}</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  <span style={{
                    backgroundColor: statusCfg(bus.status).bg,
                    color: statusCfg(bus.status).color,
                    padding: '2px 8px', borderRadius: 12, fontWeight: 'bold', fontSize: 11,
                  }}>
                    {statusCfg(bus.status).label}
                  </span>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        {mapMarkers.length === 0 && (
          <div style={s.noGpsOverlay}>
            No live GPS data — POST to /buses/location to place buses on map
          </div>
        )}

        {/* Stats bar inside map area */}
        <div style={s.statsBar}>
          {[
            { label: 'TOTAL BUSES', value: stats?.buses?.total ?? buses.length, color: '#1a1a4e' },
            { label: 'ACTIVE', value: stats?.buses?.active ?? 0, color: '#4caf50' },
            { label: 'DELAYED', value: stats?.buses?.delayed ?? 0, color: '#ff9800' },
            { label: 'EMERGENCY', value: stats?.buses?.emergency ?? 0, color: '#f44336' },
            { label: 'TODAY\'S BOOKINGS', value: stats?.bookings?.today ?? 0, color: '#1a3cff' },
          ].map((item, i, arr) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={s.statItem}>
                <span style={s.statLabel}>{item.label}</span>
                <span style={{ ...s.statNumber, color: item.color }}>{item.value}</span>
              </div>
              {i < arr.length - 1 && <div style={s.statDivider} />}
            </div>
          ))}
        </div>
      </div>

      {/* Right Fleet Panel */}
      <div style={s.fleetPanel}>
        <div style={s.panelHeader}>
          <span style={s.panelTitle}>Live Fleet</span>
          <button style={s.manageBtn} onClick={() => setFleetModalOpen(true)}>Manage</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {buses.length === 0 && (
            <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 24 }}>Loading...</div>
          )}
          {buses.map(bus => {
            const cfg = statusCfg(bus.status)
            return (
              <div
                key={bus.id}
                style={{
                  ...s.busCard,
                  border: selectedBus?.id === bus.id ? '2px solid #1a3cff' : '1.5px solid #eee',
                  backgroundColor: selectedBus?.id === bus.id ? '#f0f4ff' : '#fff',
                }}
                onClick={() => setSelectedBus(bus)}
              >
                <div style={s.busIconBox}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={cfg.color}>
                    <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10z"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={s.busName}>{bus.bus_number || bus.id}</div>
                  <div style={s.busRouteLbl}>Route {bus.route_number}</div>
                </div>
                <div style={{ ...s.badge, backgroundColor: cfg.bg, color: cfg.color }}>{cfg.label}</div>
              </div>
            )
          })}
        </div>

        {/* Summary table */}
        <div style={s.fleetTable}>
          <div style={s.tableSectionTitle}>FLEET STATUS OVERVIEW</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['BUS', 'ROUTE', 'CAPACITY', 'STATUS'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buses.map(bus => {
                const cfg = statusCfg(bus.status)
                return (
                  <tr
                    key={bus.id}
                    style={{ borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }}
                    onClick={() => setSelectedBus(bus)}
                  >
                    <td style={s.td}>{bus.bus_number || bus.id}</td>
                    <td style={s.td}>{bus.route_number}</td>
                    <td style={s.td}>{bus.capacity || '—'}</td>
                    <td style={s.td}>
                      <span style={{
                        display: 'inline-block', width: 8, height: 8,
                        borderRadius: '50%', backgroundColor: cfg.color, marginRight: 5,
                      }} />
                      {cfg.label}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fleet Manager Modal */}
      {fleetModalOpen && (
        <Modal title="Fleet Manager — Update Bus Status" onClose={() => setFleetModalOpen(false)} width={520}>
          <div style={{ maxHeight: 360, overflowY: 'auto', padding: '0 4px' }}>
            {buses.map(bus => (
              <div key={bus.id} style={s.fleetRow}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{bus.bus_number}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>Route {bus.route_number}</div>
                </div>
                <div style={{ ...s.badge, ...statusCfg(bus.status) }}>{statusCfg(bus.status).label}</div>
                <button
                  style={s.editStatusBtn}
                  onClick={() => { setUpdatingBus(bus); setNewStatus(bus.status) }}
                >
                  Change
                </button>
              </div>
            ))}
          </div>
          {updatingBus && (
            <div style={s.statusEditBox}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Change status for {updatingBus.bus_number}</div>
              <Select
                value={newStatus}
                onChange={setNewStatus}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'delayed', label: 'Delayed' },
                  { value: 'emergency', label: 'Emergency' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <PrimaryBtn onClick={handleUpdateStatus} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Status'}
                </PrimaryBtn>
                <GhostBtn onClick={() => setUpdatingBus(null)}>Cancel</GhostBtn>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

// ─── ROUTES TAB ───────────────────────────────────────────────────────────────
function RoutesTab() {
  const [routes, setRoutes] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'add' | 'edit'
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ route_number: '', route_name: '', start_point: '', end_point: '', via: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/routes')
      setRoutes(Array.isArray(data) ? data : [])
    } catch {
      setRoutes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setForm({ route_number: '', route_name: '', start_point: '', end_point: '', via: '' })
    setEditing(null)
    setModal('add')
  }

  const openEdit = (route) => {
    setForm({
      route_number: route.route_number || '',
      route_name: route.route_name || '',
      start_point: route.start_point || '',
      end_point: route.end_point || '',
      via: route.via || '',
    })
    setEditing(route)
    setModal('edit')
  }

  const handleSave = async () => {
    if (!form.route_number || !form.start_point || !form.end_point) {
      alert('Route number, start point, and end point are required.')
      return
    }
    setSaving(true)
    try {
      if (modal === 'add') {
        await apiFetch('/routes', { method: 'POST', body: JSON.stringify(form) })
      } else {
        await apiFetch(`/routes/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
      }
      setModal(null)
      load()
    } catch {
      alert('Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this route?')) return
    setDeleting(id)
    try {
      await apiFetch(`/routes/${id}`, { method: 'DELETE' })
      load()
    } catch {
      alert('Delete failed.')
    } finally {
      setDeleting(null)
    }
  }

  const filtered = routes.filter(r =>
    r.route_number?.includes(search) ||
    r.route_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.start_point?.toLowerCase().includes(search.toLowerCase()) ||
    r.end_point?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={s.tabContent}>
      <div style={s.tabHeader}>
        <div>
          <div style={s.tabTitle}>Routes</div>
          <div style={s.tabSubtitle}>{routes.length} routes configured</div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={s.searchBox}>
            <span style={{ color: '#aaa', fontSize: 14 }}>🔍</span>
            <input
              style={s.searchInput}
              placeholder="Search routes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <PrimaryBtn onClick={openAdd}>+ Add Route</PrimaryBtn>
        </div>
      </div>

      <div style={s.tableCard}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fc' }}>
              {['#', 'Route No.', 'Name', 'From', 'To', 'Via', 'Actions'].map(h => (
                <th key={h} style={s.thFull}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#aaa' }}>Loading routes...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#aaa' }}>No routes found.</td></tr>
            )}
            {filtered.map((route, i) => (
              <tr key={route.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={s.tdFull}>{i + 1}</td>
                <td style={s.tdFull}>
                  <span style={s.routeNumBadge}>{route.route_number}</span>
                </td>
                <td style={{ ...s.tdFull, fontWeight: 600 }}>{route.route_name || '—'}</td>
                <td style={s.tdFull}>{route.start_point}</td>
                <td style={s.tdFull}>{route.end_point}</td>
                <td style={{ ...s.tdFull, color: '#888' }}>{route.via || '—'}</td>
                <td style={s.tdFull}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={s.editBtn} onClick={() => openEdit(route)}>Edit</button>
                    <button
                      style={s.deleteBtn}
                      onClick={() => handleDelete(route.id)}
                      disabled={deleting === route.id}
                    >
                      {deleting === route.id ? '…' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'Add New Route' : 'Edit Route'} onClose={() => setModal(null)}>
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Route Number *">
                <Input
                  value={form.route_number}
                  onChange={e => setForm(f => ({ ...f, route_number: e.target.value }))}
                  placeholder="e.g. 48"
                />
              </Field>
              <Field label="Route Name">
                <Input
                  value={form.route_name}
                  onChange={e => setForm(f => ({ ...f, route_name: e.target.value }))}
                  placeholder="e.g. Fort – Kandy Express"
                />
              </Field>
              <Field label="Start Point *">
                <Input
                  value={form.start_point}
                  onChange={e => setForm(f => ({ ...f, start_point: e.target.value }))}
                  placeholder="e.g. Fort"
                />
              </Field>
              <Field label="End Point *">
                <Input
                  value={form.end_point}
                  onChange={e => setForm(f => ({ ...f, end_point: e.target.value }))}
                  placeholder="e.g. Kandy"
                />
              </Field>
            </div>
            <Field label="Via (stops)">
              <Input
                value={form.via}
                onChange={e => setForm(f => ({ ...f, via: e.target.value }))}
                placeholder="e.g. Kadugannawa, Peradeniya"
              />
            </Field>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <PrimaryBtn onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : modal === 'add' ? 'Create Route' : 'Save Changes'}
              </PrimaryBtn>
              <GhostBtn onClick={() => setModal(null)}>Cancel</GhostBtn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── BOOKINGS TAB ─────────────────────────────────────────────────────────────
function BookingsTab() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [acting, setActing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/bookings')
      setBookings(Array.isArray(data) ? data : [])
    } catch {
      setBookings([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const updateStatus = async (id, status) => {
    setActing(id + status)
    try {
      await apiFetch(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify({ status }) })
      load()
    } catch {
      alert('Failed to update booking.')
    } finally {
      setActing(null)
    }
  }

  const FILTERS = ['all', 'confirmed', 'completed', 'cancelled']
  const visible = bookings.filter(b => filter === 'all' || b.status === filter)

  const counts = {
    all: bookings.length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
  }

  return (
    <div style={s.tabContent}>
      <div style={s.tabHeader}>
        <div>
          <div style={s.tabTitle}>Bookings</div>
          <div style={s.tabSubtitle}>{bookings.length} total bookings</div>
        </div>
        <button style={s.refreshBtn} onClick={load}>↻ Refresh</button>
      </div>

      {/* Filter tabs */}
      <div style={s.filterRow}>
        {FILTERS.map(f => (
          <button
            key={f}
            style={{ ...s.filterTab, ...(filter === f ? s.filterTabActive : {}) }}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span style={{
              ...s.filterCount,
              backgroundColor: filter === f ? '#1a3cff' : '#f0f0f0',
              color: filter === f ? '#fff' : '#888',
            }}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      <div style={s.tableCard}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fc' }}>
              {['Booking ID', 'User', 'Route', 'From → To', 'Date', 'Seats', 'Fare', 'Status', 'Actions'].map(h => (
                <th key={h} style={s.thFull}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: '#aaa' }}>Loading bookings...</td></tr>
            )}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: '#aaa' }}>No bookings found.</td></tr>
            )}
            {visible.map(b => {
              const cfg = statusCfg(b.status)
              const isActing = acting?.startsWith(b.id)
              return (
                <tr key={b.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ ...s.tdFull, fontFamily: 'monospace', fontSize: 12, color: '#888' }}>
                    {b.id.slice(0, 8)}…
                  </td>
                  <td style={s.tdFull}>{b.user_id?.slice(0, 10) || '—'}</td>
                  <td style={s.tdFull}>
                    <span style={s.routeNumBadge}>{b.route}</span>
                  </td>
                  <td style={{ ...s.tdFull, fontWeight: 500 }}>{b.from} → {b.to}</td>
                  <td style={{ ...s.tdFull, color: '#666' }}>{b.date}</td>
                  <td style={s.tdFull}>{b.seats}</td>
                  <td style={{ ...s.tdFull, fontWeight: 600 }}>{b.fare || '—'}</td>
                  <td style={s.tdFull}>
                    <span style={{ ...s.badge, backgroundColor: cfg.bg, color: cfg.color }}>
                      {(b.status || '').toUpperCase()}
                    </span>
                  </td>
                  <td style={s.tdFull}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {b.status === 'confirmed' && (
                        <>
                          <button
                            style={s.completeBtn}
                            disabled={isActing}
                            onClick={() => updateStatus(b.id, 'completed')}
                          >
                            {isActing ? '…' : 'Complete'}
                          </button>
                          <button
                            style={s.cancelBtnSm}
                            disabled={isActing}
                            onClick={() => updateStatus(b.id, 'cancelled')}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {b.status !== 'confirmed' && (
                        <span style={{ color: '#ccc', fontSize: 12 }}>—</span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── ANALYTICS TAB ────────────────────────────────────────────────────────────
function AnalyticsTab({ stats, buses }) {
  const b = stats?.buses || {}
  const bk = stats?.bookings || {}

  const busTotal = b.total || 1
  const bkTotal = bk.total || 1

  const busRows = [
    { label: 'Active',    value: b.active    || 0, color: '#4caf50' },
    { label: 'Delayed',   value: b.delayed   || 0, color: '#ff9800' },
    { label: 'Emergency', value: b.emergency || 0, color: '#f44336' },
    { label: 'Inactive',  value: b.inactive  || 0, color: '#888' },
  ]

  const bkRows = [
    { label: 'Confirmed', value: bk.confirmed || 0, color: '#1a3cff' },
    { label: 'Completed', value: bk.completed || 0, color: '#4caf50' },
    { label: 'Cancelled', value: bk.cancelled || 0, color: '#f44336' },
  ]

  // Route popularity from buses
  const routeCounts = {}
  buses.forEach(bus => {
    const r = bus.route_number || 'Unknown'
    routeCounts[r] = (routeCounts[r] || 0) + 1
  })
  const routeRows = Object.entries(routeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([route, count]) => ({ label: `Route ${route}`, value: count, color: '#1a3cff' }))
  const routeMax = routeRows[0]?.value || 1

  return (
    <div style={s.tabContent}>
      <div style={s.tabHeader}>
        <div>
          <div style={s.tabTitle}>Analytics</div>
          <div style={s.tabSubtitle}>Fleet and booking performance overview</div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={s.kpiGrid}>
        {[
          { label: 'Total Buses', value: b.total ?? '—', color: '#1a3cff', icon: '🚌' },
          { label: 'Total Bookings', value: bk.total ?? '—', color: '#4caf50', icon: '🎟️' },
          { label: 'Today\'s Bookings', value: bk.today ?? '—', color: '#ff9800', icon: '📅' },
          { label: 'Active Buses', value: b.active ?? '—', color: '#4caf50', icon: '✅' },
          { label: 'Cancelled Bookings', value: bk.cancelled ?? '—', color: '#f44336', icon: '❌' },
          { label: 'Emergency Alerts', value: b.emergency ?? '—', color: '#f44336', icon: '🚨' },
        ].map(card => (
          <div key={card.label} style={s.kpiCard}>
            <div style={s.kpiIcon}>{card.icon}</div>
            <div style={{ ...s.kpiValue, color: card.color }}>{card.value}</div>
            <div style={s.kpiLabel}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={s.chartGrid}>
        {/* Bus Status Chart */}
        <div style={s.chartCard}>
          <div style={s.chartTitle}>Bus Status Breakdown</div>
          {busRows.map(row => (
            <div key={row.label} style={s.barRow}>
              <div style={s.barLabel}>{row.label}</div>
              <div style={s.barTrack}>
                <div style={{
                  ...s.barFill,
                  width: `${Math.round((row.value / busTotal) * 100)}%`,
                  backgroundColor: row.color,
                }} />
              </div>
              <div style={s.barValue}>{row.value}</div>
            </div>
          ))}
        </div>

        {/* Booking Status Chart */}
        <div style={s.chartCard}>
          <div style={s.chartTitle}>Booking Status Breakdown</div>
          {bkRows.map(row => (
            <div key={row.label} style={s.barRow}>
              <div style={s.barLabel}>{row.label}</div>
              <div style={s.barTrack}>
                <div style={{
                  ...s.barFill,
                  width: `${Math.round((row.value / bkTotal) * 100)}%`,
                  backgroundColor: row.color,
                }} />
              </div>
              <div style={s.barValue}>{row.value}</div>
            </div>
          ))}
        </div>

        {/* Route Popularity */}
        <div style={{ ...s.chartCard, gridColumn: '1 / -1' }}>
          <div style={s.chartTitle}>Buses per Route (Fleet Distribution)</div>
          {routeRows.length === 0 && (
            <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 16 }}>No fleet data yet.</div>
          )}
          {routeRows.map(row => (
            <div key={row.label} style={s.barRow}>
              <div style={{ ...s.barLabel, width: 80 }}>{row.label}</div>
              <div style={s.barTrack}>
                <div style={{
                  ...s.barFill,
                  width: `${Math.round((row.value / routeMax) * 100)}%`,
                  backgroundColor: row.color,
                }} />
              </div>
              <div style={s.barValue}>{row.value} bus{row.value !== 1 ? 'es' : ''}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeNav, setActiveNav] = useState('Overview')
  const [buses, setBuses] = useState([])
  const [locations, setLocations] = useState({})
  const [stats, setStats] = useState(null)

  const navItems = ['Overview', 'Routes', 'Bookings', 'Analytics']

  // Live Firestore vehicles
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'vehicles'), (snap) => {
      setBuses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    })
    return () => unsub()
  }, [])

  // Live RTDB GPS locations
  useEffect(() => {
    const locRef = ref(rtdb, 'locations')
    const unsub = onValue(locRef, (snap) => {
      setLocations(snap.val() || {})
    })
    return () => unsub()
  }, [])

  // Stats from backend
  useEffect(() => {
    apiFetch('/stats').then(setStats).catch(() => {})
    const interval = setInterval(() => {
      apiFetch('/stats').then(setStats).catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={s.container}>
      {/* Navbar */}
      <div style={s.navbar}>
        <div style={s.navLeft}>
          <div style={s.logo}>
            <div style={s.logoBox}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
                <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
              </svg>
            </div>
            <span style={s.logoText}>NexBus Admin</span>
          </div>
          <div style={s.navLinks}>
            {navItems.map(item => (
              <button
                key={item}
                style={{ ...s.navLink, ...(activeNav === item ? s.navLinkActive : {}) }}
                onClick={() => setActiveNav(item)}
              >
                {item}
                {activeNav === item && <div style={s.navUnderline} />}
              </button>
            ))}
          </div>
        </div>
        <div style={s.navRight}>
          <div style={s.liveIndicator}>
            <span style={s.liveDot} />
            Live
          </div>
          <div style={s.statPill}>🚌 {buses.length} Fleet</div>
          <div style={s.avatar}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#1a3cff">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div style={s.body}>
        {activeNav === 'Overview'   && <OverviewTab buses={buses} locations={locations} stats={stats} />}
        {activeNav === 'Routes'     && <RoutesTab />}
        {activeNav === 'Bookings'   && <BookingsTab />}
        {activeNav === 'Analytics'  && <AnalyticsTab stats={stats} buses={buses} />}
      </div>
    </div>
  )
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = {
  container:    { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f0f2f5', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  navbar:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', height: 60, backgroundColor: '#fff', borderBottom: '1px solid #eee', zIndex: 1001, flexShrink: 0 },
  navLeft:      { display: 'flex', alignItems: 'center', gap: 32 },
  logo:         { display: 'flex', alignItems: 'center', gap: 10 },
  logoBox:      { width: 34, height: 34, backgroundColor: '#1a3cff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoText:     { fontSize: 18, fontWeight: 'bold', color: '#1a1a4e' },
  navLinks:     { display: 'flex', gap: 4 },
  navLink:      { position: 'relative', padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#888', fontWeight: '500' },
  navLinkActive:{ color: '#1a3cff' },
  navUnderline: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, backgroundColor: '#1a3cff', borderRadius: 2 },
  navRight:     { display: 'flex', alignItems: 'center', gap: 12 },
  liveIndicator:{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#4caf50', fontWeight: 600 },
  liveDot:      { width: 8, height: 8, borderRadius: '50%', backgroundColor: '#4caf50', animation: 'pulse 2s infinite' },
  statPill:     { fontSize: 13, color: '#1a3cff', backgroundColor: '#f0f4ff', padding: '5px 12px', borderRadius: 20, fontWeight: 600 },
  avatar:       { width: 36, height: 36, borderRadius: '50%', backgroundColor: '#e8eeff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #1a3cff', cursor: 'pointer' },
  body:         { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },

  // Overview layout
  overviewLayout: { display: 'flex', flex: 1, overflow: 'hidden' },
  mapWrap:       { flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' },
  noGpsOverlay:  { position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(255,255,255,0.92)', padding: '8px 20px', borderRadius: 20, zIndex: 999, border: '1px solid #eee', fontSize: 13, color: '#888', whiteSpace: 'nowrap' },
  statsBar:      { display: 'flex', backgroundColor: '#fff', borderTop: '1px solid #eee', padding: '14px 24px', gap: 0, zIndex: 1000, flexShrink: 0 },
  statItem:      { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 },
  statLabel:     { fontSize: 10, color: '#aaa', letterSpacing: 1, marginBottom: 2, fontWeight: 600 },
  statNumber:    { fontSize: 26, fontWeight: 'bold' },
  statDivider:   { width: 1, backgroundColor: '#eee', margin: '0 8px' },

  // Fleet panel
  fleetPanel:   { width: 340, backgroundColor: '#fff', borderLeft: '1px solid #eee', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  panelHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 8px', borderBottom: '1px solid #f0f0f0' },
  panelTitle:   { fontSize: 16, fontWeight: 'bold', color: '#1a1a4e' },
  manageBtn:    { padding: '6px 14px', backgroundColor: '#f0f4ff', color: '#1a3cff', border: '1px solid #c8d6ff', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  busCard:      { display: 'flex', alignItems: 'center', gap: 10, margin: '4px 10px', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'all 0.15s' },
  busIconBox:   { width: 36, height: 36, backgroundColor: '#f0f4ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  busName:      { fontSize: 14, fontWeight: 'bold', color: '#1a1a4e' },
  busRouteLbl:  { fontSize: 12, color: '#888' },
  badge:        { padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 'bold', whiteSpace: 'nowrap' },
  fleetTable:   { padding: '10px 16px', borderTop: '1px solid #f0f0f0' },
  tableSectionTitle: { fontSize: 10, color: '#aaa', letterSpacing: 1, marginBottom: 8, fontWeight: 600 },
  th:           { fontSize: 11, color: '#888', textAlign: 'left', paddingBottom: 6, borderBottom: '1px solid #eee', fontWeight: 600 },
  td:           { padding: '8px 0', fontSize: 13, color: '#1a1a4e' },

  // Fleet manager modal internals
  fleetRow:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid #f5f5f5' },
  editStatusBtn:{ padding: '5px 14px', backgroundColor: '#f0f4ff', color: '#1a3cff', border: '1px solid #c8d6ff', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  statusEditBox:{ padding: '16px 20px', borderTop: '1px solid #eee', backgroundColor: '#f8f9fc' },

  // Tab content
  tabContent:   { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 28px', gap: 20 },
  tabHeader:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 },
  tabTitle:     { fontSize: 22, fontWeight: 'bold', color: '#1a1a4e' },
  tabSubtitle:  { fontSize: 14, color: '#888', marginTop: 2 },
  tableCard:    { backgroundColor: '#fff', borderRadius: 14, border: '1px solid #eee', overflow: 'auto', flex: 1 },
  thFull:       { fontSize: 11, color: '#888', textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid #eee', fontWeight: 700, letterSpacing: 0.5, whiteSpace: 'nowrap' },
  tdFull:       { padding: '12px 16px', fontSize: 13, color: '#1a1a4e', verticalAlign: 'middle' },
  routeNumBadge:{ backgroundColor: '#f0f4ff', color: '#1a3cff', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 },

  // Routes tab
  searchBox:    { display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#f5f5f5', borderRadius: 20, padding: '8px 16px', width: 220 },
  searchInput:  { border: 'none', background: 'none', outline: 'none', fontSize: 14, color: '#333', width: '100%' },
  editBtn:      { padding: '5px 14px', backgroundColor: '#f0f4ff', color: '#1a3cff', border: '1px solid #c8d6ff', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  deleteBtn:    { padding: '5px 14px', backgroundColor: '#fff5f5', color: '#f44336', border: '1px solid #ffcdd2', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600 },

  // Bookings tab
  filterRow:    { display: 'flex', gap: 8, flexShrink: 0 },
  filterTab:    { padding: '8px 18px', backgroundColor: '#fff', border: '1.5px solid #eee', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#888', display: 'flex', alignItems: 'center', gap: 8 },
  filterTabActive: { borderColor: '#1a3cff', color: '#1a3cff', backgroundColor: '#f0f4ff' },
  filterCount:  { fontSize: 11, padding: '1px 7px', borderRadius: 20, fontWeight: 700 },
  refreshBtn:   { padding: '8px 18px', backgroundColor: '#f0f4ff', color: '#1a3cff', border: '1px solid #c8d6ff', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  completeBtn:  { padding: '4px 12px', backgroundColor: '#e8f5e9', color: '#4caf50', border: '1px solid #c8e6c9', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 700 },
  cancelBtnSm:  { padding: '4px 12px', backgroundColor: '#fff5f5', color: '#f44336', border: '1px solid #ffcdd2', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 700 },

  // Analytics
  kpiGrid:      { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, flexShrink: 0 },
  kpiCard:      { backgroundColor: '#fff', borderRadius: 14, padding: '20px 16px', textAlign: 'center', border: '1px solid #eee' },
  kpiIcon:      { fontSize: 24, marginBottom: 8 },
  kpiValue:     { fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
  kpiLabel:     { fontSize: 11, color: '#aaa', fontWeight: 600, letterSpacing: 0.5 },
  chartGrid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, flex: 1, overflow: 'auto' },
  chartCard:    { backgroundColor: '#fff', borderRadius: 14, padding: 20, border: '1px solid #eee' },
  chartTitle:   { fontSize: 14, fontWeight: 'bold', color: '#1a1a4e', marginBottom: 16 },
  barRow:       { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  barLabel:     { fontSize: 12, color: '#666', width: 70, flexShrink: 0 },
  barTrack:     { flex: 1, height: 10, backgroundColor: '#f0f0f0', borderRadius: 5, overflow: 'hidden' },
  barFill:      { height: '100%', borderRadius: 5, minWidth: 4, transition: 'width 0.4s' },
  barValue:     { fontSize: 12, color: '#1a1a4e', fontWeight: 600, width: 60, textAlign: 'right', flexShrink: 0 },

  // Modal
  overlay:      { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  modal:        { backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid #eee' },
  modalTitle:   { fontSize: 16, fontWeight: 'bold', color: '#1a1a4e' },
  closeBtn:     { border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#888', padding: '0 4px' },
  fieldLabel:   { display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6, letterSpacing: 0.3 },
  input:        { width: '100%', padding: '10px 14px', border: '1.5px solid #e0e0e0', borderRadius: 10, fontSize: 14, color: '#1a1a4e', outline: 'none', boxSizing: 'border-box', backgroundColor: '#fafafa' },
  primaryBtn:   { padding: '10px 22px', backgroundColor: '#1a3cff', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  ghostBtn:     { padding: '10px 22px', backgroundColor: '#f5f5f5', color: '#555', border: '1.5px solid #ddd', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
}
