const { db } = require('../config/firebase');
const { AppError } = require('../utils/errors');
const notify = require('./notify.service');
const { colomboDate } = require('../utils/format');
const cache = require('./cache');

const ALLOWED = { // current status -> allowed next status
  scheduled: ['running', 'cancelled'],
  running: ['completed']
};

async function createTrip(user, dto) {
  const [vehicleDoc, routeDoc, driverDoc] = await Promise.all([
    db.collection('vehicles').doc(dto.vehicle_id).get(),
    db.collection('routes').doc(dto.route_id).get(),
    db.collection('users').doc(dto.driver_id).get()
  ]);
  if (!routeDoc.exists) throw new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found');
  if (!vehicleDoc.exists) throw new AppError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found');
  const vehicle = vehicleDoc.data();
  const route = routeDoc.data();
  if (vehicle.operator_id !== user.operatorId) throw new AppError(403, 'FORBIDDEN', 'This vehicle belongs to another company');
  if (vehicle.route_id !== dto.route_id) throw new AppError(400, 'VEHICLE_ROUTE_MISMATCH', 'This vehicle is not permitted on that route');

  const driver = driverDoc.exists ? driverDoc.data() : null;
  if (!driver || driver.role !== 'driver' || driver.operator_id !== user.operatorId) {
    throw new AppError(400, 'DRIVER_INVALID', 'Driver must be a driver account of your company');
  }

  const reservable = vehicle.reservable_seats || 0;
  const data = {
    route_id: dto.route_id,
    route_number: route.route_number,
    vehicle_id: dto.vehicle_id,
    registration_no: vehicle.registration_no || vehicle.bus_number,
    operator_id: user.operatorId,
    driver_id: dto.driver_id,
    driver_name: driver.full_name || driver.name || '',
    scheduled_departure: +dto.scheduled_departure,
    service_date: colomboDate(+dto.scheduled_departure),
    actual_departure: null,
    direction: dto.direction || 'outbound',
    status: 'scheduled',
    delay_minutes: 0,
    reservable_seats: reservable,
    available_seats: reservable,
    created_at: Date.now()
  };
  const ref = await db.collection('trips').add(data);
  cache.invalidate();
  return { id: ref.id, ...data };
}

// Trips are always read for a small window of service dates (one day when a date is given, otherwise
// yesterday to tomorrow) with equality filters only, so a query never reads the whole collection.
async function listTrips(user, q) {
  const dates = q.date ? [q.date] : [colomboDate(Date.now() - 86400000), colomboDate(), colomboDate(Date.now() + 86400000)];
  let query = db.collection('trips');
  query = dates.length === 1 ? query.where('service_date', '==', dates[0]) : query.where('service_date', 'in', dates);

  if (q.route_id) query = query.where('route_id', '==', q.route_id);
  if (user.role === 'driver') query = query.where('driver_id', '==', user.uid);
  if (user.role === 'operator') query = query.where('operator_id', '==', user.operatorId);

  let trips = (await query.get()).docs.map(d => ({ id: d.id, ...d.data() }));

  if (q.status) trips = trips.filter(t => t.status === q.status);
  else if (user.role === 'passenger' || user.role === 'admin') trips = trips.filter(t => ['scheduled', 'running'].includes(t.status));
  return trips.sort((a, b) => a.scheduled_departure - b.scheduled_departure);
}

async function getAvailability(tripId) {
  const trip = (await db.collection('trips').doc(tripId).get()).data();
  if (!trip) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found');
  const route = (await db.collection('routes').doc(trip.route_id).get()).data() || {};
  return {
    trip_id: tripId,
    status: trip.status,
    scheduled_departure: trip.scheduled_departure,
    reservable_seats: trip.reservable_seats || 0,
    available_seats: trip.available_seats || 0,
    fare_lkr: route.base_fare_lkr || 0,
    delay_minutes: trip.delay_minutes || 0
  };
}

// Start / complete / cancel a trip, with ownership checks (Appendix B.1)
async function changeStatus(user, tripId, next) {
  const ref = db.collection('trips').doc(tripId);
  const trip = (await ref.get()).data();
  if (!trip) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found');

  const isDriver = user.role === 'driver' && trip.driver_id === user.uid;
  const isOperator = user.role === 'operator' && trip.operator_id === user.operatorId;
  if (!isDriver && !isOperator) throw new AppError(403, 'FORBIDDEN', 'You cannot change this trip');
  if (!(ALLOWED[trip.status] || []).includes(next)) {
    throw new AppError(409, 'INVALID_STATUS_CHANGE', `A ${trip.status} trip cannot become ${next}`);
  }

  const update = { status: next };
  if (next === 'running') update.actual_departure = Date.now();
  await ref.update(update);
  cache.invalidate();

  const vehicleRef = db.collection('vehicles').doc(trip.vehicle_id);
  if (next === 'running') {
    await vehicleRef.update({ current_trip_id: tripId, status: 'active' });
  }

  if (next === 'completed' || next === 'cancelled') {
    await vehicleRef.update({ current_trip_id: null, delay_minutes: 0 });
    const snap = await db.collection('bookings').where('trip_id', '==', tripId).get();
    const open = snap.docs.filter(d => ['confirmed', 'pending_payment'].includes(d.data().booking_status));
    const batch = db.batch();
    const notices = [];
    open.forEach(d => {
      const b = d.data();
      let status;
      if (next === 'completed') status = b.booking_status === 'confirmed' ? 'completed' : 'expired';
      else status = b.booking_status === 'confirmed' ? 'cancelled' : 'expired';
      const patch = { booking_status: status, status };
      if (next === 'cancelled' && b.booking_status === 'confirmed') patch.refund_required = true;
      batch.update(d.ref, patch);
      if (next === 'cancelled') {
        notices.push(notify.sendToUser(b.user_id, {
          type: 'trip_cancelled', title: 'Trip cancelled',
          message: `Your trip on route ${trip.route_number} was cancelled by the operator.`
            + (patch.refund_required ? ' A refund will be arranged.' : ''),
          relatedTripId: tripId, relatedBookingId: d.id
        }));
      }
    });
    await batch.commit();
    await Promise.all(notices);
  }
  return { id: tripId, status: next };
}

module.exports = { createTrip, listTrips, getAvailability, changeStatus };
