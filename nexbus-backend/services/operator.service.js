const { pool } = require('../config/db');
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
  const { rows } = await pool.query("SELECT * FROM users WHERE operator_id = $1 AND role = 'driver'", [user.operatorId]);
  return rows.map(({ id, full_name, email, phone, status }) => ({ uid: id, full_name, email, phone, status }));
}

// Bookings and payment status on the operator's own trips (FR-OPS-05, FR-PAY-04)
async function listBookings(user, q) {
  // Read one day, or the last 7 days when no date is chosen
  const since = q.date ? new Date(`${q.date}T00:00:00+05:30`).getTime() : Date.now() - 7 * 86400000;
  const [bookingRes, paymentRes] = await Promise.all([
    pool.query('SELECT * FROM bookings WHERE operator_id = $1 AND created_at >= $2', [user.operatorId, since]),
    pool.query('SELECT * FROM payments WHERE operator_id = $1 AND created_at >= $2', [user.operatorId, since])
  ]);
  const payments = {};
  paymentRes.rows.forEach(p => {
    const current = payments[p.booking_id];
    if (!current || Number(p.created_at) > Number(current.created_at)) payments[p.booking_id] = p;
  });

  let rows = bookingRes.rows.map(b => ({
    ...bookingService.formatBooking(b.id, b),
    payment: payments[b.id]
      ? { order_id: payments[b.id].id, gateway_payment_id: payments[b.id].gateway_payment_id || null, method: payments[b.id].method || null, status: payments[b.id].payment_status }
      : null
  }));
  if (q.status) rows = rows.filter(r => r.booking_status === q.status);
  return rows.sort((a, b) => b.created_at - a.created_at).slice(0, 300);
}

// Daily summary: trips, delays, bookings and revenue received (FR-OPS-05)
async function dailyReport(user, date) {
  const { start } = dayRange(date);
  const end = start + 86400000;
  const day = colomboDate(start + 1000);
  const [tripRes, bookingRes, paymentRes] = await Promise.all([
    pool.query('SELECT * FROM trips WHERE operator_id = $1 AND service_date = $2', [user.operatorId, day]),
    pool.query('SELECT * FROM bookings WHERE operator_id = $1 AND created_at >= $2 AND created_at < $3', [user.operatorId, start, end]),
    pool.query("SELECT * FROM payments WHERE operator_id = $1 AND payment_status = 'success' AND updated_at >= $2 AND updated_at < $3", [user.operatorId, start, end])
  ]);

  const trips = tripRes.rows;
  const bookings = bookingRes.rows;
  const paid = paymentRes.rows;

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
      confirmed: bookings.filter(b => b.status === 'confirmed').length,
      completed: bookings.filter(b => b.status === 'completed').length,
      cancelled: bookings.filter(b => b.status === 'cancelled').length,
      expired: bookings.filter(b => b.status === 'expired').length,
      pending_payment: bookings.filter(b => b.status === 'pending_payment').length,
      refunds_required: bookings.filter(b => b.refund_required).length
    },
    revenue_lkr: paid.reduce((sum, p) => sum + Number(p.amount_lkr), 0),
    payments_received: paid.length
  };
}

module.exports = { createDriver, listDrivers, listBookings, dailyReport };
