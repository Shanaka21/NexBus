import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { collection, onSnapshot } from 'firebase/firestore'
import { ref, onValue } from 'firebase/database'
import { db, rtdb } from '../firebase'

// Fix Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const statusConfig = {
  on_time:   { label: 'ON TIME',   color: '#4caf50', bg: '#e8f5e9' },
  delayed:   { label: 'DELAYED',   color: '#ff9800', bg: '#fff3e0' },
  emergency: { label: 'EMERGENCY', color: '#f44336', bg: '#ffebee' },
  offline:   { label: 'OFFLINE',   color: '#888',    bg: '#f5f5f5' },
}

const getStatusKey = (status) => {
  if (status === 'active' || status === 'on_route') return 'on_time'
  if (status === 'delayed') return 'delayed'
  if (status === 'emergency') return 'emergency'
  return 'offline'
}

const createBusIcon = (color) => L.divIcon({
  className: 'custom-bus-marker',
  html: `<div style="
    background: ${color};
    width: 36px; height: 36px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  ">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
      <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10z"/>
    </svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

export default function Dashboard() {
  const [activeNav, setActiveNav] = useState('Overview')
  const [selectedBus, setSelectedBus] = useState(null)
  const [activeSidebar, setActiveSidebar] = useState(0)
  const [buses, setBuses] = useState([])
  const [locations, setLocations] = useState({})
  const navItems = ['Overview', 'Routes', 'Drivers', 'Analytics']

  // Live Firestore listener for vehicles
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'vehicles'), (snap) => {
      setBuses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    })
    return () => unsub()
  }, [])

  // Live Realtime Database listener for GPS locations
  useEffect(() => {
    const locRef = ref(rtdb, 'locations')
    const unsub = onValue(locRef, (snap) => {
      setLocations(snap.val() || {})
    })
    return () => unsub()
  }, [])

  // Join vehicles with GPS for map markers
  // RTDB key format: bus_ND8645 (bus_number "ND-8645" with dash removed)
  const mapMarkers = buses
    .map(bus => {
      const key = `bus_${(bus.bus_number || '').replace('-', '')}`
      const gps = locations[key]
      if (!gps?.lat || !gps?.lng) return null
      return { ...bus, position: [gps.lat, gps.lng] }
    })
    .filter(Boolean)

  // Stats computed from live data
  const activeCount  = buses.filter(b => b.status !== 'offline').length
  const onTimeCount  = buses.filter(b => b.status === 'active' || b.status === 'on_route').length
  const delayedCount = buses.filter(b => b.status === 'delayed').length
  const emergencyCount = buses.filter(b => b.status === 'emergency').length

  return (
    <div style={styles.container}>

      {/* Top Navbar */}
      <div style={styles.navbar}>
        <div style={styles.navLeft}>
          <div style={styles.logo}>
            <div style={styles.logoBox}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
                <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
              </svg>
            </div>
            <span style={styles.logoText}>NexBus</span>
          </div>
          <div style={styles.navLinks}>
            {navItems.map(item => (
              <button
                key={item}
                style={{ ...styles.navLink, ...(activeNav === item ? styles.navLinkActive : {}) }}
                onClick={() => setActiveNav(item)}
              >
                {item}
                {activeNav === item && <div style={styles.navUnderline} />}
              </button>
            ))}
          </div>
        </div>
        <div style={styles.navRight}>
          <div style={styles.searchBar}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#888">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input style={styles.searchInput} placeholder="Search vehicle ID..." />
          </div>
          <button style={styles.addRouteBtn}>+ Add Route</button>
          <button style={styles.manageBusesBtn}>⚙ Manage Buses</button>
          <div style={styles.avatar}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#1a3cff">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.main}>

        {/* Left Sidebar */}
        <div style={styles.leftSidebar}>
          {[
            { icon: 'M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z' },
            { icon: 'M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z' },
            { icon: 'M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.54 8h-.07c-.58 0-1.1.32-1.37.84l-1.02 1.89c-.76-.58-1.68-.92-2.68-.92-1.05 0-2.02.38-2.79 1L5 5.85V5.5A1.5 1.5 0 0 0 3.5 4 1.5 1.5 0 0 0 2 5.5v13C2 19.33 2.67 20 3.5 20h17c.83 0 1.5-.67 1.5-1.5V22h-2z' },
            { icon: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z' },
            { icon: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94 0 .31.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z' },
          ].map((item, i) => (
            <button
              key={i}
              style={{ ...styles.sidebarBtn, backgroundColor: activeSidebar === i ? '#f0f4ff' : 'transparent' }}
              onClick={() => setActiveSidebar(i)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill={activeSidebar === i ? '#1a3cff' : '#888'}>
                <path d={item.icon}/>
              </svg>
            </button>
          ))}
        </div>

        {/* Map Area */}
        <div style={styles.mapArea}>
          <div style={styles.mapPlaceholder}>
            <MapContainer center={[6.88, 79.88]} zoom={11} style={styles.mapFrame} zoomControl={false}>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              />
              {mapMarkers.map(bus => {
                const sk = getStatusKey(bus.status)
                return (
                  <Marker
                    key={bus.id}
                    position={bus.position}
                    icon={createBusIcon(statusConfig[sk].color)}
                    eventHandlers={{ click: () => setSelectedBus(bus) }}
                  >
                    <Popup>
                      <div style={{ fontWeight: 'bold', fontSize: 14 }}>Bus {bus.bus_number}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>Route {bus.route_number}</div>
                    </Popup>
                  </Marker>
                )
              })}
            </MapContainer>

            {mapMarkers.length === 0 && (
              <div style={styles.noGpsOverlay}>
                <span style={{ fontSize: 13, color: '#888' }}>
                  No GPS data yet — POST to /buses/location to place buses on the map
                </span>
              </div>
            )}
          </div>

          {/* Bottom Stats Bar */}
          <div style={styles.statsBar}>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>ACTIVE BUSES</span>
              <span style={{ ...styles.statNumber, color: '#1a1a4e' }}>{activeCount}</span>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.statItem}>
              <span style={styles.statLabel}>ON SCHEDULE</span>
              <span style={{ ...styles.statNumber, color: '#4caf50' }}>{onTimeCount}</span>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.statItem}>
              <span style={styles.statLabel}>DELAYED</span>
              <span style={{ ...styles.statNumber, color: '#ff9800' }}>{delayedCount}</span>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.statItem}>
              <span style={styles.statLabel}>EMERGENCY</span>
              <span style={{ ...styles.statNumber, color: '#f44336' }}>{emergencyCount}</span>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div style={styles.rightPanel}>
          <div style={styles.fleetHeader}>
            <span style={styles.fleetTitle}>Live Fleet View</span>
            <span style={styles.activeCount}>{activeCount} Active</span>
          </div>

          {buses.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#aaa', padding: '24px 0', fontSize: 13 }}>
              Loading fleet data...
            </div>
          ) : (
            buses.map(bus => {
              const sk = getStatusKey(bus.status)
              return (
                <div
                  key={bus.id}
                  style={{
                    ...styles.busCard,
                    border: selectedBus?.id === bus.id ? '2px solid #1a3cff' : '1px solid #eee',
                    backgroundColor: selectedBus?.id === bus.id ? '#f8f9ff' : '#fff',
                  }}
                  onClick={() => setSelectedBus(bus)}
                >
                  <div style={styles.busCardTop}>
                    <div style={styles.busIconBox}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#1a3cff">
                        <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10z"/>
                      </svg>
                    </div>
                    <div style={styles.busInfo}>
                      <div style={styles.busName}>{bus.bus_number || bus.id}</div>
                      <div style={styles.busRoute}>Route {bus.route_number}</div>
                    </div>
                    <div style={{
                      ...styles.statusBadge,
                      backgroundColor: statusConfig[sk].bg,
                      color: statusConfig[sk].color,
                    }}>
                      {statusConfig[sk].label}
                    </div>
                  </div>
                </div>
              )
            })
          )}

          <div style={styles.tableSection}>
            <div style={styles.tableTitle}>FLEET STATUS OVERVIEW</div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>BUS</th>
                  <th style={styles.th}>ROUTE</th>
                  <th style={styles.th}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {buses.map(bus => {
                  const sk = getStatusKey(bus.status)
                  return (
                    <tr
                      key={bus.id}
                      style={{
                        ...styles.tr,
                        backgroundColor: selectedBus?.id === bus.id ? '#f8f9ff' : 'transparent',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedBus(bus)}
                    >
                      <td style={styles.td}>{bus.bus_number || bus.id}</td>
                      <td style={styles.td}>{bus.route_number}</td>
                      <td style={styles.td}>
                        <div style={{
                          width: 10, height: 10, borderRadius: '50%',
                          backgroundColor: statusConfig[sk].color,
                          display: 'inline-block',
                        }} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <button style={styles.reportBtn}>📄 Generate Full Report</button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f0f2f5' },
  navbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0 24px', height: 60, backgroundColor: '#fff',
    borderBottom: '1px solid #eee', zIndex: 1001,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: 32 },
  logo: { display: 'flex', alignItems: 'center', gap: 10 },
  logoBox: {
    width: 34, height: 34, backgroundColor: '#1a3cff',
    borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 20, fontWeight: 'bold', color: '#1a1a4e' },
  navLinks: { display: 'flex', gap: 4 },
  navLink: {
    position: 'relative', padding: '8px 16px', border: 'none',
    background: 'none', cursor: 'pointer', fontSize: 14,
    color: '#888', fontWeight: '500',
  },
  navLinkActive: { color: '#1a3cff' },
  navUnderline: {
    position: 'absolute', bottom: -1, left: 0, right: 0,
    height: 2, backgroundColor: '#1a3cff', borderRadius: 2,
  },
  navRight: { display: 'flex', alignItems: 'center', gap: 12 },
  searchBar: {
    display: 'flex', alignItems: 'center', gap: 8,
    backgroundColor: '#f5f5f5', borderRadius: 20,
    padding: '8px 16px', width: 220,
  },
  searchInput: { border: 'none', background: 'none', outline: 'none', fontSize: 14, color: '#333', width: '100%' },
  addRouteBtn: {
    padding: '8px 18px', backgroundColor: '#1a3cff',
    color: '#fff', border: 'none', borderRadius: 20,
    cursor: 'pointer', fontSize: 13, fontWeight: '600',
  },
  manageBusesBtn: {
    padding: '8px 18px', backgroundColor: '#f0f4ff',
    color: '#1a3cff', border: '1px solid #1a3cff',
    borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: '600',
  },
  avatar: {
    width: 36, height: 36, borderRadius: '50%',
    backgroundColor: '#e8eeff', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    border: '2px solid #1a3cff', cursor: 'pointer',
  },
  main: { display: 'flex', flex: 1, overflow: 'hidden' },
  leftSidebar: {
    width: 56, backgroundColor: '#fff', borderRight: '1px solid #eee',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '16px 0', gap: 6, zIndex: 1000,
  },
  sidebarBtn: {
    width: 40, height: 40, border: 'none', cursor: 'pointer', borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  mapArea: { flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' },
  mapPlaceholder: { flex: 1, position: 'relative', overflow: 'hidden' },
  mapFrame: { width: '100%', height: '100%' },
  noGpsOverlay: {
    position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
    backgroundColor: 'rgba(255,255,255,0.9)', padding: '8px 16px',
    borderRadius: 20, zIndex: 999, border: '1px solid #eee',
  },
  statsBar: {
    display: 'flex', backgroundColor: '#fff',
    borderTop: '1px solid #eee', padding: '16px 24px', gap: 24, zIndex: 1000,
  },
  statItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 },
  statLabel: { fontSize: 11, color: '#888', letterSpacing: 1, marginBottom: 4 },
  statNumber: { fontSize: 28, fontWeight: 'bold' },
  statDivider: { width: 1, backgroundColor: '#eee' },
  rightPanel: {
    width: 340, backgroundColor: '#fff', borderLeft: '1px solid #eee',
    padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, zIndex: 1000,
  },
  fleetHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  fleetTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a4e' },
  activeCount: {
    fontSize: 12, color: '#4caf50', backgroundColor: '#e8f5e9',
    padding: '2px 10px', borderRadius: 20, fontWeight: '600',
  },
  busCard: { borderRadius: 12, padding: 12, cursor: 'pointer' },
  busCardTop: { display: 'flex', alignItems: 'center', gap: 10 },
  busIconBox: {
    width: 36, height: 36, backgroundColor: '#f0f4ff',
    borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  busInfo: { flex: 1 },
  busName: { fontSize: 14, fontWeight: 'bold', color: '#1a1a4e' },
  busRoute: { fontSize: 12, color: '#888' },
  statusBadge: { padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 'bold', whiteSpace: 'nowrap' },
  tableSection: { marginTop: 4 },
  tableTitle: { fontSize: 11, color: '#888', letterSpacing: 1, marginBottom: 10, fontWeight: '600' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { fontSize: 11, color: '#888', textAlign: 'left', paddingBottom: 8, borderBottom: '1px solid #eee', fontWeight: '600' },
  tr: { borderBottom: '1px solid #f5f5f5' },
  td: { padding: '10px 0', fontSize: 14, color: '#1a1a4e' },
  reportBtn: {
    width: '100%', padding: '14px', backgroundColor: '#fff',
    border: '1px solid #ddd', borderRadius: 10,
    cursor: 'pointer', fontSize: 14, fontWeight: '600', color: '#1a1a4e', marginTop: 4,
  },
}
