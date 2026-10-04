const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');
const schemas = require('../schemas');
const vehicleService = require('../services/vehicle.service');
const audit = require('../services/audit.service');

router.use(authenticate);

router.get('/', authorize('operator', 'admin'), async (req, res) => {
  res.json(await vehicleService.listFleet(req.user));
});

router.get('/live', authorize('operator', 'admin'), async (req, res) => {
  res.json(await vehicleService.liveFleet(req.user));
});

router.post('/', authorize('operator'), validate(schemas.vehicle), async (req, res) => {
  const vehicle = await vehicleService.createVehicle(req.user, req.valid.body);
  await audit.log({ userId: req.user.uid, action: 'VEHICLE_CREATED', entity: 'vehicles', entityId: vehicle.id });
  res.status(201).json({ message: 'Vehicle created', ...vehicle });
});

router.put('/:id', authorize('operator'), validate(schemas.vehicleUpdate), async (req, res) => {
  const vehicle = await vehicleService.updateVehicle(req.user, req.params.id, req.valid.body);
  await audit.log({ userId: req.user.uid, action: 'VEHICLE_UPDATED', entity: 'vehicles', entityId: req.params.id });
  res.json({ message: 'Vehicle updated', ...vehicle });
});

module.exports = router;
