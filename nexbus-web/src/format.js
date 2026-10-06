// Colombo, the default map centre
export const COLOMBO = [6.9271, 79.8612]

export const lkr = (n) => `LKR ${Number(n || 0).toLocaleString('en-US')}`

const TZ = 'Asia/Colombo'

export const clock = (ms) => ms
  ? new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
  : '-'

export const dateTime = (ms) => ms
  ? new Date(ms).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ })
  : '-'

// Sri Lanka calendar date as YYYY-MM-DD
export const colomboDate = (ms = Date.now()) => new Date(ms + 5.5 * 3600 * 1000).toISOString().slice(0, 10)

// <input type="datetime-local"> holds a Sri Lanka local time; convert it to an exact instant
export const colomboLocalToIso = (value) => new Date(`${value}:00+05:30`).toISOString()

export const ago = (ms) => {
  if (!ms) return 'no position yet'
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  return `${Math.round(s / 3600)} h ago`
}

export const OFFLINE_MS = 2 * 60 * 1000

// on time / delayed / offline, shown the same way everywhere
export function liveStatus(lastUpdateMs, delayMinutes, now = Date.now()) {
  if (!lastUpdateMs || now - lastUpdateMs > OFFLINE_MS) return 'offline'
  return (delayMinutes || 0) >= 10 ? 'delayed' : 'on_time'
}

export const LIVE = {
  on_time: { label: 'On time', tone: 'green', color: '#2e9e5b' },
  delayed: { label: 'Delayed', tone: 'amber', color: '#e8a317' },
  offline: { label: 'Offline', tone: 'gray', color: '#9aa0b4' },
  idle: { label: 'Offline', tone: 'gray', color: '#9aa0b4' },
}

export const BOOKING_TONE = {
  pending_payment: 'amber', confirmed: 'green', completed: 'blue', cancelled: 'red', expired: 'gray',
}

export const PAYMENT_TONE = { success: 'green', pending: 'amber', failed: 'red', canceled: 'red', unpaid: 'gray', chargedback: 'red' }

export const TRIP_TONE = { scheduled: 'blue', running: 'green', completed: 'gray', cancelled: 'red' }

export const SERVICE_TYPES = [
  { value: 'normal', label: 'Ordinary' },
  { value: 'semi_luxury', label: 'Semi-Luxury' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'expressway', label: 'Expressway' },
]

export const label = (s) => String(s || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

export function haversineKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}
