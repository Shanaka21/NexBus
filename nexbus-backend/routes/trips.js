const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');
const schemas = require('../schemas');
const tripService = require('../services/trip.service');
const arrival = require('../services/arrival.service');
const audit = require('../services/audit.service');

router.use(authenticate);

router.get('/', validate(schemas.tripsQuery, 'query'), async (req, res) => {
  res.json(await tripService.listTrips(req.user, req.valid.query));
});

router.post('/', authorize('operator'), validate(schemas.trip), async (req, res) => {
  const trip = await tripService.createTrip(req.user, req.valid.body);
  await audit.log({ userId: req.user.uid, action: 'TRIP_CREATED', entity: 'trips', entityId: trip.id });
  res.status(201).json(trip);
});

router.get('/:id/live', async (req, res) => {
  res.json(await arrival.tripLive(req.params.id));
});

router.get('/:id/availability', async (req, res) => {
  res.json(await tripService.getAvailability(req.params.id));
});

router.get('/:id/seats', async (req, res) => {
  res.json(await tripService.seatMap(req.params.id));
});

router.get('/:id/summary', authorize('driver', 'operator', 'admin'), async (req, res) => {
  res.json(await tripService.tripSummary(req.user, req.params.id));
});

router.post('/:id/verify-boarding', authorize('driver'), validate(schemas.verifyBoarding), async (req, res) => {
  res.json(await tripService.verifyBoarding(req.user, req.params.id, req.valid.body.code));
});

router.patch('/:id/status', authorize('driver', 'operator'), validate(schemas.tripStatus), async (req, res) => {
  const result = await tripService.changeStatus(req.user, req.params.id, req.valid.body.status);
  await audit.log({ userId: req.user.uid, action: `TRIP_${req.valid.body.status.toUpperCase()}`, entity: 'trips', entityId: req.params.id });
  res.json(result);
});

module.exports = router;
