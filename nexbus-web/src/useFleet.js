import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { api } from './api'
import { liveStatus } from './format'

export const POLL_MS = 6000

// Live fleet: vehicles joined with their running trip.
// Positions arrive through read-only Firestore listeners; if a listener cannot be opened the hook polls the API.
export function useFleet(user) {
  const [vehicles, setVehicles] = useState(null)
  const [trips, setTrips] = useState([])
  const [live, setLive] = useState(true)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  const operatorId = user.role === 'operator' ? user.operator_id : null

  useEffect(() => {
    let poll = null
    let stopped = false

    const startPolling = () => {
      if (poll || stopped) return
      setLive(false)
      const load = async () => {
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
    }

    const vehicleQuery = operatorId
      ? query(collection(db, 'vehicles'), where('operator_id', '==', operatorId))
      : collection(db, 'vehicles')
    const tripQuery = operatorId
      ? query(collection(db, 'trips'), where('status', '==', 'running'), where('operator_id', '==', operatorId))
      : query(collection(db, 'trips'), where('status', '==', 'running'))

    const unsubVehicles = onSnapshot(vehicleQuery, (snap) => {
      setVehicles(snap.docs.map((d) => {
        const x = d.data()
        return {
          id: d.id, registration_no: x.registration_no || x.bus_number, route_number: x.route_number, status: x.status || 'active',
          lat: x.last_latitude ?? null, lng: x.last_longitude ?? null, delay_minutes: x.delay_minutes || 0,
          last_update_at: x.last_update_at || null, current_trip_id: x.current_trip_id || null, operator_id: x.operator_id,
        }
      }))
      setLive(true)
      setError(null)
    }, startPolling)

    const unsubTrips = onSnapshot(tripQuery, (snap) => {
      setTrips(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    }, startPolling)

    return () => { stopped = true; unsubVehicles(); unsubTrips(); if (poll) clearInterval(poll) }
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

  return { fleet, loading: vehicles === null, live, error, now }
}
