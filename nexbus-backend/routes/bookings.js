const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

function formatBooking(doc) {
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
}

// Get all bookings (filtered by user_id if provided)
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

    res.json(docs.map(formatBooking));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single booking by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await admin.firestore().collection('bookings').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(formatBooking(doc));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a booking
router.post('/', async (req, res) => {
  const { user_id, route_number, from, to, time, seats, fare } = req.body;
  if (!user_id || !route_number || !from || !to) {
    return res.status(400).json({ error: 'user_id, route_number, from, and to are required' });
  }
  try {
    const booking = {
      user_id,
      route_number,
      from,
      to,
      time: time || '',
      seats: seats || 1,
      fare: fare || 0,
      status: 'confirmed',
      created_at: Date.now()
    };
    const docRef = await admin.firestore().collection('bookings').add(booking);
    res.json({ message: 'Booking created', id: docRef.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update booking status (complete, etc.)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const valid = ['confirmed', 'cancelled', 'completed'];
  if (!status || !valid.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
  }
  try {
    await admin.firestore().collection('bookings').doc(id).update({ status });
    res.json({ message: 'Booking updated', status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seed demo bookings for a user (routes 17, 05, 48 with real SL data)
router.post('/seed', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const now = Date.now();
  const day = 86400000;

  const DEMO = [
    // Route 48 – Fort → Kandy (Semi-Luxury Express, 116 km, LKR 420/seat)
    {
      user_id, route_number: '48', from: 'Fort', to: 'Kandy',
      time: '07:00 AM', seats: 2, fare: 'LKR 840',
      status: 'confirmed', created_at: now - day
    },
    {
      user_id, route_number: '48', from: 'Fort', to: 'Kandy',
      time: '03:00 PM', seats: 1, fare: 'LKR 420',
      status: 'cancelled', created_at: now - 3 * day
    },
    // Route 17 – Panadura → Kandy (Ordinary, 135 km, LKR 350/seat)
    {
      user_id, route_number: '17', from: 'Panadura', to: 'Kandy',
      time: '05:30 AM', seats: 1, fare: 'LKR 350',
      status: 'completed', created_at: now - 5 * day
    },
    {
      user_id, route_number: '17', from: 'Panadura', to: 'Kandy',
      time: '12:00 PM', seats: 2, fare: 'LKR 700',
      status: 'confirmed', created_at: now - 2 * day
    },
    // Route 05 – Fort → Kurunegala (Ordinary, 94 km, LKR 245/seat)
    {
      user_id, route_number: '05', from: 'Fort', to: 'Kurunegala',
      time: '09:00 AM', seats: 2, fare: 'LKR 490',
      status: 'completed', created_at: now - 7 * day
    },
    {
      user_id, route_number: '05', from: 'Fort', to: 'Kurunegala',
      time: '05:30 AM', seats: 1, fare: 'LKR 245',
      status: 'completed', created_at: now - 10 * day
    },
  ];

  try {
    const batch = admin.firestore().batch();
    for (const booking of DEMO) {
      batch.set(admin.firestore().collection('bookings').doc(), booking);
    }
    await batch.commit();
    res.json({ message: 'Demo bookings seeded', count: DEMO.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel a booking (convenience shortcut)
router.put('/:id/cancel', async (req, res) => {
  const { id } = req.params;
  try {
    await admin.firestore().collection('bookings').doc(id).update({ status: 'cancelled' });
    res.json({ message: 'Booking cancelled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
