const { db } = require('../config/firebase');
const { colomboDate } = require('../utils/format');
const cache = require('./cache');

const count = async (query) => (await query.count().get()).data().count;

// Dashboard overview. Operators see their own company only; administrators see everything.
// Totals use Firestore count() aggregations, which cost far fewer reads than loading every document.
function overview(user) {
  const operatorId = user.role === 'operator' ? user.operatorId : null;
  return cache.cached(`stats:${operatorId || 'all'}`, () => buildOverview(operatorId), 5000);
}

async function buildOverview(operatorId) {
  const scope = (name) => {
    const col = db.collection(name);
    return operatorId ? col.where('operator_id', '==', operatorId) : col;
  };
  const today = colomboDate();
  const bookingCount = (status) => count(scope('bookings').where('booking_status', '==', status));

  const [vehicleSnap, runningSnap, totalBookings, bookedToday, pending, confirmed, cancelled, completed, scheduledToday] = await Promise.all([
    scope('vehicles').get(),
    scope('trips').where('status', '==', 'running').get(),
    count(scope('bookings')),
    count(scope('bookings').where('created_day', '==', today)),
    bookingCount('pending_payment'),
    bookingCount('confirmed'),
    bookingCount('cancelled'),
    bookingCount('completed'),
    count(scope('trips').where('service_date', '==', today).where('status', '==', 'scheduled'))
  ]);

  const buses = vehicleSnap.docs.map(d => d.data());
  const running = runningSnap.docs.map(d => d.data());

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
