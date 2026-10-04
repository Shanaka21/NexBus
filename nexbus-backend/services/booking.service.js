const { db } = require('../config/firebase');
const { AppError } = require('../utils/errors');
const { bookingReference, lkr, clock, dateLabel, colomboDate } = require('../utils/format');
const cache = require('./cache');
const eta = require('./eta.service');
const stopService = require('./stop.service');
const notify = require('./notify.service');
const audit = require('./audit.service');

const HOLD_MS = 10 * 60 * 1000;

// Response shape: keeps the field names older clients already read (route, from, to, seats, fare, status)
function formatBooking(id, b) {
  const status = b.booking_status || b.status;
  const when = b.scheduled_departure || b.created_at;
  const amount = b.fare_amount_lkr ?? (typeof b.fare === 'number' ? b.fare : null);
  return {
    id,
    booking_reference: b.booking_reference || null,
    user_id: b.user_id,
    trip_id: b.trip_id || null,
    route: b.route_number,
    route_number: b.route_number,
    from: b.from,
    to: b.to,
    date: dateLabel(when),
    time: b.time || (b.scheduled_departure ? clock(b.scheduled_departure) : ''),
    seats: b.seat_count || b.seats || 1,
    status,
    booking_status: status,
    payment_status: b.payment_status || 'unpaid',
    fare: amount != null ? lkr(amount) : b.fare,
    fare_amount_lkr: amount,
    hold_expires_at: b.hold_expires_at || null,
    scheduled_departure: b.scheduled_departure || null,
    refund_required: !!b.refund_required,
    created_at: b.created_at
  };
}

async function createBooking(user, dto) {
  const master = await stopService.allStops();
  const tripRef = db.collection('trips').doc(dto.trip_id);
  const bookingRef = db.collection('bookings').doc();

  // Seat check and seat hold happen in one transaction: two passengers cannot take the last seat together
  const data = await db.runTransaction(async (tx) => {
    const tripSnap = await tx.get(tripRef);
    if (!tripSnap.exists) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found');
    const trip = tripSnap.data();
    if (!['scheduled', 'running'].includes(trip.status)) {
      throw new AppError(409, 'TRIP_CLOSED', 'This trip is no longer open for booking');
    }
    if (trip.status === 'scheduled' && trip.scheduled_departure < Date.now() - 10 * 60 * 1000) {
      throw new AppError(409, 'TRIP_CLOSED', 'This trip has already departed');
    }
    const route = (await tx.get(db.collection('routes').doc(trip.route_id))).data();

    const byStop = Object.fromEntries(route.stops.map(s => [s.stop_id, s]));
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
      const stops = route.stops.map(s => ({
        lat: master.get(s.stop_id)?.latitude, lng: master.get(s.stop_id)?.longitude,
        distanceFromOriginKm: s.distance_from_origin_km
      }));
      if (eta.progressKm(stops, { lat: trip.last_latitude, lng: trip.last_longitude }) > board.distance_from_origin_km) {
        throw new AppError(409, 'BOARDING_PASSED', 'The bus has already passed your boarding stop');
      }
    }
    if ((trip.available_seats || 0) < dto.seat_count) {
      throw new AppError(409, 'SEATS_UNAVAILABLE', 'Not enough seats available');
    }

    const amount = route.base_fare_lkr * dto.seat_count; // always calculated on the server
    const booking = {
      booking_reference: bookingReference(),
      user_id: user.uid,
      trip_id: dto.trip_id,
      route_id: trip.route_id,
      route_number: route.route_number,
      vehicle_id: trip.vehicle_id,
      operator_id: trip.operator_id,
      boarding_stop_id: dto.boarding_stop_id,
      alighting_stop_id: dto.alighting_stop_id,
      from: master.get(dto.boarding_stop_id)?.name || dto.boarding_stop_id,
      to: master.get(dto.alighting_stop_id)?.name || dto.alighting_stop_id,
      seat_count: dto.seat_count,
      fare_amount_lkr: amount,
      booking_status: 'pending_payment',
      status: 'pending_payment',
      payment_status: 'unpaid',
      hold_expires_at: Date.now() + HOLD_MS,
      scheduled_departure: trip.scheduled_departure,
      time: clock(trip.scheduled_departure),
      created_at: Date.now(),
      created_day: colomboDate()
    };
    tx.update(tripRef, { available_seats: trip.available_seats - dto.seat_count });
    tx.set(bookingRef, booking);
    return booking;
  });

  cache.invalidate('active-trips');
  await audit.log({ userId: user.uid, action: 'BOOKING_CREATED', entity: 'bookings', entityId: bookingRef.id,
    details: { trip_id: dto.trip_id, seats: dto.seat_count } });
  return formatBooking(bookingRef.id, data);
}

async function listMine(user) {
  const snap = await db.collection('bookings').where('user_id', '==', user.uid).get();
  return snap.docs
    .map(d => formatBooking(d.id, d.data()))
    .sort((a, b) => b.created_at - a.created_at);
}

async function getBooking(user, id) {
  const doc = await db.collection('bookings').doc(id).get();
  if (!doc.exists) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
  const b = doc.data();
  const owner = b.user_id === user.uid;
  const operator = user.role === 'operator' && b.operator_id === user.operatorId;
  if (!owner && !operator) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
  return formatBooking(doc.id, b);
}

async function cancelBooking(user, id) {
  const ref = db.collection('bookings').doc(id);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    const b = snap.data();
    if (b.user_id !== user.uid) throw new AppError(403, 'FORBIDDEN', 'You can cancel only your own bookings');
    if (!['pending_payment', 'confirmed'].includes(b.booking_status || b.status)) {
      throw new AppError(409, 'NOT_CANCELLABLE', 'This booking can no longer be cancelled');
    }

    if (b.trip_id) {
      const tripRef = db.collection('trips').doc(b.trip_id);
      const trip = (await tx.get(tripRef)).data();
      if (trip && trip.status !== 'scheduled') {
        throw new AppError(409, 'TRIP_STARTED', 'The trip has already started');
      }
      if (trip) {
        const seats = Math.min(trip.reservable_seats || 0, (trip.available_seats || 0) + b.seat_count);
        tx.update(tripRef, { available_seats: seats });
      }
    }
    const paid = b.payment_status === 'success';
    tx.update(ref, {
      booking_status: 'cancelled', status: 'cancelled', cancelled_at: Date.now(),
      ...(paid ? { refund_required: true } : {})
    });
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
  const snap = await db.collection('bookings').where('booking_status', '==', 'pending_payment').get();
  const due = snap.docs.filter(d => (d.data().hold_expires_at || 0) <= Date.now()).slice(0, 200);
  let expired = 0;

  for (const doc of due) {
    const notice = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      const b = fresh.data();
      if (b.booking_status !== 'pending_payment') return null; // paid or cancelled meanwhile
      const tripRef = db.collection('trips').doc(b.trip_id);
      const trip = (await tx.get(tripRef)).data();
      tx.update(doc.ref, { booking_status: 'expired', status: 'expired' });
      if (trip) {
        tx.update(tripRef, {
          available_seats: Math.min(trip.reservable_seats || 0, (trip.available_seats || 0) + b.seat_count)
        });
      }
      return b;
    });
    if (notice) {
      expired++;
      await notify.sendToUser(notice.user_id, {
        type: 'booking_expired', title: 'Booking expired',
        message: 'Your seats were released because the payment was not completed in 10 minutes.',
        relatedBookingId: doc.id
      });
    }
  }
  if (expired) cache.invalidate('active-trips');
  return expired;
}

module.exports = { formatBooking, createBooking, listMine, getBooking, cancelBooking, expireHolds, HOLD_MS };
