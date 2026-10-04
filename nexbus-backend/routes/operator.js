const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');
const schemas = require('../schemas');
const operator = require('../services/operator.service');

router.use(authenticate, authorize('operator'));

router.get('/drivers', async (req, res) => res.json(await operator.listDrivers(req.user)));

router.post('/drivers', validate(schemas.driver), async (req, res) => {
  res.status(201).json(await operator.createDriver(req.user, req.valid.body));
});

router.get('/bookings', validate(schemas.operatorBookingsQuery, 'query'), async (req, res) => {
  res.json(await operator.listBookings(req.user, req.valid.query));
});

router.get('/reports', validate(schemas.reportQuery, 'query'), async (req, res) => {
  res.json(await operator.dailyReport(req.user, req.valid.query.date));
});

module.exports = router;
