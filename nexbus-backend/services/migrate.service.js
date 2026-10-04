const { db } = require('../config/firebase');
const { colomboDate } = require('../utils/format');

// One-time backfill of the day fields used by the date-scoped queries (trips.service_date,
// bookings.created_day, payments.created_day / paid_day). Data written before those fields existed
// would otherwise be invisible to the new queries. A marker document makes it run only once.
async function backfillDays() {
  const metaRef = db.collection('system_meta').doc('migrations');
  const meta = await metaRef.get();
  if (meta.exists && meta.data().days_v1) return { skipped: true };

  const writes = [];
  const [trips, bookings, payments] = await Promise.all([
    db.collection('trips').get(), db.collection('bookings').get(), db.collection('payments').get()
  ]);
  trips.docs.forEach(d => {
    const t = d.data();
    if (!t.service_date && t.scheduled_departure) writes.push([d.ref, { service_date: colomboDate(t.scheduled_departure) }]);
  });
  bookings.docs.forEach(d => {
    const b = d.data();
    if (!b.created_day && b.created_at) writes.push([d.ref, { created_day: colomboDate(b.created_at) }]);
  });
  payments.docs.forEach(d => {
    const p = d.data();
    const patch = {};
    if (!p.created_day && p.created_at) patch.created_day = colomboDate(p.created_at);
    if (p.payment_status === 'success' && !p.paid_day) patch.paid_day = colomboDate(p.updated_at || p.created_at);
    if (Object.keys(patch).length) writes.push([d.ref, patch]);
  });

  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    writes.slice(i, i + 400).forEach(([ref, patch]) => batch.update(ref, patch));
    await batch.commit();
  }
  await metaRef.set({ days_v1: true, at: Date.now() }, { merge: true });
  return { updated: writes.length };
}

module.exports = { backfillDays };
