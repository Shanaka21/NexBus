const crypto = require('crypto');
const { pool } = require('../config/db');

// Writes the in-app notification, then tries to push it through Expo's push service.
async function sendToUser(userId, { type, title, message, relatedTripId = null, relatedBookingId = null }) {
  try {
    const id = crypto.randomUUID();
    await pool.query(
      'INSERT INTO notifications (id, user_id, type, title, message, related_trip_id, related_booking_id, is_read, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8)',
      [id, userId, type, title, message, relatedTripId, relatedBookingId, Date.now()]
    );

    const { rows } = await pool.query('SELECT push_token FROM users WHERE id = $1', [userId]);
    const pushToken = rows[0]?.push_token;
    if (!pushToken) return;
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          to: pushToken, title, body: message,
          data: { type, tripId: relatedTripId || '', bookingId: relatedBookingId || '' }
        })
      });
      const data = await res.json();
      const ticket = data?.data;
      if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        await pool.query('UPDATE users SET push_token = NULL WHERE id = $1', [userId]);
      }
    } catch (err) {
      console.error('push send failed:', err.message);
    }
  } catch (err) {
    console.error('notification failed:', err.message);
  }
}

async function delayAlert(tripId, delay) {
  const { rows } = await pool.query("SELECT user_id, id FROM bookings WHERE trip_id = $1 AND status = 'confirmed'", [tripId]);
  await Promise.all(rows.map(b => sendToUser(b.user_id, {
    type: 'delay_alert',
    title: 'Your bus is delayed',
    message: `Your booked bus is running about ${delay} minutes late.`,
    relatedTripId: tripId,
    relatedBookingId: b.id
  })));
}

async function listForUser(userId) {
  const { rows } = await pool.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [userId]);
  return rows.map(n => ({ ...n, created_at: Number(n.created_at) }));
}

async function markRead(userId, id) {
  const { rows } = await pool.query('SELECT user_id FROM notifications WHERE id = $1', [id]);
  if (!rows[0] || rows[0].user_id !== userId) return false;
  await pool.query('UPDATE notifications SET is_read = true WHERE id = $1', [id]);
  return true;
}

async function markAllRead(userId) {
  const { rowCount } = await pool.query('UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false', [userId]);
  return rowCount;
}

module.exports = { sendToUser, delayAlert, listForUser, markRead, markAllRead };
