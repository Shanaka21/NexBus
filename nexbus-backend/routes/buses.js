const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

// Get all buses (joined with route info)
router.get('/', async (req, res) => {
  try {
    const [busSnap, routeSnap] = await Promise.all([
      admin.firestore().collection('vehicles').get(),
      admin.firestore().collection('routes').get()
    ]);

    const routeMap = {};
    routeSnap.docs.forEach(doc => {
      routeMap[doc.id] = doc.data();
    });

    const buses = busSnap.docs.map(doc => {
      const data = doc.data();
      const route = routeMap[data.route_id] || {};
      return {
        id: doc.id,
        bus_number: data.bus_number,
        route_number: data.route_number,
        status: data.status || 'active',
        capacity: data.capacity,
        booked_seats: data.booked_seats,
        route_name: route.route_name || `Route ${data.route_number}`,
        start_point: route.start_point || '',
        end_point: route.end_point || data.route_number
      };
    });

    res.json(buses);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update bus GPS location
router.post('/location', async (req, res) => {
  const { bus_id, lat, lng } = req.body;
  try {
    await admin.database().ref(`locations/${bus_id}`).update({
      lat,
      lng,
      status: 'on_route',
      updated_at: Date.now()
    });
    res.json({ message: 'Location updated successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
