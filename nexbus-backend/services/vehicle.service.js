const { pool } = require('../config/db');
const { AppError } = require('../utils/errors');
const eta = require('./eta.service');
const routeService = require('./route.service');
const arrival = require('./arrival.service');
const cache = require('./cache');

function format(id, v) {
  const lastUpdate = v.last_update_at ? Number(v.last_update_at) : null;
  return {
    id,
    registration_no: id,
    bus_number: id,
    operator_id: v.operator_id || null,
    route_id: v.route_id || null,
    route_number: v.route_number,
    seat_capacity: v.seat_capacity || 0,
    capacity: v.seat_capacity || 0,
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
  const { rows } = user.role === 'operator'
    ? await pool.query('SELECT v.*, r.route_number FROM vehicles v LEFT JOIN routes r ON r.id = v.route_id WHERE v.operator_id = $1', [user.operatorId])
    : await pool.query('SELECT v.*, r.route_number FROM vehicles v LEFT JOIN routes r ON r.id = v.route_id');
  return rows.map((r) => format(r.id, r));
}

// Public read model used by the passenger live map (no company-private fields)
function publicBuses() {
  return cache.cached('public-buses', buildPublicBuses);
}

async function buildPublicBuses() {
  const [vehicleRows, activeTrips, routes] = await Promise.all([
    pool.query('SELECT v.*, r.route_number FROM vehicles v LEFT JOIN routes r ON r.id = v.route_id'),
    arrival.activeTrips(),
    routeService.allRoutes({ includeInactive: true })
  ]);
  const routeMap = Object.fromEntries(routes.map(r => [r.id, r]));
  const tripByVehicle = {};
  activeTrips
    .slice()
    .sort((a, b) => (a.status === 'running' ? -1 : 1) - (b.status === 'running' ? -1 : 1) || a.scheduled_departure - b.scheduled_departure)
    .forEach(t => { if (!tripByVehicle[t.vehicle_id]) tripByVehicle[t.vehicle_id] = t; });

  return vehicleRows.rows.map(d => {
    const v = format(d.id, d);
    const trip = tripByVehicle[d.id];
    const route = routeMap[v.route_id] || {};
    const booked = trip && trip.reservable_seats ? trip.reservable_seats - trip.available_seats : (d.booked_seats || 0);
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
    const vehicleSql = scope === 'all'
      ? 'SELECT v.*, r.route_number FROM vehicles v LEFT JOIN routes r ON r.id = v.route_id'
      : 'SELECT v.*, r.route_number FROM vehicles v LEFT JOIN routes r ON r.id = v.route_id WHERE v.operator_id = $1';
    const tripSql = scope === 'all'
      ? "SELECT * FROM trips WHERE status = 'running'"
      : "SELECT * FROM trips WHERE status = 'running' AND operator_id = $1";
    const params = scope === 'all' ? [] : [scope];
    const [vehicles, trips] = await Promise.all([pool.query(vehicleSql, params), pool.query(tripSql, params)]);
    return {
      vehicles: vehicles.rows.map(d => format(d.id, d)),
      trips: trips.rows.map(t => ({
        id: t.id, vehicle_id: t.vehicle_id, route_number: t.route_number, driver_name: t.driver_name,
        reservable_seats: t.reservable_seats || 0, available_seats: t.available_seats || 0, delay_minutes: t.delay_minutes || 0
      }))
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
  const { rows } = await pool.query('SELECT * FROM vehicles WHERE id = $1', [id]);
  if (!rows[0]) throw new AppError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found');
  if (rows[0].operator_id !== user.operatorId) throw new AppError(403, 'FORBIDDEN', 'This vehicle belongs to another company');
  return rows[0];
}

async function createVehicle(user, dto) {
  const route = await routeService.getRoute(dto.route_id);
  const now = Date.now();
  try {
    await pool.query(
      `INSERT INTO vehicles (id, operator_id, route_id, seat_capacity, reservable_seats, booked_seats, status, delay_minutes, created_at)
       VALUES ($1, $2, $3, $4, $5, 0, 'active', 0, $6)`,
      [dto.registration_no, user.operatorId, dto.route_id, dto.seat_capacity, dto.reservable_seats, now]
    );
  } catch (err) {
    if (err.code === '23505') throw new AppError(409, 'REGISTRATION_IN_USE', 'A vehicle with this registration number already exists');
    throw err;
  }
  return format(dto.registration_no, { operator_id: user.operatorId, route_id: dto.route_id, route_number: route.route_number, seat_capacity: dto.seat_capacity, reservable_seats: dto.reservable_seats, status: 'active', delay_minutes: 0 });
}

async function updateVehicle(user, id, dto) {
  const data = await ownVehicle(user, id);
  if (dto.route_id) await routeService.getRoute(dto.route_id); // 404s if the route doesn't exist
  const capacity = dto.seat_capacity || data.seat_capacity;
  const reservable = dto.reservable_seats ?? data.reservable_seats ?? 0;
  if (reservable > capacity) throw new AppError(400, 'VALIDATION_ERROR', 'Reservable seats cannot exceed seat capacity');

  const sets = [];
  const values = [];
  const add = (col, val) => { values.push(val); sets.push(`${col} = $${values.length}`); };
  if (dto.route_id) add('route_id', dto.route_id);
  if (dto.seat_capacity) add('seat_capacity', dto.seat_capacity);
  if (dto.reservable_seats !== undefined) add('reservable_seats', dto.reservable_seats);
  if (dto.status) add('status', dto.status);
  if (sets.length) {
    values.push(id);
    await pool.query(`UPDATE vehicles SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
  }
  const { rows } = await pool.query('SELECT v.*, r.route_number FROM vehicles v LEFT JOIN routes r ON r.id = v.route_id WHERE v.id = $1', [id]);
  return format(id, rows[0]);
}

async function setStatus(user, id, status) {
  await ownVehicle(user, id);
  await pool.query('UPDATE vehicles SET status = $1 WHERE id = $2', [status, id]);
  return { message: 'Bus status updated', status };
}

module.exports = { listFleet, liveFleet, publicBuses, getBus, createVehicle, updateVehicle, setStatus, format };
