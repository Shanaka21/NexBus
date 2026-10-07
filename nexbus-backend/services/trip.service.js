const crypto = require('crypto');
const { pool } = require('../config/db');
const { AppError } = require('../utils/errors');
const notify = require('./notify.service');
const { colomboDate } = require('../utils/format');
const cache = require('./cache');
const eta = require('./eta.service');
const bookingService = require('./booking.service');

const ALLOWED = { // current status -> allowed next status
  scheduled: ['running', 'cancelled'],
  running: ['completed']
};

function row(r) {
  return {
    id: r.id, route_id: r.route_id, route_number: r.route_number, vehicle_id: r.vehicle_id,
    registration_no: r.registration_no, operator_id: r.operator_id, driver_id: r.driver_id,
    driver_name: r.driver_name, scheduled_departure: Number(r.scheduled_departure), service_date: r.service_date,
    actual_departure: r.actual_departure != null ? Number(r.actual_departure) : null, direction: r.direction,
    status: r.status, delay_minutes: r.delay_minutes || 0, reservable_seats: r.reservable_seats || 0,
    available_seats: r.available_seats || 0, last_latitude: r.last_latitude, last_longitude: r.last_longitude,
    last_update_at: r.last_update_at != null ? Number(r.last_update_at) : null, recent_fixes: r.recent_fixes || [],
    created_at: Number(r.created_at)
  };
}

async function createTrip(user, dto) {
  const [vehicleRes, routeRes] = await Promise.all([
    pool.query('SELECT * FROM vehicles WHERE id = $1', [dto.vehicle_id]),
    pool.query('SELECT * FROM routes WHERE id = $1', [dto.route_id])
  ]);
  const vehicle = vehicleRes.rows[0];
  const route = routeRes.rows[0];
  if (!route) throw new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found');
  if (!vehicle) throw new AppError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found');
  if (vehicle.operator_id !== user.operatorId) throw new AppError(403, 'FORBIDDEN', 'This vehicle belongs to another company');
  if (vehicle.route_id !== dto.route_id) throw new AppError(400, 'VEHICLE_ROUTE_MISMATCH', 'This vehicle is not permitted on that route');

  // the trip goes to the driver assigned to the bus unless the operator picks someone else
  const driverId = dto.driver_id || vehicle.driver_id;
  if (!driverId) throw new AppError(400, 'DRIVER_REQUIRED', 'Assign a driver to this vehicle first (Vehicles page), or choose one for the trip');
  const driver = (await pool.query('SELECT * FROM users WHERE id = $1', [driverId])).rows[0];
  if (!driver || driver.role !== 'driver' || driver.operator_id !== user.operatorId) {
    throw new AppError(400, 'DRIVER_INVALID', 'Driver must be a driver account of your company');
  }

  const reservable = vehicle.reservable_seats || 0;
  const id = crypto.randomUUID();
  const scheduledDeparture = +dto.scheduled_departure;
  const now = Date.now();
  const data = {
    id, route_id: dto.route_id, route_number: route.route_number, vehicle_id: dto.vehicle_id,
    registration_no: vehicle.id, operator_id: user.operatorId, driver_id: driverId,
    driver_name: driver.full_name || '', scheduled_departure: scheduledDeparture, service_date: colomboDate(scheduledDeparture),
    actual_departure: null, direction: dto.direction || 'outbound', status: 'scheduled', delay_minutes: 0,
    reservable_seats: reservable, available_seats: reservable, created_at: now
  };
  await pool.query(
    `INSERT INTO trips (id, route_id, route_number, vehicle_id, registration_no, operator_id, driver_id, driver_name,
       scheduled_departure, service_date, actual_departure, direction, status, delay_minutes, reservable_seats, available_seats, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [id, data.route_id, data.route_number, data.vehicle_id, data.registration_no, data.operator_id, data.driver_id,
      data.driver_name, data.scheduled_departure, data.service_date, data.actual_departure, data.direction, data.status,
      data.delay_minutes, data.reservable_seats, data.available_seats, data.created_at]
  );
  cache.invalidate();
  return data;
}

// Trips are always read for a small window of service dates (one day when a date is given, otherwise
// yesterday to tomorrow), so a query never reads the whole table.
async function listTrips(user, q) {
  const dates = q.date ? [q.date] : [colomboDate(Date.now() - 86400000), colomboDate(), colomboDate(Date.now() + 86400000)];
  const where = ['service_date = ANY($1)'];
  const params = [dates];
  const add = (cond, val) => { params.push(val); where.push(cond.replace('?', `$${params.length}`)); };

  if (q.route_id) add('route_id = ?', q.route_id);
  if (user.role === 'driver') add('driver_id = ?', user.uid);
  if (user.role === 'operator') add('operator_id = ?', user.operatorId);

  const { rows } = await pool.query(`SELECT * FROM trips WHERE ${where.join(' AND ')}`, params);
  let trips = rows.map(row);

  if (q.status) trips = trips.filter(t => t.status === q.status);
  else if (user.role === 'passenger' || user.role === 'admin') trips = trips.filter(t => ['scheduled', 'running'].includes(t.status));
  trips.sort((a, b) => a.scheduled_departure - b.scheduled_departure);
  if (user.role === 'driver') await attachPassengers(trips);
  return trips;
}

// The driver sees who has paid for a seat on each of their trips: name, seats and whether the boarding
// code was already checked. The code itself stays with the passenger.
async function attachPassengers(trips) {
  const byTrip = new Map(trips.map((t) => [t.id, (t.passengers = [])]));
  if (!trips.length) return;
  const { rows } = await pool.query(
    `SELECT b.id, b.trip_id, b.seat_numbers, b.seat_count, b.from_name, b.to_name, b.boarded_at, u.full_name
       FROM bookings b JOIN users u ON u.id = b.user_id
      WHERE b.trip_id = ANY($1) AND b.status IN ('confirmed', 'completed') ORDER BY b.created_at`,
    [trips.map((t) => t.id)]
  );
  for (const b of rows) {
    byTrip.get(b.trip_id).push({
      booking_id: b.id, name: b.full_name || 'Passenger', seat_numbers: b.seat_numbers || [], seats: b.seat_count,
      from: b.from_name, to: b.to_name, boarded: b.boarded_at != null
    });
  }
}

// The driver types the 4-digit code a passenger shows; it names the booking it belongs to on this trip.
async function verifyBoarding(user, tripId, code) {
  const { rows } = await pool.query('SELECT * FROM trips WHERE id = $1', [tripId]);
  if (!rows[0]) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found');
  if (rows[0].driver_id !== user.uid) throw new AppError(403, 'FORBIDDEN', 'This is not your trip');
  if (!['scheduled', 'running'].includes(rows[0].status)) throw new AppError(409, 'TRIP_CLOSED', 'This trip is already finished');

  const res = await pool.query(
    `SELECT b.*, u.full_name FROM bookings b JOIN users u ON u.id = b.user_id
      WHERE b.trip_id = $1 AND b.boarding_code = $2 AND b.status IN ('pending_payment', 'confirmed')`,
    [tripId, code]
  );
  const b = res.rows[0];
  if (!b) throw new AppError(404, 'CODE_NOT_FOUND', 'No booking on this trip has that code');
  if (b.status !== 'confirmed') throw new AppError(409, 'NOT_PAID', 'This booking has not been paid for yet');

  const already = b.boarded_at != null;
  if (!already) {
    await pool.query('UPDATE bookings SET boarded_at = $1 WHERE id = $2', [Date.now(), b.id]);
  }
  return {
    verified: true, already_boarded: already, booking_id: b.id, name: b.full_name || 'Passenger',
    seat_numbers: b.seat_numbers || [], seats: b.seat_count, from: b.from_name, to: b.to_name
  };
}

async function getAvailability(tripId) {
  const { rows } = await pool.query('SELECT * FROM trips WHERE id = $1', [tripId]);
  if (!rows[0]) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found');
  const trip = row(rows[0]);
  const routeRes = await pool.query('SELECT * FROM routes WHERE id = $1', [trip.route_id]);
  const route = routeRes.rows[0] || {};
  return {
    trip_id: tripId, status: trip.status, scheduled_departure: trip.scheduled_departure,
    reservable_seats: trip.reservable_seats, available_seats: trip.available_seats,
    fare_lkr: route.base_fare_lkr != null ? Number(route.base_fare_lkr) : 0, delay_minutes: trip.delay_minutes
  };
}

// Which seat numbers (1..reservable_seats) are currently held by an active booking on this trip.
// A snapshot for display only: the actual grab-a-seat check happens inside createBooking's transaction.
async function seatMap(tripId) {
  await bookingService.sweepHolds();
  const { rows } = await pool.query('SELECT reservable_seats FROM trips WHERE id = $1', [tripId]);
  if (!rows[0]) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found');
  const takenRes = await pool.query(
    "SELECT seat_numbers FROM bookings WHERE trip_id = $1 AND status IN ('pending_payment', 'confirmed')", [tripId]
  );
  const taken = [...new Set(takenRes.rows.flatMap((b) => b.seat_numbers || []))].sort((a, b) => a - b);
  return { trip_id: tripId, reservable_seats: rows[0].reservable_seats || 0, taken };
}

// Start / complete / cancel a trip, with ownership checks (Appendix B.1)
async function changeStatus(user, tripId, next) {
  const { rows } = await pool.query('SELECT * FROM trips WHERE id = $1', [tripId]);
  if (!rows[0]) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found');
  const trip = row(rows[0]);

  const isDriver = user.role === 'driver' && trip.driver_id === user.uid;
  const isOperator = user.role === 'operator' && trip.operator_id === user.operatorId;
  if (!isDriver && !isOperator) throw new AppError(403, 'FORBIDDEN', 'You cannot change this trip');
  if (!(ALLOWED[trip.status] || []).includes(next)) {
    throw new AppError(409, 'INVALID_STATUS_CHANGE', `A ${trip.status} trip cannot become ${next}`);
  }

  if (next === 'running') {
    await pool.query('UPDATE trips SET status = $1, actual_departure = $2 WHERE id = $3', [next, Date.now(), tripId]);
  } else {
    await pool.query('UPDATE trips SET status = $1 WHERE id = $2', [next, tripId]);
  }

  if (next === 'running') {
    await pool.query("UPDATE vehicles SET current_trip_id = $1, status = 'active' WHERE id = $2", [tripId, trip.vehicle_id]);
  }

  if (next === 'completed' || next === 'cancelled') {
    // The bus goes offline: no trip, no delay and no last position, so it leaves the live map instead of
    // sitting on the spot where it stopped. Only when the vehicle is on this very trip: cancelling a future
    // trip must not disturb the one the bus is running now. An operator's emergency/inactive flag is kept.
    await pool.query(
      `UPDATE vehicles
         SET current_trip_id = NULL, delay_minutes = 0,
             last_latitude = NULL, last_longitude = NULL, last_speed_kmh = NULL, last_update_at = NULL,
             status = CASE WHEN status = 'delayed' THEN 'active' ELSE status END
       WHERE id = $1 AND current_trip_id = $2`,
      [trip.vehicle_id, tripId]
    );
    const openRes = await pool.query(
      "SELECT * FROM bookings WHERE trip_id = $1 AND status IN ('confirmed', 'pending_payment')", [tripId]
    );
    const notices = [];
    for (const b of openRes.rows) {
      let status;
      if (next === 'completed') status = b.status === 'confirmed' ? 'completed' : 'expired';
      else status = b.status === 'confirmed' ? 'cancelled' : 'expired';
      const refundRequired = next === 'cancelled' && b.status === 'confirmed';
      await pool.query(
        'UPDATE bookings SET status = $1, refund_required = refund_required OR $2 WHERE id = $3',
        [status, refundRequired, b.id]
      );
      if (next === 'cancelled') {
        notices.push(notify.sendToUser(b.user_id, {
          type: 'trip_cancelled', title: 'Trip cancelled',
          message: `Your trip on route ${trip.route_number} was cancelled by the operator.`
            + (refundRequired ? ' A refund will be arranged.' : ''),
          relatedTripId: tripId, relatedBookingId: b.id
        }));
      }
    }
    await Promise.all(notices);
  }
  cache.invalidate(); // after the vehicle rows changed, so the live map never rebuilds from the old state
  return { id: tripId, status: next };
}

// Distance/duration/passenger summary for one trip, built from its recorded GPS fixes (driver, the
// trip's own operator, or an admin only). Useful for a completed trip's history view.
async function tripSummary(user, tripId) {
  const { rows } = await pool.query('SELECT * FROM trips WHERE id = $1', [tripId]);
  const t = rows[0];
  if (!t) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found');
  const trip = row(t);

  const isDriver = user.role === 'driver' && trip.driver_id === user.uid;
  const isOperator = user.role === 'operator' && trip.operator_id === user.operatorId;
  const isAdmin = user.role === 'admin';
  if (!isDriver && !isOperator && !isAdmin) throw new AppError(403, 'FORBIDDEN', 'You cannot view this trip');

  const logsRes = await pool.query(
    'SELECT latitude, longitude, speed_kmh, recorded_at FROM location_logs WHERE trip_id = $1 ORDER BY recorded_at ASC',
    [tripId]
  );
  const fixes = logsRes.rows;

  let distanceKm = 0;
  for (let i = 1; i < fixes.length; i++) {
    distanceKm += eta.haversine(
      { lat: fixes[i - 1].latitude, lng: fixes[i - 1].longitude },
      { lat: fixes[i].latitude, lng: fixes[i].longitude }
    );
  }

  const startedAt = trip.actual_departure || (fixes[0] ? Number(fixes[0].recorded_at) : null);
  const endedAt = ['completed', 'cancelled'].includes(trip.status)
    ? (fixes.length ? Number(fixes[fixes.length - 1].recorded_at) : startedAt)
    : Date.now();
  const durationMin = startedAt && endedAt ? Math.max(0, Math.round((endedAt - startedAt) / 60000)) : null;
  const avgSpeedKmh = durationMin ? Number((distanceKm / (durationMin / 60)).toFixed(1)) : null;

  return {
    trip_id: trip.id,
    status: trip.status,
    distance_km: Number(distanceKm.toFixed(2)),
    duration_min: durationMin,
    avg_speed_kmh: avgSpeedKmh,
    fixes_count: fixes.length,
    passengers: trip.reservable_seats > 0 ? trip.reservable_seats - trip.available_seats : null,
    started_at: startedAt,
    ended_at: ['completed', 'cancelled'].includes(trip.status) ? endedAt : null
  };
}

module.exports = { createTrip, listTrips, verifyBoarding, getAvailability, seatMap, changeStatus, tripSummary };
