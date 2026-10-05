const crypto = require('crypto');
const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../utils/errors');
const eta = require('./eta.service');
const stopService = require('./stop.service');

let routeCache = { at: 0, list: [] };

async function loadRoutesWithStops() {
  const [routes, stops] = await Promise.all([
    pool.query('SELECT * FROM routes'),
    pool.query('SELECT * FROM route_stops ORDER BY route_id, sequence_no')
  ]);
  const stopsByRoute = {};
  stops.rows.forEach((s) => {
    (stopsByRoute[s.route_id] = stopsByRoute[s.route_id] || []).push({
      stop_id: s.stop_id, sequence_no: s.sequence_no, distance_from_origin_km: Number(s.distance_from_origin_km)
    });
  });
  return routes.rows.map((r) => ({ ...r, base_fare_lkr: Number(r.base_fare_lkr), distance_km: r.distance_km != null ? Number(r.distance_km) : null, created_at: Number(r.created_at), stops: stopsByRoute[r.id] || [] }));
}

async function allRoutes({ includeInactive = false } = {}) {
  if (Date.now() - routeCache.at > 30 * 1000) {
    routeCache = { at: Date.now(), list: await loadRoutesWithStops() };
  }
  return includeInactive ? routeCache.list : routeCache.list.filter(r => (r.status || 'active') === 'active');
}

const invalidateRoutes = () => { routeCache = { at: 0, list: [] }; };

// Always reads straight from the database (not the allRoutes() cache): callers rely on this being
// up to date immediately after a create/update, and transactional flows (booking) need a fresh read.
async function getRoute(id) {
  const { rows } = await pool.query('SELECT * FROM routes WHERE id = $1', [id]);
  if (!rows[0]) throw new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found');
  const stops = await pool.query('SELECT * FROM route_stops WHERE route_id = $1 ORDER BY sequence_no', [id]);
  return {
    ...rows[0], base_fare_lkr: Number(rows[0].base_fare_lkr),
    distance_km: rows[0].distance_km != null ? Number(rows[0].distance_km) : null,
    created_at: Number(rows[0].created_at),
    stops: stops.rows.map((s) => ({ stop_id: s.stop_id, sequence_no: s.sequence_no, distance_from_origin_km: Number(s.distance_from_origin_km) }))
  };
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

async function saveStops(client, routeId, stops) {
  await client.query('DELETE FROM route_stops WHERE route_id = $1', [routeId]);
  for (const s of stops) {
    await client.query(
      'INSERT INTO route_stops (route_id, stop_id, sequence_no, distance_from_origin_km) VALUES ($1, $2, $3, $4)',
      [routeId, s.stop_id, s.sequence_no, s.distance_from_origin_km]
    );
  }
}

async function createRoute(dto) {
  const built = await buildStops(dto.stop_ids);
  const data = describe(dto, built);
  const id = crypto.randomUUID();
  const now = Date.now();
  await withTransaction(async (tx) => {
    await tx.query(
      `INSERT INTO routes (id, route_number, route_name, start_point, end_point, via, service_type, base_fare_lkr, distance_km, estimated_duration_min, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11)`,
      [id, data.route_number, data.route_name, data.start_point, data.end_point, data.via, data.service_type, data.base_fare_lkr, data.distance_km, data.estimated_duration_min, now]
    );
    await saveStops(tx, id, built.stops);
  });
  invalidateRoutes();
  return { id, ...data, status: 'active', created_at: now };
}

async function updateRoute(id, dto) {
  const existing = await getRoute(id);
  const stopIds = dto.stop_ids || existing.stops.map(s => s.stop_id);
  const built = await buildStops(stopIds);
  const data = describe({ ...existing, ...dto, route_name: dto.route_name || existing.route_name }, built);
  await withTransaction(async (tx) => {
    await tx.query(
      `UPDATE routes SET route_number=$1, route_name=$2, start_point=$3, end_point=$4, via=$5, service_type=$6,
       base_fare_lkr=$7, distance_km=$8, estimated_duration_min=$9 WHERE id=$10`,
      [data.route_number, data.route_name, data.start_point, data.end_point, data.via, data.service_type, data.base_fare_lkr, data.distance_km, data.estimated_duration_min, id]
    );
    await saveStops(tx, id, built.stops);
  });
  invalidateRoutes();
  return { id, ...existing, ...data };
}

async function deactivateRoute(id) {
  await getRoute(id);
  await pool.query("UPDATE routes SET status = 'inactive' WHERE id = $1", [id]);
  invalidateRoutes();
}

module.exports = { allRoutes, getRoute, withStops, createRoute, updateRoute, deactivateRoute, invalidateRoutes };
