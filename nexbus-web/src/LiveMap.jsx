import { useEffect, useState } from 'react'
import { APIProvider, Map, AdvancedMarker, InfoWindow, Pin, useMap } from '@vis.gl/react-google-maps'
import { LIVE, ago, COLOMBO } from './format'

// The key comes from nexbus-web/.env.local (VITE_GOOGLE_MAPS_API_KEY); see .env.example
const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
// A map id is required for AdvancedMarker; this is Google's built-in id for development maps
const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID'

const toLatLng = ([lat, lng]) => ({ lat, lng })
const CENTER = toLatLng(COLOMBO)

function Frame({ className, children, onClick }) {
  if (!KEY) {
    return (
      <div className={className} style={{ display: 'grid', placeItems: 'center', textAlign: 'center', padding: 16 }}>
        Set VITE_GOOGLE_MAPS_API_KEY in nexbus-web/.env.local to show the map.
      </div>
    )
  }
  return (
    <div className={className}>
      <APIProvider apiKey={KEY}>
        <Map
          mapId={MAP_ID}
          defaultCenter={CENTER}
          defaultZoom={11}
          gestureHandling="greedy"
          disableDefaultUI={false}
          style={{ height: '100%', width: '100%' }}
          onClick={onClick}
        >
          {children}
        </Map>
      </APIProvider>
    </div>
  )
}

function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (!map || !target) return
    map.panTo(toLatLng(target))
    if ((map.getZoom() || 0) < 13) map.setZoom(13)
  }, [target, map])
  return null
}

function FitBounds({ points }) {
  const map = useMap()
  const key = points.map((p) => p.join(',')).join('|')
  useEffect(() => {
    if (!map) return
    if (points.length > 1) {
      const bounds = new window.google.maps.LatLngBounds()
      points.forEach((p) => bounds.extend(toLatLng(p)))
      map.fitBounds(bounds, 30)
    } else if (points.length === 1) {
      map.setCenter(toLatLng(points[0]))
      map.setZoom(13)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

function Line({ points }) {
  const map = useMap()
  const key = points.map((p) => p.join(',')).join('|')
  useEffect(() => {
    if (!map || points.length < 2) return undefined
    const line = new window.google.maps.Polyline({
      path: points.map(toLatLng), strokeColor: '#2f46d8', strokeWeight: 4, map,
    })
    return () => line.setMap(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

// Fleet map: one marker per bus that has a position, coloured by on-time / delayed / offline
export function FleetMap({ buses, selectedId, onSelect, className = 'map-box' }) {
  const [openId, setOpenId] = useState(null)
  const withPosition = buses.filter((b) => b.lat != null && b.lng != null)
  const selected = withPosition.find((b) => b.id === selectedId)
  const open = withPosition.find((b) => b.id === openId)
  return (
    <Frame className={className} onClick={() => setOpenId(null)}>
      {selected && <FlyTo target={[selected.lat, selected.lng]} />}
      {withPosition.map((b) => {
        const status = LIVE[b.live] || LIVE.offline
        return (
          <AdvancedMarker
            key={b.id}
            position={{ lat: b.lat, lng: b.lng }}
            onClick={() => { setOpenId(b.id); onSelect?.(b.id) }}
          >
            <div className="bus-marker" style={{ background: status.color }}>{b.route_number}</div>
          </AdvancedMarker>
        )
      })}
      {open && (
        <InfoWindow position={{ lat: open.lat, lng: open.lng }} pixelOffset={[0, -18]} onCloseClick={() => setOpenId(null)}>
          <div style={{ color: '#111' }}>
            <strong>{open.registration_no}</strong> (route {open.route_number})<br />
            {(LIVE[open.live] || LIVE.offline).label}{open.delay_minutes >= 10 ? ` · ${open.delay_minutes} min late` : ''}<br />
            updated {ago(open.last_update_at)}
          </div>
        </InfoWindow>
      )}
    </Frame>
  )
}

// Route preview / editor map: numbered stops joined by a line; optionally lets the user click to choose a point
export function StopsMap({ stops, onPick, pick, className = 'map-box small' }) {
  const [openIdx, setOpenIdx] = useState(null)
  const placed = stops.filter((s) => s.lat != null)
  const points = placed.map((s) => [s.lat, s.lng])
  const open = openIdx != null ? placed[openIdx] : null
  return (
    <Frame
      className={className}
      onClick={(e) => {
        setOpenIdx(null)
        const ll = e.detail?.latLng
        if (onPick && ll) onPick([ll.lat, ll.lng])
      }}
    >
      <FitBounds points={pick ? [...points, pick] : points} />
      <Line points={points} />
      {placed.map((s, i) => (
        <AdvancedMarker key={`${s.stopId || s.id}-${i}`} position={{ lat: s.lat, lng: s.lng }} onClick={() => setOpenIdx(i)}>
          <div className="bus-marker" style={{ background: '#1f2a6b', width: 26, height: 26, fontSize: 12 }}>{i + 1}</div>
        </AdvancedMarker>
      ))}
      {open && (
        <InfoWindow position={{ lat: open.lat, lng: open.lng }} pixelOffset={[0, -14]} onCloseClick={() => setOpenIdx(null)}>
          <span style={{ color: '#111' }}>{open.name}</span>
        </InfoWindow>
      )}
      {pick && <AdvancedMarker position={toLatLng(pick)}><Pin /></AdvancedMarker>}
    </Frame>
  )
}
