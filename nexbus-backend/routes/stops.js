const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');
const schemas = require('../schemas');
const stopService = require('../services/stop.service');
const arrival = require('../services/arrival.service');
const audit = require('../services/audit.service');

router.use(authenticate);

router.get('/', validate(schemas.stopsQuery, 'query'), async (req, res) => {
  const { near, limit } = req.valid.query;
  res.json(await stopService.listStops({ near: near ? near.split(',').map(Number) : null, limit }));
});

router.post('/', authorize('operator', 'admin'), validate(schemas.stop), async (req, res) => {
  const stop = await stopService.createStop(req.valid.body);
  await audit.log({ userId: req.user.uid, action: 'STOP_CREATED', entity: 'bus_stops', entityId: stop.id });
  res.status(201).json(stop);
});

router.get('/:id/arrivals', async (req, res) => {
  res.json(await arrival.arrivalsForStop(req.params.id));
});

module.exports = router;
