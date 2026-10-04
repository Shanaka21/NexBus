import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LIVE, ago, COLOMBO } from './format'

// Leaflet's default marker images are not found by bundlers; use the published ones for the "picked point" pin
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const busIcon = (color, text) => L.divIcon({
  className: '',
  html: `<div class="bus-marker" style="background:${color}">${text}</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
})

const numberIcon = (n) => L.divIcon({
  className: '',
  html: `<div class="bus-marker" style="background:#1f2a6b;width:26px;height:26px;font-size:12px">${n}</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
})

function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => { if (target) map.flyTo(target, Math.max(map.getZoom(), 13), { duration: 0.6 }) }, [target, map])
  return null
}

function FitBounds({ points }) {
  const map = useMap()
  const key = points.map((p) => p.join(',')).join('|')
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [30, 30] })
    else if (points.length === 1) map.setView(points[0], 13)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

function ClickPicker({ onPick }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) })
  return null
}

const Tiles = () => (
  <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
)

// Fleet map: one marker per bus that has a position, coloured by on-time / delayed / offline
export function FleetMap({ buses, selectedId, onSelect, className = 'map-box' }) {
  const withPosition = buses.filter((b) => b.lat != null && b.lng != null)
  const selected = withPosition.find((b) => b.id === selectedId)
  return (
    <div className={className}>
      <MapContainer center={COLOMBO} zoom={11} style={{ height: '100%', width: '100%' }}>
        <Tiles />
        {selected && <FlyTo target={[selected.lat, selected.lng]} />}
        {withPosition.map((b) => {
          const status = LIVE[b.live] || LIVE.offline
          return (
            <Marker
              key={b.id}
              position={[b.lat, b.lng]}
              icon={busIcon(status.color, b.route_number)}
              eventHandlers={{ click: () => onSelect?.(b.id) }}
            >
              <Popup>
                <strong>{b.registration_no}</strong> (route {b.route_number})<br />
                {status.label}{b.delay_minutes >= 10 ? ` · ${b.delay_minutes} min late` : ''}<br />
                updated {ago(b.last_update_at)}
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}

// Route preview / editor map: numbered stops joined by a line; optionally lets the user click to choose a point
export function StopsMap({ stops, onPick, pick, className = 'map-box small' }) {
  const points = stops.filter((s) => s.lat != null).map((s) => [s.lat, s.lng])
  return (
    <div className={className}>
      <MapContainer center={COLOMBO} zoom={11} style={{ height: '100%', width: '100%' }}>
        <Tiles />
        <FitBounds points={pick ? [...points, pick] : points} />
        {onPick && <ClickPicker onPick={onPick} />}
        {points.length > 1 && <Polyline positions={points} pathOptions={{ color: '#2f46d8', weight: 4 }} />}
        {stops.filter((s) => s.lat != null).map((s, i) => (
          <Marker key={`${s.stopId || s.id}-${i}`} position={[s.lat, s.lng]} icon={numberIcon(i + 1)}>
            <Popup>{s.name}</Popup>
          </Marker>
        ))}
        {pick && <Marker position={pick} />}
      </MapContainer>
    </div>
  )
}
