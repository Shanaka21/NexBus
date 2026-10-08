const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../utils/errors');
const cache = require('./cache');
const notify = require('./notify.service');
const audit = require('./audit.service');

const TOPUP_MIN_LKR = 100;
const TOPUP_MAX_LKR = 50000;

const money = (n) => Number(n).toFixed(2);

// Adds `amount` (positive) to the user's balance inside the caller's transaction and records it.
// Throws a unique violation if (type, reference) was already applied, which rolls the caller back.
async function credit(tx, userId, amount, type, reference, note) {
  const { rows } = await tx.query(
    'UPDATE users SET wallet_balance_lkr = wallet_balance_lkr + $1 WHERE id = $2 RETURNING wallet_balance_lkr',
    [amount, userId]
  );
  const balance = rows[0].wallet_balance_lkr;
  await tx.query(
    `INSERT INTO wallet_transactions (user_id, type, amount_lkr, balance_after, reference, note, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, type, amount, balance, reference, note || null, Date.now()]
  );
  return Number(balance);
}

// Remembers the card used for a successful top-up from the masked details PayHere reports. Only the brand and the
// last 4 digits are taken from the number, so a full card number can never be stored even if one were sent.
async function saveCard(tx, userId, n, paymentId) {
  const last4 = (String(n.card_no || '').match(/(\d{4})\D*$/) || [])[1];
  if (!last4) return null;
  const brand = String(n.method || 'CARD').toUpperCase().slice(0, 20);
  const expiry = /^(\d{2})\/?(\d{2})$/.exec(String(n.card_expiry || ''));
  const now = Date.now();
  await tx.query(
    `INSERT INTO saved_cards (user_id, brand, last4, holder_name, expiry, source_payment_id, created_at, last_used_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
     ON CONFLICT (user_id, brand, last4) DO UPDATE SET holder_name = EXCLUDED.holder_name, expiry = EXCLUDED.expiry, last_used_at = EXCLUDED.last_used_at`,
    [userId, brand, last4, n.card_holder_name || null, expiry ? `${expiry[1]}/${expiry[2]}` : null, paymentId, now]
  );
  return { brand, last4 };
}

async function removeCard(user, cardId) {
  const { rowCount } = await pool.query('DELETE FROM saved_cards WHERE id = $1 AND user_id = $2', [cardId, user.uid]);
  if (!rowCount) throw new AppError(404, 'CARD_NOT_FOUND', 'Card not found');
  await audit.log({ userId: user.uid, action: 'CARD_REMOVED', entity: 'saved_cards', entityId: String(cardId) });
  return { message: 'Card removed' };
}

async function getWallet(user) {
  const [balanceRes, txRes, cardRes] = await Promise.all([
    pool.query('SELECT wallet_balance_lkr FROM users WHERE id = $1', [user.uid]),
    pool.query(
      `SELECT id, type, amount_lkr, balance_after, reference, note, created_at
       FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 50`,
      [user.uid]
    ),
    pool.query(
      'SELECT id, brand, last4, holder_name, expiry FROM saved_cards WHERE user_id = $1 ORDER BY last_used_at DESC',
      [user.uid]
    )
  ]);
  return {
    cards: cardRes.rows.map((c) => ({ id: String(c.id), brand: c.brand, last4: c.last4, holder_name: c.holder_name, expiry: c.expiry })),
    balance: Number(balanceRes.rows[0]?.wallet_balance_lkr || 0),
    currency: 'LKR',
    min_topup: TOPUP_MIN_LKR,
    max_topup: TOPUP_MAX_LKR,
    transactions: txRes.rows.map((t) => ({
      id: String(t.id), type: t.type, amount: Number(t.amount_lkr), balance_after: Number(t.balance_after),
      reference: t.reference, note: t.note, created_at: Number(t.created_at)
    }))
  };
}

// Pays a held booking from the wallet balance. The booking is confirmed in the same transaction that
// spends the money, so the balance and the booking can never disagree.
async function payBooking(user, bookingId) {
  const result = await withTransaction(async (tx) => {
    const bRes = await tx.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [bookingId]);
    const b = bRes.rows[0];
    if (!b || b.user_id !== user.uid) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    if (b.status !== 'pending_payment' || Number(b.hold_expires_at || 0) < Date.now()) {
      throw new AppError(409, 'BOOKING_NOT_PAYABLE', 'This booking can no longer be paid. Please book again');
    }

    const fare = Number(b.fare_amount_lkr);
    const uRes = await tx.query('SELECT wallet_balance_lkr FROM users WHERE id = $1 FOR UPDATE', [user.uid]);
    const balance = Number(uRes.rows[0].wallet_balance_lkr);
    if (balance < fare) {
      throw new AppError(402, 'INSUFFICIENT_BALANCE',
        `Your wallet balance (LKR ${money(balance)}) is not enough for this booking (LKR ${money(fare)}). Please top up.`);
    }

    const newBalance = await credit(tx, user.uid, -fare, 'booking_payment', bookingId, `Booking ${b.booking_reference}`);
    const now = Date.now();
    await tx.query(
      `INSERT INTO payments (id, booking_id, user_id, operator_id, amount_lkr, currency, payment_status, status_code, method, created_at, updated_at, purpose)
       VALUES ($1,$2,$3,$4,$5,'LKR','success',2,'WALLET',$6,$6,'booking')`,
      [`${b.booking_reference}-W${now.toString(36)}`, bookingId, user.uid, b.operator_id || null, fare, now]
    );
    await tx.query("UPDATE bookings SET status = 'confirmed', payment_status = 'success' WHERE id = $1", [bookingId]);
    return { reference: b.booking_reference, balance: newBalance };
  });

  cache.invalidate('active-trips');
  await notify.sendToUser(user.uid, {
    type: 'booking_confirmed', title: 'Booking confirmed',
    message: `Paid from your wallet. Your booking ${result.reference} is confirmed.`, relatedBookingId: bookingId
  });
  await audit.log({ userId: user.uid, action: 'PAYMENT_WALLET', entity: 'bookings', entityId: bookingId });
  return { message: 'Booking confirmed', balance: result.balance };
}

// Used when a wallet-paid booking is cancelled: puts the fare back on the balance.
async function refundBooking(tx, userId, booking) {
  const amount = Number(booking.fare_amount_lkr);
  await credit(tx, userId, amount, 'refund', booking.id, `Refund for booking ${booking.booking_reference}`);
  return amount;
}

module.exports = { credit, saveCard, removeCard, getWallet, payBooking, refundBooking, TOPUP_MIN_LKR, TOPUP_MAX_LKR };
