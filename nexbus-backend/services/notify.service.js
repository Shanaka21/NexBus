const { db, messaging, FieldValue } = require('../config/firebase');

// Writes the in-app notification, then tries to push it through FCM.
async function sendToUser(userId, { type, title, message, relatedTripId = null, relatedBookingId = null }) {
  try {
    await db.collection('notifications').add({
      user_id: userId, type, title, message,
      related_trip_id: relatedTripId, related_booking_id: relatedBookingId,
      is_read: false, created_at: Date.now()
    });

    const user = (await db.collection('users').doc(userId).get()).data();
    if (!user?.fcm_token) return;
    try {
      await messaging.send({
        token: user.fcm_token,
        notification: { title, body: message },
        data: { type, tripId: relatedTripId || '', bookingId: relatedBookingId || '' }
      });
    } catch (err) {
      // Stale tokens are removed so the failed delivery is not repeated
      if (err.code === 'messaging/registration-token-not-registered' ||
          err.code === 'messaging/invalid-registration-token') {
        await db.collection('users').doc(userId).update({ fcm_token: FieldValue.delete() });
      }
    }
  } catch (err) {
    console.error('notification failed:', err.message);
  }
}

async function delayAlert(tripId, delay) {
  const snap = await db.collection('bookings')
    .where('trip_id', '==', tripId)
    .where('booking_status', '==', 'confirmed').get();
  await Promise.all(snap.docs.map(d => sendToUser(d.data().user_id, {
    type: 'delay_alert',
    title: 'Your bus is delayed',
    message: `Your booked bus is running about ${delay} minutes late.`,
    relatedTripId: tripId,
    relatedBookingId: d.id
  })));
}

async function listForUser(userId) {
  const snap = await db.collection('notifications').where('user_id', '==', userId).get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, 100);
}

async function markRead(userId, id) {
  const ref = db.collection('notifications').doc(id);
  const doc = await ref.get();
  if (!doc.exists || doc.data().user_id !== userId) return false;
  await ref.update({ is_read: true });
  return true;
}

async function markAllRead(userId) {
  const snap = await db.collection('notifications')
    .where('user_id', '==', userId).where('is_read', '==', false).get();
  const batch = db.batch();
  snap.docs.forEach(d => batch.update(d.ref, { is_read: true }));
  await batch.commit();
  return snap.size;
}

module.exports = { sendToUser, delayAlert, listForUser, markRead, markAllRead };
