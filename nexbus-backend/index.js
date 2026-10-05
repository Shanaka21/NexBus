const app = require('./app');
const bookingService = require('./services/booking.service');
const tracking = require('./services/tracking.service');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`NexBus backend running on port ${PORT}`);
});

// Local scheduler. On Cloud Run set ENABLE_JOBS=false and let Cloud Scheduler call /internal/* instead.
if (process.env.ENABLE_JOBS !== 'false') {
  setInterval(() => {
    bookingService.expireHolds().catch(err => console.error('expire-holds failed:', err.message));
  }, 60 * 1000);
  setInterval(() => {
    tracking.purgeOldLogs().catch(err => console.error('purge-logs failed:', err.message));
  }, 6 * 3600 * 1000);
}
