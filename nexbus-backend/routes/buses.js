// Public bus list used by the passenger live map (read-only), plus legacy operator status updates.
const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');
const schemas = require('../schemas');
const vehicleService = require('../services/vehicle.service');
const audit = require('../services/audit.service');

router.use(authenticate);

router.get('/', async (req, res) => {
  res.json(await vehicleService.publicBuses());
});

router.get('/:id', async (req, res) => {
  res.json(await vehicleService.getBus(req.params.id));
});

router.put('/:id/status', authorize('operator'), validate(schemas.vehicleStatus), async (req, res) => {
  const result = await vehicleService.setStatus(req.user, req.params.id, req.valid.body.status);
  await audit.log({ userId: req.user.uid, action: 'VEHICLE_STATUS', entity: 'vehicles', entityId: req.params.id, details: { status: req.valid.body.status } });
  res.json(result);
});

module.exports = router;
