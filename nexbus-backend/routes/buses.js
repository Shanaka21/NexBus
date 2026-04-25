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
    routeSnap.docs.forEach(doc => { routeMap[doc.id] = doc.data(); });

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
    res.status(500).json({ error: error.message });
  }
});

// Get single bus by Firestore doc ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await admin.firestore().collection('vehicles').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Bus not found' });
    }
    const data = doc.data();

    let routeData = {};
    if (data.route_id) {
      const routeDoc = await admin.firestore().collection('routes').doc(data.route_id).get();
      if (routeDoc.exists) routeData = routeDoc.data();
    }

    res.json({
      id: doc.id,
      bus_number: data.bus_number,
      route_number: data.route_number,
      status: data.status || 'active',
      capacity: data.capacity,
      booked_seats: data.booked_seats,
      route_name: routeData.route_name || `Route ${data.route_number}`,
      start_point: routeData.start_point || '',
      end_point: routeData.end_point || data.route_number
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new vehicle
router.post('/', async (req, res) => {
  const { bus_number, route_number, route_id, capacity } = req.body;
  if (!bus_number || !route_number) {
    return res.status(400).json({ error: 'bus_number and route_number are required' });
  }
  try {
    const data = {
      bus_number,
      route_number: String(route_number),
      route_id: route_id || '',
      status: 'active',
      capacity: capacity || 44,
      booked_seats: 0
    };
    const ref = await admin.firestore().collection('vehicles').doc();
    await ref.set(data);
    res.json({ message: 'Vehicle created', id: ref.id, ...data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update bus status (for operator dashboard)
router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const valid = ['active', 'delayed', 'emergency', 'inactive'];
  if (!status || !valid.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
  }
  try {
    await admin.firestore().collection('vehicles').doc(id).update({ status });
    res.json({ message: 'Bus status updated', status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update bus GPS location → Realtime Database
router.post('/location', async (req, res) => {
  const { bus_id, lat, lng } = req.body;
  if (!bus_id || lat == null || lng == null) {
    return res.status(400).json({ error: 'bus_id, lat, and lng are required' });
  }
  try {
    await admin.database().ref(`locations/${bus_id}`).update({
      lat,
      lng,
      status: 'on_route',
      updated_at: Date.now()
    });
    res.json({ message: 'Location updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
