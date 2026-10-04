const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');
const schemas = require('../schemas');
const tracking = require('../services/tracking.service');
const audit = require('../services/audit.service');
const { AppError } = require('../utils/errors');

router.post('/', authenticate, authorize('driver'), validate(schemas.location), async (req, res) => {
  try {
    await tracking.processFix(req.user, req.valid.body);
  } catch (err) {
    if (err instanceof AppError && err.code === 'NOT_ASSIGNED_OR_NOT_RUNNING') {
      await audit.log({ userId: req.user.uid, action: 'LOCATION_REJECTED', entity: 'trips', entityId: req.valid.body.trip_id, severity: 'security' });
    }
    throw err;
  }
  res.status(204).end();
});

module.exports = router;
