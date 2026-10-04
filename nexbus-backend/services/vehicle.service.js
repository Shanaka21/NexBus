const { db } = require('../config/firebase');
const { AppError } = require('../utils/errors');
const eta = require('./eta.service');
const routeService = require('./route.service');
const arrival = require('./arrival.service');
const cache = require('./cache');

function format(id, v) {
  const lastUpdate = v.last_update_at || null;
  return {
    id,
    registration_no: v.registration_no || v.bus_number,
    bus_number: v.bus_number || v.registration_no,
    operator_id: v.operator_id || null,
    route_id: v.route_id || null,
    route_number: v.route_number,
    seat_capacity: v.seat_capacity || v.capacity || 0,
    capacity: v.seat_capacity || v.capacity || 0,
    reservable_seats: v.reservable_seats || 0,
    status: v.status || 'active',
    current_trip_id: v.current_trip_id || null,
    delay_minutes: v.delay_minutes || 0,
    lat: v.last_latitude ?? null,
    lng: v.last_longitude ?? null,
    speed_kmh: v.last_speed_kmh ?? null,
    last_update_at: lastUpdate,
    live_status: v.current_trip_id ? eta.vehicleStatus(lastUpdate, v.delay_minutes || 0) : 'idle'
  };
}

// Fleet list for operators (own company) and administrators (all)
async function listFleet(user) {
  const col = db.collection('vehicles');
  const snap = user.role === 'operator' ? await col.where('operator_id', '==', user.operatorId).get() : await col.get();
  return snap.docs.map(d => format(d.id, d.data()));
}

// Public read model used by the passenger live map (no company-private fields)
function publicBuses() {
  return cache.cached('public-buses', buildPublicBuses);
}

async function buildPublicBuses() {
  const [vehicleSnap, activeTrips, routes] = await Promise.all([
    db.collection('vehicles').get(),
    arrival.activeTrips(),
    routeService.allRoutes({ includeInactive: true })
  ]);
  const routeMap = Object.fromEntries(routes.map(r => [r.id, r]));
  const tripByVehicle = {};
  activeTrips
    .slice()
    .sort((a, b) => (a.status === 'running' ? -1 : 1) - (b.status === 'running' ? -1 : 1) || a.scheduled_departure - b.scheduled_departure)
    .forEach(t => { if (!tripByVehicle[t.vehicle_id]) tripByVehicle[t.vehicle_id] = t; });

  return vehicleSnap.docs.map(d => {
    const v = format(d.id, d.data());
    const trip = tripByVehicle[d.id];
    const route = routeMap[v.route_id] || {};
    const booked = trip && trip.reservable_seats ? trip.reservable_seats - trip.available_seats : (d.data().booked_seats || 0);
    return {
      id: d.id,
      bus_number: v.bus_number,
      route_number: v.route_number,
      status: v.status,
      live_status: v.live_status,
      capacity: v.seat_capacity,
      booked_seats: booked,
      route_name: route.route_name || `Route ${v.route_number}`,
      start_point: route.start_point || '',
      end_point: route.end_point || v.route_number,
      lat: v.lat,
      lng: v.lng,
      delay_minutes: v.delay_minutes,
      last_update_at: v.last_update_at,
      trip_id: trip ? trip.id : null
    };
  });
}

// Vehicles plus their running trips for the operator dashboard / admin: used when the live listener is unavailable
function liveFleet(user) {
  const scope = user.role === 'operator' ? user.operatorId : 'all';
  return cache.cached(`fleet:${scope}`, async () => {
    let vehicleQuery = db.collection('vehicles');
    let tripQuery = db.collection('trips').where('status', '==', 'running');
    if (scope !== 'all') {
      vehicleQuery = vehicleQuery.where('operator_id', '==', scope);
      tripQuery = tripQuery.where('operator_id', '==', scope);
    }
    const [vehicles, trips] = await Promise.all([vehicleQuery.get(), tripQuery.get()]);
    return {
      vehicles: vehicles.docs.map(d => format(d.id, d.data())),
      trips: trips.docs.map(d => {
        const t = d.data();
        return {
          id: d.id, vehicle_id: t.vehicle_id, route_number: t.route_number, driver_name: t.driver_name,
          reservable_seats: t.reservable_seats || 0, available_seats: t.available_seats || 0, delay_minutes: t.delay_minutes || 0
        };
      })
    };
  });
}

async function getBus(id) {
  const buses = await publicBuses();
  const bus = buses.find(b => b.id === id);
  if (!bus) throw new AppError(404, 'VEHICLE_NOT_FOUND', 'Bus not found');
  return bus;
}

async function ownVehicle(user, id) {
  const ref = db.collection('vehicles').doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found');
  if (doc.data().operator_id !== user.operatorId) throw new AppError(403, 'FORBIDDEN', 'This vehicle belongs to another company');
  return { ref, data: doc.data() };
}

async function createVehicle(user, dto) {
  const route = await routeService.getRoute(dto.route_id);
  const data = {
    registration_no: dto.registration_no,
    bus_number: dto.registration_no,
    operator_id: user.operatorId,
    route_id: dto.route_id,
    route_number: route.route_number,
    seat_capacity: dto.seat_capacity,
    capacity: dto.seat_capacity,
    reservable_seats: dto.reservable_seats,
    booked_seats: 0,
    status: 'active',
    delay_minutes: 0,
    created_at: Date.now()
  };
  const dup = await db.collection('vehicles').where('registration_no', '==', dto.registration_no).get();
  if (!dup.empty) throw new AppError(409, 'REGISTRATION_IN_USE', 'A vehicle with this registration number already exists');
  const ref = await db.collection('vehicles').add(data);
  return format(ref.id, data);
}

async function updateVehicle(user, id, dto) {
  const { ref, data } = await ownVehicle(user, id);
  const patch = { ...dto };
  if (dto.route_id) patch.route_number = (await routeService.getRoute(dto.route_id)).route_number;
  if (dto.registration_no) patch.bus_number = dto.registration_no;
  if (dto.seat_capacity) patch.capacity = dto.seat_capacity;
  const capacity = patch.seat_capacity || data.seat_capacity || data.capacity;
  const reservable = patch.reservable_seats ?? data.reservable_seats ?? 0;
  if (reservable > capacity) throw new AppError(400, 'VALIDATION_ERROR', 'Reservable seats cannot exceed seat capacity');
  await ref.update(patch);
  return format(id, { ...data, ...patch });
}

async function setStatus(user, id, status) {
  const { ref } = await ownVehicle(user, id);
  await ref.update({ status });
  return { message: 'Bus status updated', status };
}

module.exports = { listFleet, liveFleet, publicBuses, getBus, createVehicle, updateVehicle, setStatus, format };
