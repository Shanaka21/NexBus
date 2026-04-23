const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

// Get bookings (filtered by user_id if provided)
router.get('/', async (req, res) => {
  const { user_id } = req.query;
  try {
    const snapshot = await admin.firestore()
      .collection('bookings')
      .orderBy('created_at', 'desc')
      .get();

    let docs = snapshot.docs;
    if (user_id) {
      docs = docs.filter(doc => doc.data().user_id === user_id);
    }

    const bookings = docs.map(doc => {
      const data = doc.data();
      const date = new Date(data.created_at);
      const formatted = date.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
      return {
        id: doc.id,
        user_id: data.user_id,
        route: data.route_number,
        from: data.from,
        to: data.to,
        date: formatted,
        time: data.time,
        seats: data.seats,
        status: data.status,
        fare: data.fare
      };
    });

    res.json(bookings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Create a booking
router.post('/', async (req, res) => {
  const { user_id, route_number, from, to, time, seats, fare } = req.body;
  try {
    const booking = {
      user_id,
      route_number,
      from,
      to,
      time,
      seats,
      fare,
      status: 'confirmed',
      created_at: Date.now()
    };
    const docRef = await admin.firestore().collection('bookings').add(booking);
    res.json({ message: 'Booking created', id: docRef.id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Cancel a booking
router.put('/:id/cancel', async (req, res) => {
  const { id } = req.params;
  try {
    await admin.firestore().collection('bookings').doc(id).update({ status: 'cancelled' });
    res.json({ message: 'Booking cancelled' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
