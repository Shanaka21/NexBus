const { pool } = require('../config/db');
const { colomboDate } = require('../utils/format');
const cache = require('./cache');

// Dashboard overview. Operators see their own company only; administrators see everything.
function overview(user) {
  const operatorId = user.role === 'operator' ? user.operatorId : null;
  return cache.cached(`stats:${operatorId || 'all'}`, () => buildOverview(operatorId), 5000);
}

// $1::text IS NULL matches every row when operatorId is null (admin view); otherwise scopes to one operator.
async function buildOverview(operatorId) {
  const today = colomboDate();
  const todayStartMs = new Date(`${today}T00:00:00+05:30`).getTime();
  const count = async (sql, ...extra) => Number((await pool.query(sql, [operatorId, ...extra])).rows[0].count);

  const [vehicleRes, runningRes, totalBookings, bookedToday, pending, confirmed, cancelled, completed, scheduledToday] = await Promise.all([
    pool.query('SELECT * FROM vehicles WHERE $1::text IS NULL OR operator_id = $1', [operatorId]),
    pool.query("SELECT * FROM trips WHERE ($1::text IS NULL OR operator_id = $1) AND status = 'running'", [operatorId]),
    count('SELECT COUNT(*) FROM bookings WHERE $1::text IS NULL OR operator_id = $1'),
    count('SELECT COUNT(*) FROM bookings WHERE ($1::text IS NULL OR operator_id = $1) AND created_at >= $2 AND created_at < $3', todayStartMs, todayStartMs + 86400000),
    count('SELECT COUNT(*) FROM bookings WHERE ($1::text IS NULL OR operator_id = $1) AND status = $2', 'pending_payment'),
    count('SELECT COUNT(*) FROM bookings WHERE ($1::text IS NULL OR operator_id = $1) AND status = $2', 'confirmed'),
    count('SELECT COUNT(*) FROM bookings WHERE ($1::text IS NULL OR operator_id = $1) AND status = $2', 'cancelled'),
    count('SELECT COUNT(*) FROM bookings WHERE ($1::text IS NULL OR operator_id = $1) AND status = $2', 'completed'),
    count("SELECT COUNT(*) FROM trips WHERE ($1::text IS NULL OR operator_id = $1) AND service_date = $2 AND status = 'scheduled'", today)
  ]);

  const buses = vehicleRes.rows;
  const running = runningRes.rows;

  return {
    buses: {
      total: buses.length,
      active: buses.filter(b => (b.status || 'active') === 'active').length,
      delayed: buses.filter(b => b.status === 'delayed').length,
      emergency: buses.filter(b => b.status === 'emergency').length,
      inactive: buses.filter(b => b.status === 'inactive').length
    },
    bookings: {
      total: totalBookings,
      pending_payment: pending,
      confirmed,
      cancelled,
      completed,
      today: bookedToday
    },
    trips: {
      running: running.length,
      scheduled_today: scheduledToday,
      delayed: running.filter(t => (t.delay_minutes || 0) >= 10).length
    }
  };
}

module.exports = { overview };
