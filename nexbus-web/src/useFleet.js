import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { liveStatus } from './format'

// Every call reads the whole fleet, so keep it slow and pause it while the tab is hidden.
export const POLL_MS = 20000

// Live fleet: vehicles joined with their running trip, kept fresh by polling the API.
export function useFleet(user) {
  const [vehicles, setVehicles] = useState(null)
  const [trips, setTrips] = useState([])
  const [error, setError] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  const operatorId = user.role === 'operator' ? user.operator_id : null

  useEffect(() => {
    let poll = null
    let stopped = false

    const load = async () => {
      if (document.hidden) return
      try {
        const { vehicles: v, trips: t } = await api('/vehicles/live') // one cached call for the whole fleet
        if (stopped) return
        setVehicles(v.map((x) => ({
          id: x.id, registration_no: x.registration_no, route_number: x.route_number, status: x.status,
          lat: x.lat, lng: x.lng, delay_minutes: x.delay_minutes, last_update_at: x.last_update_at,
          current_trip_id: x.current_trip_id, operator_id: x.operator_id,
        })))
        setTrips(t)
        setError(null)
      } catch (err) {
        if (!stopped) setError(err.message)
      }
    }

    load()
    poll = setInterval(load, POLL_MS)
    document.addEventListener('visibilitychange', load)
    return () => { stopped = true; document.removeEventListener('visibilitychange', load); if (poll) clearInterval(poll) }
  }, [operatorId])

  // re-evaluate "offline" and "updated N s ago" regularly
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [])

  const fleet = useMemo(() => (vehicles || []).map((v) => {
    const trip = trips.find((t) => t.id === v.current_trip_id) || trips.find((t) => t.vehicle_id === v.id)
    const running = !!trip
    return {
      ...v,
      trip,
      running,
      driver_name: trip?.driver_name || '',
      booked: trip ? (trip.reservable_seats || 0) - (trip.available_seats || 0) : 0,
      reservable: trip?.reservable_seats || 0,
      live: running ? liveStatus(v.last_update_at, v.delay_minutes, now) : 'idle',
    }
  }), [vehicles, trips, now])

  return { fleet, loading: vehicles === null, live: false, error, now }
}
