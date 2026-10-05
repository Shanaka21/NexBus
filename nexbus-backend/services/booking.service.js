const crypto = require('crypto');
const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../utils/errors');
const { bookingReference, lkr, clock, dateLabel } = require('../utils/format');
const cache = require('./cache');
const eta = require('./eta.service');
const stopService = require('./stop.service');
const notify = require('./notify.service');
const audit = require('./audit.service');

const HOLD_MS = 10 * 60 * 1000;

// Response shape: keeps the field names older clients already read (route, from, to, seats, fare, status)
function formatBooking(id, b) {
  const status = b.status;
  const amount = b.fare_amount_lkr != null ? Number(b.fare_amount_lkr) : null;
  const scheduledDeparture = b.scheduled_departure != null ? Number(b.scheduled_departure) : null;
  const createdAt = Number(b.created_at);
  return {
    id,
    booking_reference: b.booking_reference || null,
    user_id: b.user_id,
    trip_id: b.trip_id || null,
    route: b.route_number,
    route_number: b.route_number,
    from: b.from_name,
    to: b.to_name,
    date: dateLabel(scheduledDeparture || createdAt),
    time: scheduledDeparture ? clock(scheduledDeparture) : '',
    seats: b.seat_count || 1,
    status,
    booking_status: status,
    payment_status: b.payment_status || 'unpaid',
    fare: amount != null ? lkr(amount) : null,
    fare_amount_lkr: amount,
    hold_expires_at: b.hold_expires_at != null ? Number(b.hold_expires_at) : null,
    scheduled_departure: scheduledDeparture,
    refund_required: !!b.refund_required,
    created_at: createdAt
  };
}

async function createBooking(user, dto) {
  const master = await stopService.allStops();
  const bookingId = crypto.randomUUID();

  // Seat check and seat hold happen in one transaction (trip row locked FOR UPDATE): two passengers
  // cannot take the last seat together.
  const booking = await withTransaction(async (tx) => {
    const tripRes = await tx.query('SELECT * FROM trips WHERE id = $1 FOR UPDATE', [dto.trip_id]);
    const trip = tripRes.rows[0];
    if (!trip) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found');
    if (!['scheduled', 'running'].includes(trip.status)) {
      throw new AppError(409, 'TRIP_CLOSED', 'This trip is no longer open for booking');
    }
    if (trip.status === 'scheduled' && Number(trip.scheduled_departure) < Date.now() - 10 * 60 * 1000) {
      throw new AppError(409, 'TRIP_CLOSED', 'This trip has already departed');
    }
    const routeRes = await tx.query('SELECT * FROM routes WHERE id = $1', [trip.route_id]);
    const route = routeRes.rows[0];
    const stopsRes = await tx.query('SELECT * FROM route_stops WHERE route_id = $1 ORDER BY sequence_no', [trip.route_id]);

    const byStop = Object.fromEntries(stopsRes.rows.map(s => [s.stop_id, s]));
    const board = byStop[dto.boarding_stop_id];
    const alight = byStop[dto.alighting_stop_id];
    if (!board || !alight) throw new AppError(400, 'STOP_NOT_ON_ROUTE', 'Selected stops are not on this route');
    if (board.sequence_no >= alight.sequence_no) {
      throw new AppError(400, 'INVALID_STOP_ORDER', 'The alighting stop must come after the boarding stop');
    }
    if (!(trip.reservable_seats > 0)) {
      throw new AppError(409, 'NOT_RESERVABLE', 'This service does not take seat reservations');
    }
    if (trip.status === 'running' && trip.last_latitude != null) {
      const stops = stopsRes.rows.map(s => ({
        lat: master.get(s.stop_id)?.latitude, lng: master.get(s.stop_id)?.longitude,
        distanceFromOriginKm: Number(s.distance_from_origin_km)
      }));
      if (eta.progressKm(stops, { lat: trip.last_latitude, lng: trip.last_longitude }) > Number(board.distance_from_origin_km)) {
        throw new AppError(409, 'BOARDING_PASSED', 'The bus has already passed your boarding stop');
      }
    }
    if ((trip.available_seats || 0) < dto.seat_count) {
      throw new AppError(409, 'SEATS_UNAVAILABLE', 'Not enough seats available');
    }

    const amount = Number(route.base_fare_lkr) * dto.seat_count; // always calculated on the server
    const now = Date.now();
    const row = {
      id: bookingId, booking_reference: bookingReference(), user_id: user.uid, trip_id: dto.trip_id,
      route_id: trip.route_id, route_number: trip.route_number, vehicle_id: trip.vehicle_id, operator_id: trip.operator_id,
      boarding_stop_id: dto.boarding_stop_id, alighting_stop_id: dto.alighting_stop_id,
      from_name: master.get(dto.boarding_stop_id)?.name || dto.boarding_stop_id,
      to_name: master.get(dto.alighting_stop_id)?.name || dto.alighting_stop_id,
      seat_count: dto.seat_count, fare_amount_lkr: amount, status: 'pending_payment', payment_status: 'unpaid',
      hold_expires_at: now + HOLD_MS, scheduled_departure: Number(trip.scheduled_departure), created_at: now
    };
    await tx.query('UPDATE trips SET available_seats = available_seats - $1 WHERE id = $2', [dto.seat_count, dto.trip_id]);
    await tx.query(
      `INSERT INTO bookings (id, booking_reference, user_id, trip_id, route_id, route_number, vehicle_id, operator_id,
         boarding_stop_id, alighting_stop_id, from_name, to_name, seat_count, fare_amount_lkr, status, payment_status,
         hold_expires_at, scheduled_departure, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [row.id, row.booking_reference, row.user_id, row.trip_id, row.route_id, row.route_number, row.vehicle_id, row.operator_id,
        row.boarding_stop_id, row.alighting_stop_id, row.from_name, row.to_name, row.seat_count, row.fare_amount_lkr, row.status,
        row.payment_status, row.hold_expires_at, row.scheduled_departure, row.created_at]
    );
    return row;
  });

  cache.invalidate('active-trips');
  await audit.log({ userId: user.uid, action: 'BOOKING_CREATED', entity: 'bookings', entityId: bookingId,
    details: { trip_id: dto.trip_id, seats: dto.seat_count } });
  return formatBooking(bookingId, booking);
}

async function listMine(user) {
  const { rows } = await pool.query('SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200', [user.uid]);
  return rows.map(b => formatBooking(b.id, b));
}

async function getBooking(user, id) {
  const { rows } = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
  const b = rows[0];
  if (!b) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
  const owner = b.user_id === user.uid;
  const operator = user.role === 'operator' && b.operator_id === user.operatorId;
  if (!owner && !operator) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
  return formatBooking(b.id, b);
}

async function cancelBooking(user, id) {
  const result = await withTransaction(async (tx) => {
    const bRes = await tx.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [id]);
    const b = bRes.rows[0];
    if (!b) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    if (b.user_id !== user.uid) throw new AppError(403, 'FORBIDDEN', 'You can cancel only your own bookings');
    if (!['pending_payment', 'confirmed'].includes(b.status)) {
      throw new AppError(409, 'NOT_CANCELLABLE', 'This booking can no longer be cancelled');
    }

    if (b.trip_id) {
      const tripRes = await tx.query('SELECT * FROM trips WHERE id = $1 FOR UPDATE', [b.trip_id]);
      const trip = tripRes.rows[0];
      if (trip && trip.status !== 'scheduled') throw new AppError(409, 'TRIP_STARTED', 'The trip has already started');
      if (trip) {
        const seats = Math.min(trip.reservable_seats || 0, (trip.available_seats || 0) + b.seat_count);
        await tx.query('UPDATE trips SET available_seats = $1 WHERE id = $2', [seats, b.trip_id]);
      }
    }
    const paid = b.payment_status === 'success';
    await tx.query(
      'UPDATE bookings SET status = $1, cancelled_at = $2, refund_required = refund_required OR $3 WHERE id = $4',
      ['cancelled', Date.now(), paid, id]
    );
    return { refund: paid };
  });

  cache.invalidate('active-trips');
  await notify.sendToUser(user.uid, {
    type: 'booking_cancelled', title: 'Booking cancelled',
    message: result.refund ? 'Your booking was cancelled. The operator will process your refund.' : 'Your booking was cancelled.',
    relatedBookingId: id
  });
  await audit.log({ userId: user.uid, action: 'BOOKING_CANCELLED', entity: 'bookings', entityId: id });
  return { message: 'Booking cancelled', refund_required: result.refund };
}

// Releases unpaid seat holds. Called every minute by Cloud Scheduler (or the local timer).
async function expireHolds() {
  const { rows } = await pool.query(
    "SELECT id FROM bookings WHERE status = 'pending_payment' AND hold_expires_at <= $1 LIMIT 200", [Date.now()]
  );
  let expired = 0;

  for (const { id } of rows) {
    const notice = await withTransaction(async (tx) => {
      const fresh = (await tx.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (fresh.status !== 'pending_payment') return null; // paid or cancelled meanwhile
      const tripRes = await tx.query('SELECT * FROM trips WHERE id = $1 FOR UPDATE', [fresh.trip_id]);
      const trip = tripRes.rows[0];
      await tx.query("UPDATE bookings SET status = 'expired' WHERE id = $1", [id]);
      if (trip) {
        const seats = Math.min(trip.reservable_seats || 0, (trip.available_seats || 0) + fresh.seat_count);
        await tx.query('UPDATE trips SET available_seats = $1 WHERE id = $2', [seats, fresh.trip_id]);
      }
      return fresh;
    });
    if (notice) {
      expired++;
      await notify.sendToUser(notice.user_id, {
        type: 'booking_expired', title: 'Booking expired',
        message: 'Your seats were released because the payment was not completed in 10 minutes.',
        relatedBookingId: id
      });
    }
  }
  if (expired) cache.invalidate('active-trips');
  return expired;
}

module.exports = { formatBooking, createBooking, listMine, getBooking, cancelBooking, expireHolds, HOLD_MS };
