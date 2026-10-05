const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../utils/errors');
const eta = require('./eta.service');
const notify = require('./notify.service');
const routeService = require('./route.service');
const stopService = require('./stop.service');

const DELAY_ALERT_MIN = 10;
const MAX_ACCURACY_M = 100;
const LOG_RETENTION_MS = 30 * 24 * 3600 * 1000;
const BOUNDS = { latMin: 5.9, latMax: 9.9, lngMin: 79.5, lngMax: 81.9 };

// Processes one GPS fix sent by the driver's phone (FR-TRK-01, FR-ETA-02).
async function processFix(user, fix) {
  const { trip_id: tripId, lat, lng, speed_kmh: speedKmh, heading, accuracy_m: accuracyM } = fix;

  const tripRes = await pool.query('SELECT * FROM trips WHERE id = $1', [tripId]);
  const trip = tripRes.rows[0];
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

  const vehicleRes = await pool.query('SELECT * FROM vehicles WHERE id = $1', [trip.vehicle_id]);
  const vehicle = vehicleRes.rows[0] || {};
  // an emergency flag raised by the operator is never overwritten by the tracker
  const vehicleStatus = vehicle.status === 'emergency' ? 'emergency' : (delay >= DELAY_ALERT_MIN ? 'delayed' : 'active');

  await withTransaction(async (tx) => {
    await tx.query(
      'UPDATE vehicles SET last_latitude=$1, last_longitude=$2, last_speed_kmh=$3, last_update_at=$4, delay_minutes=$5, current_trip_id=$6, status=$7 WHERE id=$8',
      [lat, lng, speedKmh, now, delay, tripId, vehicleStatus, trip.vehicle_id]
    );
    await tx.query(
      'UPDATE trips SET delay_minutes=$1, last_latitude=$2, last_longitude=$3, last_update_at=$4, recent_fixes=$5 WHERE id=$6',
      [delay, lat, lng, now, JSON.stringify(recentFixes), tripId]
    );
    await tx.query(
      'INSERT INTO location_logs (vehicle_id, trip_id, latitude, longitude, speed_kmh, heading, accuracy_m, recorded_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [trip.vehicle_id, tripId, lat, lng, speedKmh, heading, accuracyM, now]
    );
  });

  // Alert only the first time the delay reaches the threshold
  if (delay >= DELAY_ALERT_MIN && (trip.delay_minutes || 0) < DELAY_ALERT_MIN) {
    await notify.delayAlert(tripId, delay);
  }
  return { delay_minutes: delay };
}

// Deletes location logs older than the retention period (30 days).
async function purgeOldLogs() {
  const { rowCount } = await pool.query('DELETE FROM location_logs WHERE recorded_at <= $1', [Date.now() - LOG_RETENTION_MS]);
  return rowCount;
}

module.exports = { processFix, purgeOldLogs, DELAY_ALERT_MIN, MAX_ACCURACY_M, BOUNDS };
