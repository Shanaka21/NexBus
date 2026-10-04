// Pure ETA / delay maths (design section 4.4.6). No database access in this file.
const R = 6371; // Earth radius in km
const rad = (d) => (d * Math.PI) / 180;

const MIN_SPEED = 8;   // km/h
const MAX_SPEED = 45;  // km/h
const OFFLINE_MS = 2 * 60 * 1000;
const RECENT_MS = 60 * 1000;

function haversine(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// stops: [{ lat, lng, distanceFromOriginKm }] ordered by sequence.
// Progress = distance along the route: the bus is placed on the segment it is closest to.
function progressKm(stops, bus) {
  if (stops.length === 1) return stops[0].distanceFromOriginKm;
  let best = { detour: Infinity, km: 0 };
  for (let i = 1; i < stops.length; i++) {
    const seg = stops[i].distanceFromOriginKm - stops[i - 1].distanceFromOriginKm;
    const toA = haversine(stops[i - 1], bus);
    const toB = haversine(bus, stops[i]);
    const direct = haversine(stops[i - 1], stops[i]);
    const detour = toA + toB - direct;
    if (detour < best.detour) {
      const fraction = toA + toB === 0 ? 0 : toA / (toA + toB);
      best = { detour, km: stops[i - 1].distanceFromOriginKm + fraction * seg };
    }
  }
  return best.km;
}

const clampSpeed = (v) => Math.min(MAX_SPEED, Math.max(MIN_SPEED, v));

// Average of the fixes received in the last 60 s; null when there are none.
function recentSpeedKmh(recentFixes = [], now = Date.now()) {
  const fresh = recentFixes.filter(f => now - f.t <= RECENT_MS && f.speed != null);
  if (!fresh.length) return null;
  return fresh.reduce((s, f) => s + f.speed, 0) / fresh.length;
}

const routeAvgSpeedKmh = (route) =>
  route.estimated_duration_min > 0 ? route.distance_km / (route.estimated_duration_min / 60) : 25;

// Minutes until a running bus reaches stops[targetIndex]; null when it has already passed.
function etaRunning(stops, targetIndex, bus, speedKmh, routeSpeedKmh) {
  const remaining = stops[targetIndex].distanceFromOriginKm - progressKm(stops, bus);
  if (remaining < 0) return null;
  const v = clampSpeed(speedKmh || routeSpeedKmh);
  return Math.ceil((remaining / v) * 60);
}

// Minutes for a scheduled trip that has not started yet.
function etaScheduled(stops, targetIndex, departureMs, routeSpeedKmh, now = Date.now()) {
  const untilDeparture = Math.max(0, (departureMs - now) / 60000);
  const travel = (stops[targetIndex].distanceFromOriginKm / clampSpeed(routeSpeedKmh)) * 60;
  return Math.ceil(untilDeparture + travel);
}

// Delay compared with where the bus should be by the timetable (minimum zero).
function delayMinutes(route, stops, trip, bus, speedKmh, now = Date.now()) {
  const plannedMs = (route.estimated_duration_min || 0) * 60000;
  if (!plannedMs || !trip.scheduled_departure) return 0;
  const total = stops[stops.length - 1].distanceFromOriginKm;
  const elapsed = Math.max(0, now - trip.scheduled_departure);
  const expected = Math.min(total, (elapsed / plannedMs) * total);
  const behindKm = expected - progressKm(stops, bus);
  if (behindKm <= 0) return 0;
  const v = clampSpeed(speedKmh || routeAvgSpeedKmh(route));
  return Math.round((behindKm / v) * 60);
}

function vehicleStatus(lastUpdateMs, delay, now = Date.now()) {
  if (!lastUpdateMs || now - lastUpdateMs > OFFLINE_MS) return 'offline';
  return delay >= 10 ? 'delayed' : 'on_time';
}

module.exports = {
  haversine, progressKm, recentSpeedKmh, routeAvgSpeedKmh, etaRunning, etaScheduled,
  delayMinutes, vehicleStatus, clampSpeed, OFFLINE_MS, MIN_SPEED, MAX_SPEED
};
