const { db } = require('../config/firebase');
const { AppError } = require('../utils/errors');
const { colomboDate } = require('../utils/format');
const cache = require('./cache');
const eta = require('./eta.service');
const routeService = require('./route.service');
const stopService = require('./stop.service');

const STALE_MS = 10 * 60 * 1000;

// ETA of one trip to the stop at stops[targetIndex]. Returns null when the bus has already passed it.
function tripEta(trip, route, stops, targetIndex, now = Date.now()) {
  const routeSpeed = eta.routeAvgSpeedKmh(route);

  if (trip.status === 'running') {
    if (trip.last_latitude == null) return null; // running but no position yet
    const bus = { lat: trip.last_latitude, lng: trip.last_longitude };
    const minutes = eta.etaRunning(stops, targetIndex, bus, eta.recentSpeedKmh(trip.recent_fixes, now), routeSpeed);
    if (minutes === null) return null;
    return {
      eta_min: minutes,
      status: eta.vehicleStatus(trip.last_update_at, trip.delay_minutes || 0, now),
      updated_seconds_ago: trip.last_update_at ? Math.round((now - trip.last_update_at) / 1000) : null
    };
  }

  // A scheduled trip that is well past its departure time never started: do not offer it
  if (trip.scheduled_departure < now - STALE_MS) return null;

  return { // scheduled, not started
    eta_min: eta.etaScheduled(stops, targetIndex, trip.scheduled_departure, routeSpeed, now),
    status: 'scheduled',
    updated_seconds_ago: null
  };
}

// Running trips plus the scheduled trips of today (and of tomorrow only when the 4 hour look-ahead crosses
// midnight), using equality filters only. Cached because every passenger screen polls these results.
function activeTrips() {
  return cache.cached('active-trips', async () => {
    const days = [...new Set([colomboDate(), colomboDate(Date.now() + 4 * 3600 * 1000)])];
    const [running, scheduled] = await Promise.all([
      db.collection('trips').where('status', '==', 'running').get(),
      db.collection('trips').where('service_date', 'in', days).where('status', '==', 'scheduled').get()
    ]);
    return [...running.docs, ...scheduled.docs].map(d => ({ id: d.id, ...d.data() }));
  });
}

// Upcoming buses for one stop (FR-ETA-01)
async function arrivalsForStop(stopId, now = Date.now()) {
  await stopService.getStop(stopId); // 404 when the stop does not exist
  const [routes, trips] = await Promise.all([routeService.allRoutes(), activeTrips()]);
  const results = [];

  for (const route of routes) {
    const routeTrips = trips.filter(t => t.route_id === route.id);
    if (!routeTrips.length) continue;
    const stops = await stopService.routeStops(route);
    const index = stops.findIndex(s => s.stopId === stopId);
    if (index === -1) continue;

    for (const trip of routeTrips) {
      if (trip.status === 'scheduled' && trip.scheduled_departure - now > 4 * 3600 * 1000) continue;
      const info = tripEta(trip, route, stops, index, now);
      if (!info) continue;
      results.push({
        trip_id: trip.id,
        route_id: route.id,
        route_number: route.route_number,
        route_name: route.route_name,
        destination: route.end_point,
        registration_no: trip.registration_no,
        delay_minutes: trip.delay_minutes || 0,
        reservable_seats: trip.reservable_seats || 0,
        available_seats: trip.available_seats || 0,
        fare_lkr: route.base_fare_lkr,
        scheduled_departure: trip.scheduled_departure,
        ...info
      });
    }
  }
  return results.sort((a, b) => a.eta_min - b.eta_min).slice(0, 15);
}

// Live detail of one trip for the map: status, seats and the next stops with their ETA (UC02 step 5)
async function tripLive(tripId, now = Date.now()) {
  const doc = await db.collection('trips').doc(tripId).get();
  if (!doc.exists) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found');
  const trip = { id: doc.id, ...doc.data() };
  const route = await routeService.getRoute(trip.route_id);
  const stops = await stopService.routeStops(route);

  let nextStops = [];
  let updatedSecondsAgo = null;
  let status = trip.status === 'running' ? 'offline' : 'scheduled';

  if (trip.status === 'running' && trip.last_latitude != null) {
    const progress = eta.progressKm(stops, { lat: trip.last_latitude, lng: trip.last_longitude });
    status = eta.vehicleStatus(trip.last_update_at, trip.delay_minutes || 0, now);
    updatedSecondsAgo = Math.round((now - trip.last_update_at) / 1000);
    nextStops = stops
      .map((s, index) => ({ s, index }))
      .filter(({ s }) => s.distanceFromOriginKm >= progress)
      .slice(0, 3)
      .map(({ s, index }) => ({
        stop_id: s.stopId, name: s.name, name_si: s.nameSi,
        eta_min: tripEta(trip, route, stops, index, now)?.eta_min ?? null
      }));
  }

  return {
    trip_id: trip.id,
    route_number: route.route_number,
    route_name: route.route_name,
    registration_no: trip.registration_no,
    status,
    delay_minutes: trip.delay_minutes || 0,
    reservable_seats: trip.reservable_seats || 0,
    available_seats: trip.available_seats || 0,
    fare_lkr: route.base_fare_lkr,
    updated_seconds_ago: updatedSecondsAgo,
    next_stops: nextStops
  };
}

module.exports = { tripEta, activeTrips, arrivalsForStop, tripLive };
