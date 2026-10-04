const crypto = require('crypto');

const bookingReference = () => 'NB' + crypto.randomBytes(3).toString('hex').toUpperCase();

const lkr = (n) => `LKR ${Number(n || 0).toLocaleString('en-US')}`;

function clock(ms) {
  return new Date(ms).toLocaleTimeString('en-US', {
    timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit'
  });
}

function dateLabel(ms) {
  return new Date(ms).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo'
  });
}

// Start of a Sri Lanka calendar day (UTC+05:30, no DST) as epoch ms
function dayRange(dateStr) {
  const base = dateStr ? new Date(`${dateStr}T00:00:00+05:30`) : (() => {
    const now = new Date(Date.now() + 5.5 * 3600 * 1000);
    now.setUTCHours(0, 0, 0, 0);
    return new Date(now.getTime() - 5.5 * 3600 * 1000);
  })();
  return { start: base.getTime(), end: base.getTime() + 24 * 3600 * 1000 };
}

// Sri Lanka calendar date (YYYY-MM-DD) of an instant. Stored on trips, bookings and payments so that
// queries can use cheap equality filters instead of reading whole collections.
const colomboDate = (ms = Date.now()) => new Date(ms + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

const recentDates = (days, from = Date.now()) => Array.from({ length: days }, (_, i) => colomboDate(from - i * 86400000));

module.exports = { bookingReference, lkr, clock, dateLabel, dayRange, colomboDate, recentDates };
