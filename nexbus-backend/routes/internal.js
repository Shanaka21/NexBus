// Scheduled jobs. Cloud Scheduler calls these with the shared token in the x-internal-token header.
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { AppError } = require('../utils/errors');
const audit = require('../services/audit.service');
const bookingService = require('../services/booking.service');
const tracking = require('../services/tracking.service');

const sameSecret = (expected, given) =>
  expected.length > 0 && given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));

// Callers prove themselves with the shared token (x-internal-token), or, for Vercel Cron, with the
// "Authorization: Bearer <CRON_SECRET>" header Vercel adds to every cron request.
async function jobAuth(req, res, next) {
  const bearer = String(req.headers.authorization || '').replace(/^Bearer /, '');
  const ok = sameSecret(process.env.INTERNAL_JOB_TOKEN || '', String(req.headers['x-internal-token'] || '')) ||
    sameSecret(process.env.CRON_SECRET || '', bearer);
  if (!ok) {
    await audit.log({ action: 'ACCESS_DENIED', entity: req.originalUrl, severity: 'security' });
    throw new AppError(403, 'FORBIDDEN', 'Forbidden');
  }
  next();
}

router.use(jobAuth);

// POST for Cloud Scheduler / an external pinger, GET for Vercel Cron (which always sends GET)
router.all('/expire-holds', async (req, res) => {
  res.json({ expired: await bookingService.expireHolds() });
});

router.all('/purge-logs', async (req, res) => {
  res.json({ deleted: await tracking.purgeOldLogs() });
});

module.exports = router;
