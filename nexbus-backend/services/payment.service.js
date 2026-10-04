const crypto = require('crypto');
const { db } = require('../config/firebase');
const { AppError } = require('../utils/errors');
const notify = require('./notify.service');
const audit = require('./audit.service');
const cache = require('./cache');
const { colomboDate } = require('../utils/format');

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

  const bookingRef = db.collection('bookings').doc(bookingId);
  const b = (await bookingRef.get()).data();
  if (!b || b.user_id !== user.uid) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
  if (b.booking_status !== 'pending_payment' || (b.hold_expires_at || 0) < Date.now()) {
    throw new AppError(409, 'BOOKING_NOT_PAYABLE', 'This booking can no longer be paid. Please book again');
  }

  const profile = (await db.collection('users').doc(user.uid).get()).data() || {};
  const orderId = `${b.booking_reference}-${Date.now().toString(36)}`;
  const amount = Number(b.fare_amount_lkr).toFixed(2);

  await db.collection('payments').doc(orderId).set({
    booking_id: bookingId, order_id: orderId, user_id: user.uid, operator_id: b.operator_id || null,
    amount_lkr: Number(amount), currency: 'LKR', payment_status: 'pending', created_at: Date.now(), created_day: colomboDate()
  });
  await bookingRef.update({ payment_status: 'pending' });

  const fullName = profile.full_name || profile.name || 'NexBus Passenger';
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

  const paymentRef = db.collection('payments').doc(n.order_id);
  const outcome = await db.runTransaction(async (tx) => {
    const paymentSnap = await tx.get(paymentRef);
    if (!paymentSnap.exists) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
    const p = paymentSnap.data();

    if (Number(n.payhere_amount).toFixed(2) !== Number(p.amount_lkr).toFixed(2) || n.payhere_currency !== p.currency) {
      throw new AppError(400, 'AMOUNT_MISMATCH', 'Payment amount does not match the booking');
    }
    if (p.payment_status === 'success') return { duplicate: true };

    const bookingRef = db.collection('bookings').doc(p.booking_id);
    const bookingSnap = await tx.get(bookingRef);
    const b = bookingSnap.data();
    const tripRef = db.collection('trips').doc(b.trip_id);
    const trip = (await tx.get(tripRef)).data();

    const status = STATUS[n.status_code] || 'failed';
    const paymentPatch = {
      payment_status: status, status_code: Number(n.status_code),
      gateway_payment_id: n.payment_id || null, method: n.method || null, updated_at: Date.now()
    };
    if (status === 'success') paymentPatch.paid_day = colomboDate();
    const bookingPatch = { payment_status: status };
    let confirmed = false;

    if (status === 'success') {
      const seatsFree = trip && ['scheduled', 'running'].includes(trip.status) && trip.available_seats >= b.seat_count;
      if (b.booking_status === 'pending_payment') {
        confirmed = true;
      } else if (b.booking_status === 'expired' && seatsFree) {
        // Paid after the hold expired but the seats are still free: re-hold and confirm
        tx.update(tripRef, { available_seats: trip.available_seats - b.seat_count });
        confirmed = true;
      } else {
        // Paid after expiry/cancellation with no seats left, or a second payment: operator must refund
        paymentPatch.needs_review = true;
        bookingPatch.refund_required = true;
      }
      if (confirmed) Object.assign(bookingPatch, { booking_status: 'confirmed', status: 'confirmed' });
    }

    tx.update(paymentRef, paymentPatch);
    tx.update(bookingRef, bookingPatch);
    return { status, confirmed, userId: b.user_id, bookingId: p.booking_id, reference: b.booking_reference, review: !!paymentPatch.needs_review };
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

  const p = (await db.collection('payments').doc(orderId).get()).data();
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
