const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

// Get all routes
router.get('/', async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection('routes').get();
    const routes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(routes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single route
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await admin.firestore().collection('routes').doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Route not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create route
router.post('/', async (req, res) => {
  const { route_number, route_name, start_point, end_point, via } = req.body;
  if (!route_number || !start_point || !end_point) {
    return res.status(400).json({ error: 'route_number, start_point, and end_point are required' });
  }
  try {
    const data = {
      route_number: String(route_number),
      route_name: route_name || `Route ${route_number}`,
      start_point,
      end_point,
      via: via || '',
      created_at: Date.now()
    };
    const ref = await admin.firestore().collection('routes').add(data);
    res.json({ message: 'Route created', id: ref.id, ...data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update route
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { route_number, route_name, start_point, end_point, via } = req.body;
  try {
    const updates = {};
    if (route_number) updates.route_number = String(route_number);
    if (route_name)   updates.route_name   = route_name;
    if (start_point)  updates.start_point  = start_point;
    if (end_point)    updates.end_point     = end_point;
    if (via !== undefined) updates.via = via;
    await admin.firestore().collection('routes').doc(id).update(updates);
    res.json({ message: 'Route updated', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete route
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await admin.firestore().collection('routes').doc(id).delete();
    res.json({ message: 'Route deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
