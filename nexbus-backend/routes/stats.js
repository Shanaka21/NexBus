const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

// GET /stats — dashboard analytics
router.get('/', async (req, res) => {
  try {
    const [busSnap, bookingSnap] = await Promise.all([
      admin.firestore().collection('vehicles').get(),
      admin.firestore().collection('bookings').get()
    ]);

    const buses = busSnap.docs.map(d => d.data());
    const bookings = bookingSnap.docs.map(d => d.data());

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const stats = {
      buses: {
        total: buses.length,
        active: buses.filter(b => b.status === 'active').length,
        delayed: buses.filter(b => b.status === 'delayed').length,
        emergency: buses.filter(b => b.status === 'emergency').length,
        inactive: buses.filter(b => b.status === 'inactive').length
      },
      bookings: {
        total: bookings.length,
        confirmed: bookings.filter(b => b.status === 'confirmed').length,
        cancelled: bookings.filter(b => b.status === 'cancelled').length,
        completed: bookings.filter(b => b.status === 'completed').length,
        today: bookings.filter(b => b.created_at >= todayStart.getTime()).length
      }
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
