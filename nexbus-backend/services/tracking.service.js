const { db } = require('../config/firebase');
const { AppError } = require('../utils/errors');
const eta = require('./eta.service');
const notify = require('./notify.service');
const routeService = require('./route.service');
const stopService = require('./stop.service');

const DELAY_ALERT_MIN = 10;
const MAX_ACCURACY_M = 100;
const LOG_TTL_MS = 30 * 24 * 3600 * 1000;
const BOUNDS = { latMin: 5.9, latMax: 9.9, lngMin: 79.5, lngMax: 81.9 };

// Processes one GPS fix sent by the driver's phone (FR-TRK-01, FR-ETA-02).
async function processFix(user, fix) {
  const { trip_id: tripId, lat, lng, speed_kmh: speedKmh, heading, accuracy_m: accuracyM } = fix;

  const tripRef = db.collection('trips').doc(tripId);
  const trip = (await tripRef.get()).data();
  if (!trip || trip.driver_id !== user.uid || trip.status !== 'running') {
    throw new AppError(403, 'NOT_ASSIGNED_OR_NOT_RUNNING', 'This trip is not assigned to you or is not running');
  }
  if (lat < BOUNDS.latMin || lat > BOUNDS.latMax || lng < BOUNDS.lngMin || lng > BOUNDS.lngMax) {
    throw new AppError(400, 'OUT_OF_BOUNDS', 'Position is outside Sri Lanka');
  }
  if (accuracyM > MAX_ACCURACY_M) {
    throw new AppError(422, 'LOW_ACCURACY', 'GPS accuracy is too low');
  }

  const now = Date.now();
  const route = await routeService.getRoute(trip.route_id);
  const stops = await stopService.routeStops(route);

  const recentFixes = [...(trip.recent_fixes || []), { t: now, speed: speedKmh }]
    .filter(f => now - f.t <= 5 * 60 * 1000)
    .slice(-10);
  const delay = eta.delayMinutes(route, stops, trip, { lat, lng }, eta.recentSpeedKmh(recentFixes, now), now);

  const vehicleRef = db.collection('vehicles').doc(trip.vehicle_id);
  const vehicle = (await vehicleRef.get()).data() || {};

  const batch = db.batch();
  batch.update(vehicleRef, {
    last_latitude: lat, last_longitude: lng, last_speed_kmh: speedKmh,
    last_update_at: now, delay_minutes: delay, current_trip_id: tripId,
    // an emergency flag raised by the operator is never overwritten by the tracker
    status: vehicle.status === 'emergency' ? 'emergency' : (delay >= DELAY_ALERT_MIN ? 'delayed' : 'active')
  });
  batch.update(tripRef, {
    delay_minutes: delay, last_latitude: lat, last_longitude: lng,
    last_update_at: now, recent_fixes: recentFixes
  });
  batch.set(db.collection('location_logs').doc(), {
    vehicle_id: trip.vehicle_id, trip_id: tripId, latitude: lat, longitude: lng,
    speed_kmh: speedKmh, heading, accuracy_m: accuracyM, recorded_at: now,
    expires_at: now + LOG_TTL_MS // Firestore TTL policy field (30 day retention)
  });
  await batch.commit();

  // Alert only the first time the delay reaches the threshold
  if (delay >= DELAY_ALERT_MIN && (trip.delay_minutes || 0) < DELAY_ALERT_MIN) {
    await notify.delayAlert(tripId, delay);
  }
  return { delay_minutes: delay };
}

// Deletes location logs older than the retention period (also covered by a Firestore TTL policy).
async function purgeOldLogs() {
  const snap = await db.collection('location_logs').where('expires_at', '<=', Date.now()).limit(400).get();
  const batch = db.batch();
  let count = 0;
  snap.docs.forEach(d => {
    batch.delete(d.ref);
    count++;
  });
  if (count) await batch.commit();
  return count;
}

module.exports = { processFix, purgeOldLogs, DELAY_ALERT_MIN, MAX_ACCURACY_M, BOUNDS };
