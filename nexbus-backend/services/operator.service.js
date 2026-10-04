const { db } = require('../config/firebase');
const userService = require('./user.service');
const bookingService = require('./booking.service');
const audit = require('./audit.service');
const { dayRange, colomboDate, recentDates } = require('../utils/format');

async function createDriver(user, dto) {
  const driver = await userService.createAccount({ ...dto, role: 'driver', operator_id: user.operatorId });
  await audit.log({ userId: user.uid, action: 'DRIVER_CREATED', entity: 'users', entityId: driver.uid });
  return driver;
}

async function listDrivers(user) {
  const snap = await db.collection('users').where('operator_id', '==', user.operatorId).get();
  return snap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => u.role === 'driver')
    .map(({ uid, full_name, name, email, phone, status }) => ({ uid, full_name: full_name || name, email, phone, status }));
}

// Bookings and payment status on the operator's own trips (FR-OPS-05, FR-PAY-04)
async function listBookings(user, q) {
  // Read one day, or the last 7 days when no date is chosen, using equality filters only
  const dates = q.date ? [q.date] : recentDates(7);
  const byDay = (name) => {
    const base = db.collection(name).where('operator_id', '==', user.operatorId);
    return dates.length === 1 ? base.where('created_day', '==', dates[0]) : base.where('created_day', 'in', dates);
  };
  const [bookingSnap, paymentSnap] = await Promise.all([byDay('bookings').get(), byDay('payments').get()]);
  const payments = {};
  paymentSnap.docs.forEach(d => {
    const p = d.data();
    const current = payments[p.booking_id];
    if (!current || p.created_at > current.created_at) payments[p.booking_id] = p;
  });

  let rows = bookingSnap.docs.map(d => ({
    ...bookingService.formatBooking(d.id, d.data()),
    payment: payments[d.id]
      ? { order_id: payments[d.id].order_id, gateway_payment_id: payments[d.id].gateway_payment_id || null, method: payments[d.id].method || null, status: payments[d.id].payment_status }
      : null
  }));
  if (q.status) rows = rows.filter(r => r.booking_status === q.status);
  return rows.sort((a, b) => b.created_at - a.created_at).slice(0, 300);
}

// Daily summary: trips, delays, bookings and revenue received (FR-OPS-05)
async function dailyReport(user, date) {
  const { start } = dayRange(date);
  const day = colomboDate(start + 1000);
  const forDay = (name, field) => db.collection(name).where('operator_id', '==', user.operatorId).where(field, '==', day).get();
  const [tripSnap, bookingSnap, paymentSnap] = await Promise.all([
    forDay('trips', 'service_date'), forDay('bookings', 'created_day'), forDay('payments', 'paid_day')
  ]);

  const trips = tripSnap.docs.map(d => d.data());
  const bookings = bookingSnap.docs.map(d => d.data());
  const paid = paymentSnap.docs.map(d => d.data()).filter(p => p.payment_status === 'success');

  const count = (list, status) => list.filter(t => t.status === status).length;
  return {
    date: new Date(start + 5.5 * 3600 * 1000).toISOString().slice(0, 10),
    trips: {
      total: trips.length,
      scheduled: count(trips, 'scheduled'),
      running: count(trips, 'running'),
      completed: count(trips, 'completed'),
      cancelled: count(trips, 'cancelled'),
      delayed: trips.filter(t => (t.delay_minutes || 0) >= 10).length
    },
    bookings: {
      total: bookings.length,
      confirmed: bookings.filter(b => b.booking_status === 'confirmed').length,
      completed: bookings.filter(b => b.booking_status === 'completed').length,
      cancelled: bookings.filter(b => b.booking_status === 'cancelled').length,
      expired: bookings.filter(b => b.booking_status === 'expired').length,
      pending_payment: bookings.filter(b => b.booking_status === 'pending_payment').length,
      refunds_required: bookings.filter(b => b.refund_required).length
    },
    revenue_lkr: paid.reduce((sum, p) => sum + p.amount_lkr, 0),
    payments_received: paid.length
  };
}

module.exports = { createDriver, listDrivers, listBookings, dailyReport };
