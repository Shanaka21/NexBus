const crypto = require('crypto');
const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../utils/errors');
const notify = require('./notify.service');
const audit = require('./audit.service');
const cache = require('./cache');

const md5u = (s) => crypto.createHash('md5').update(s).digest('hex').toUpperCase();
const STATUS = { '2': 'success', '0': 'pending', '-1': 'canceled', '-2': 'failed', '-3': 'chargedback' };

const cfg = () => ({
  merchantId: process.env.PAYHERE_MERCHANT_ID,
  secret: process.env.PAYHERE_MERCHANT_SECRET,
  sandbox: process.env.PAYHERE_SANDBOX !== 'false',
  baseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`
});

// md5sig = UPPER(MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + UPPER(MD5(secret))))
function expectedSignature(n, secret) {
  return md5u(n.merchant_id + n.order_id + n.payhere_amount + n.payhere_currency + n.status_code + md5u(secret));
}

function validSignature(n, secret = cfg().secret) {
  if (!secret) return false;
  const expected = expectedSignature(n, secret);
  const given = String(n.md5sig || '').toUpperCase();
  return given.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

// Builds the PayHere payment object. The amount always comes from the stored booking.
async function createCheckout(user, bookingId) {
  const { merchantId, sandbox, baseUrl } = cfg();
  if (!merchantId) throw new AppError(500, 'PAYMENT_NOT_CONFIGURED', 'Online payment is not configured');

  const bRes = await pool.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
  const b = bRes.rows[0];
  if (!b || b.user_id !== user.uid) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
  if (b.status !== 'pending_payment' || Number(b.hold_expires_at || 0) < Date.now()) {
    throw new AppError(409, 'BOOKING_NOT_PAYABLE', 'This booking can no longer be paid. Please book again');
  }

  const profileRes = await pool.query('SELECT * FROM users WHERE id = $1', [user.uid]);
  const profile = profileRes.rows[0] || {};
  const orderId = `${b.booking_reference}-${Date.now().toString(36)}`;
  const amount = Number(b.fare_amount_lkr).toFixed(2);
  const now = Date.now();

  await pool.query(
    `INSERT INTO payments (id, booking_id, user_id, operator_id, amount_lkr, currency, payment_status, created_at)
     VALUES ($1,$2,$3,$4,$5,'LKR','pending',$6)`,
    [orderId, bookingId, user.uid, b.operator_id || null, Number(amount), now]
  );

  await pool.query("UPDATE bookings SET payment_status = 'pending' WHERE id = $1", [bookingId]);

  const fullName = profile.full_name || 'NexBus Passenger';
  const [firstName, ...rest] = fullName.split(' ');
  return {
    sandbox,
    merchant_id: merchantId,
    notify_url: `${baseUrl}/payments/notify`,
    order_id: orderId,
    items: `NexBus booking ${b.booking_reference}`,
    amount,
    currency: 'LKR',
    first_name: firstName,
    last_name: rest.join(' ') || '-',
    email: profile.email || user.email || 'noreply@nexbus.lk',
    phone: profile.phone || '0000000000',
    address: '-',
    city: 'Colombo',
    country: 'Sri Lanka'
  };
}

// Applies a verified PayHere notification. Idempotent: a repeated notification changes nothing.
async function handleNotify(n) {
  const { merchantId } = cfg();
  if (n.merchant_id !== merchantId || !validSignature(n)) {
    throw new AppError(400, 'INVALID_SIGNATURE', 'Invalid payment signature');
  }

  const outcome = await withTransaction(async (tx) => {
    const paymentRes = await tx.query('SELECT * FROM payments WHERE id = $1 FOR UPDATE', [n.order_id]);
    const p = paymentRes.rows[0];
    if (!p) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');

    if (Number(n.payhere_amount).toFixed(2) !== Number(p.amount_lkr).toFixed(2) || n.payhere_currency !== p.currency) {
      throw new AppError(400, 'AMOUNT_MISMATCH', 'Payment amount does not match the booking');
    }
    if (p.payment_status === 'success') return { duplicate: true };

    const bookingRes = await tx.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [p.booking_id]);
    const b = bookingRes.rows[0];
    const tripRes = await tx.query('SELECT * FROM trips WHERE id = $1 FOR UPDATE', [b.trip_id]);
    const trip = tripRes.rows[0];

    const status = STATUS[n.status_code] || 'failed';
    const now = Date.now();
    let confirmed = false;
    let needsReview = false;
    let bookingStatus = b.status;
    let refundRequired = b.refund_required;

    if (status === 'success') {
      const seatsFree = trip && ['scheduled', 'running'].includes(trip.status) && trip.available_seats >= b.seat_count;
      if (b.status === 'pending_payment') {
        confirmed = true;
      } else if (b.status === 'expired' && seatsFree) {
        // Paid after the hold expired but the seats are still free: re-hold and confirm
        await tx.query('UPDATE trips SET available_seats = available_seats - $1 WHERE id = $2', [b.seat_count, b.trip_id]);
        confirmed = true;
      } else {
        // Paid after expiry/cancellation with no seats left, or a second payment: operator must refund
        needsReview = true;
        refundRequired = true;
      }
      if (confirmed) bookingStatus = 'confirmed';
    }

    await tx.query(
      'UPDATE payments SET payment_status = $1, status_code = $2, gateway_payment_id = $3, method = $4, updated_at = $5, needs_review = $6 WHERE id = $7',
      [status, Number(n.status_code), n.payment_id || null, n.method || null, now, needsReview, n.order_id]
    );
    await tx.query(
      'UPDATE bookings SET payment_status = $1, status = $2, refund_required = $3 WHERE id = $4',
      [status, bookingStatus, refundRequired, p.booking_id]
    );
    return { status, confirmed, userId: b.user_id, bookingId: p.booking_id, reference: b.booking_reference, review: needsReview };
  });

  if (outcome.duplicate) return outcome;
  cache.invalidate('active-trips');
  await afterPayment(outcome);
  return outcome;
}

async function afterPayment(o) {
  const messages = {
    success: o.confirmed
      ? ['Booking confirmed', `Payment received. Your booking ${o.reference} is confirmed.`]
      : ['Payment needs review', `We received your payment for ${o.reference} but could not hold the seats. The operator will arrange a refund.`],
    failed: ['Payment failed', `The payment for booking ${o.reference} failed. You can try again before the hold expires.`],
    canceled: ['Payment cancelled', `The payment for booking ${o.reference} was cancelled. You can try again before the hold expires.`]
  };
  if (messages[o.status]) {
    await notify.sendToUser(o.userId, {
      type: o.status === 'success' ? 'booking_confirmed' : 'payment_failed',
      title: messages[o.status][0], message: messages[o.status][1], relatedBookingId: o.bookingId
    });
  }
  await audit.log({ userId: o.userId, action: `PAYMENT_${o.status.toUpperCase()}`, entity: 'bookings', entityId: o.bookingId,
    severity: o.review ? 'warning' : 'info' });
}

// Sandbox helper: lets the app be demonstrated without a PayHere merchant account or public notify URL.
// It builds a correctly signed notification and sends it through the same verification path as the real one.
async function simulate(user, orderId, statusCode = '2') {
  if (process.env.PAYHERE_SIMULATE !== 'true') throw new AppError(404, 'NOT_FOUND', 'Not found');
  const { merchantId, secret } = cfg();
  if (!merchantId || !secret) throw new AppError(500, 'PAYMENT_NOT_CONFIGURED', 'Online payment is not configured');

  const pRes = await pool.query('SELECT * FROM payments WHERE id = $1', [orderId]);
  const p = pRes.rows[0];
  if (!p || p.user_id !== user.uid) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');

  const n = {
    merchant_id: merchantId, order_id: orderId, payment_id: `SIM${Date.now()}`,
    payhere_amount: Number(p.amount_lkr).toFixed(2), payhere_currency: p.currency,
    status_code: String(statusCode), method: 'VISA'
  };
  n.md5sig = expectedSignature(n, secret);
  return handleNotify(n);
}

async function rejected(n, reason) {
  await audit.log({ action: 'PAYMENT_NOTIFY_REJECTED', entity: 'payments', entityId: n?.order_id || null,
    severity: 'security', details: { reason } });
}

module.exports = { createCheckout, handleNotify, simulate, rejected, validSignature, expectedSignature, md5u, STATUS };
