// Scheduled jobs. Cloud Scheduler calls these with the shared token in the x-internal-token header.
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { AppError } = require('../utils/errors');
const audit = require('../services/audit.service');
const bookingService = require('../services/booking.service');
const tracking = require('../services/tracking.service');

async function jobAuth(req, res, next) {
  const expected = process.env.INTERNAL_JOB_TOKEN || '';
  const given = String(req.headers['x-internal-token'] || '');
  const ok = expected.length > 0 && given.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) {
    await audit.log({ action: 'ACCESS_DENIED', entity: req.originalUrl, severity: 'security' });
    throw new AppError(403, 'FORBIDDEN', 'Forbidden');
  }
  next();
}

router.use(jobAuth);

router.post('/expire-holds', async (req, res) => {
  res.json({ expired: await bookingService.expireHolds() });
});

router.post('/purge-logs', async (req, res) => {
  res.json({ deleted: await tracking.purgeOldLogs() });
});

module.exports = router;
