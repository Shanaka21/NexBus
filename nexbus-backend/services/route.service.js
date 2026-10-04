const { db } = require('../config/firebase');
const { AppError } = require('../utils/errors');
const eta = require('./eta.service');
const stopService = require('./stop.service');

let routeCache = { at: 0, list: [] };

async function allRoutes({ includeInactive = false } = {}) {
  if (Date.now() - routeCache.at > 30 * 1000) {
    const snap = await db.collection('routes').get();
    routeCache = { at: Date.now(), list: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
  }
  return includeInactive ? routeCache.list : routeCache.list.filter(r => (r.status || 'active') === 'active');
}

const invalidateRoutes = () => { routeCache = { at: 0, list: [] }; };

async function getRoute(id) {
  const doc = await db.collection('routes').doc(id).get();
  if (!doc.exists) throw new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found');
  return { id: doc.id, ...doc.data() };
}

async function withStops(route) {
  return { ...route, stops: await stopService.routeStops(route) };
}

// Builds the stored stop list with cumulative distances (haversine between consecutive stops).
async function buildStops(stopIds) {
  if (new Set(stopIds).size !== stopIds.length) {
    throw new AppError(400, 'VALIDATION_ERROR', 'A stop can appear only once in a route');
  }
  const master = await stopService.allStops();
  let total = 0;
  let previous = null;
  const stops = stopIds.map((stopId, index) => {
    const stop = master.get(stopId);
    if (!stop) throw new AppError(400, 'STOP_NOT_FOUND', `Unknown stop ${stopId}`);
    if (previous) {
      total += eta.haversine(
        { lat: previous.latitude, lng: previous.longitude },
        { lat: stop.latitude, lng: stop.longitude }
      );
    }
    previous = stop;
    return { stop_id: stopId, sequence_no: index + 1, distance_from_origin_km: Number(total.toFixed(3)) };
  });
  return {
    stops,
    distance_km: Number(total.toFixed(2)),
    first: master.get(stopIds[0]),
    last: master.get(stopIds[stopIds.length - 1]),
    middle: stopIds.slice(1, -1).map(id => master.get(id).name)
  };
}

function describe(dto, built) {
  return {
    route_number: String(dto.route_number),
    route_name: dto.route_name || `${built.first.name} - ${built.last.name}`,
    start_point: built.first.name,
    end_point: built.last.name,
    via: built.middle.slice(0, 3).join(', '),
    service_type: dto.service_type || 'normal',
    base_fare_lkr: dto.base_fare_lkr,
    distance_km: built.distance_km,
    estimated_duration_min: dto.estimated_duration_min,
    stops: built.stops
  };
}

async function createRoute(dto) {
  const built = await buildStops(dto.stop_ids);
  const data = { ...describe(dto, built), status: 'active', created_at: Date.now() };
  const ref = await db.collection('routes').add(data);
  invalidateRoutes();
  return { id: ref.id, ...data };
}

async function updateRoute(id, dto) {
  const existing = await getRoute(id);
  const stopIds = dto.stop_ids || existing.stops.map(s => s.stop_id);
  const built = await buildStops(stopIds);
  const data = describe({ ...existing, ...dto, route_name: dto.route_name || existing.route_name }, built);
  await db.collection('routes').doc(id).update(data);
  invalidateRoutes();
  return { id, ...existing, ...data };
}

async function deactivateRoute(id) {
  await getRoute(id);
  await db.collection('routes').doc(id).update({ status: 'inactive' });
  invalidateRoutes();
}

module.exports = { allRoutes, getRoute, withStops, createRoute, updateRoute, deactivateRoute, invalidateRoutes };
