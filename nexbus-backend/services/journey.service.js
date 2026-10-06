// "How do I get there?": works out which routes connect two stops (directly or with one change), whatever the
// buses are doing right now. Only the route and stop data is used; live times are added by the caller.
const { pool } = require('../config/db');
const { colomboDate } = require('../utils/format');
const routeService = require('./route.service');
const stopService = require('./stop.service');

const CHANGE_WAIT_MIN = 20; // assumed wait when changing buses
const REVERSE_PENALTY_MIN = 12; // the seeded timetable only has one direction per route
const MAX_PLANS = 3;

// One ride on one route between two of its stops. `a` and `b` index into route.stops (a before b = forward).
function leg(route, stops, a, b) {
  const forward = a < b;
  const [lo, hi] = forward ? [a, b] : [b, a];
  const path = route.stops.slice(lo, hi + 1);
  if (!forward) path.reverse();
  const km = Math.abs(route.stops[b].distance_from_origin_km - route.stops[a].distance_from_origin_km);
  const minutes = route.distance_km > 0 && route.estimated_duration_min
    ? Math.max(1, Math.round((km / route.distance_km) * route.estimated_duration_min))
    : null;
  const name = (s) => stops.get(s.stop_id)?.name || s.stop_id;
  return {
    route_id: route.id,
    route_number: route.route_number,
    route_name: route.route_name,
    direction: forward ? 'forward' : 'reverse',
    from_stop_id: route.stops[a].stop_id,
    to_stop_id: route.stops[b].stop_id,
    from_name: name(route.stops[a]),
    to_name: name(route.stops[b]),
    via: path.slice(1, -1).map(name),
    stop_count: path.length - 1,
    km: Number(km.toFixed(1)),
    minutes,
    fare_lkr: Number(route.base_fare_lkr)
  };
}

const rideMinutes = (l) => (l.minutes ?? Math.round(l.km * 2.5)) + (l.direction === 'reverse' ? REVERSE_PENALTY_MIN : 0);

// Pure planner: direct routes and one-change journeys, best first
function buildPlans(routes, stops, fromId, toId) {
  const index = (route, stopId) => route.stops.findIndex((s) => s.stop_id === stopId);
  const plans = [];

  for (const r of routes) {
    const a = index(r, fromId);
    const b = index(r, toId);
    if (a >= 0 && b >= 0 && a !== b) {
      const l = leg(r, stops, a, b);
      plans.push({ type: 'direct', legs: [l], score: rideMinutes(l) });
    }
  }

  for (const first of routes) {
    const a = index(first, fromId);
    if (a < 0) continue;
    for (const second of routes) {
      if (second.id === first.id) continue;
      const b = index(second, toId);
      if (b < 0) continue;
      for (const [x, s] of first.stops.entries()) {
        if (s.stop_id === fromId || s.stop_id === toId || x === a) continue;
        const y = index(second, s.stop_id);
        if (y < 0 || y === b) continue;
        const l1 = leg(first, stops, a, x);
        const l2 = leg(second, stops, y, b);
        plans.push({ type: 'change', legs: [l1, l2], score: rideMinutes(l1) + rideMinutes(l2) + CHANGE_WAIT_MIN });
      }
    }
  }

  // keep the cheapest plan per route combination and change stop, then the best few overall
  const seen = new Set();
  return plans
    .sort((p, q) => p.score - q.score)
    .filter((p) => {
      const key = p.legs.map((l) => `${l.route_id}:${l.from_stop_id}>${l.to_stop_id}`).join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_PLANS);
}

// Upcoming scheduled departures of a forward leg, as the time the bus is expected at the boarding stop
async function departures(route, boardStop, now, limit = 3) {
  const days = [colomboDate(now), colomboDate(now + 86400000)];
  const { rows } = await pool.query(
    `SELECT scheduled_departure FROM trips
     WHERE route_id = $1 AND status = 'scheduled' AND service_date = ANY($2) AND scheduled_departure > $3
     ORDER BY scheduled_departure LIMIT 12`,
    [route.id, days, now - 15 * 60000]
  );
  const offsetMs = route.distance_km > 0 && route.estimated_duration_min
    ? (boardStop.distance_from_origin_km / route.distance_km) * route.estimated_duration_min * 60000
    : 0;
  return rows.map((r) => Number(r.scheduled_departure) + offsetMs).filter((t) => t > now - 2 * 60000).slice(0, limit);
}

async function plan(fromId, toId, now = Date.now()) {
  const [routes, stops] = await Promise.all([routeService.allRoutes(), stopService.allStops()]);
  const plans = buildPlans(routes, stops, fromId, toId);

  const byId = new Map(routes.map((r) => [r.id, r]));
  for (const p of plans) {
    const first = p.legs[0];
    if (first.direction !== 'forward') { first.departures = []; continue; }
    const route = byId.get(first.route_id);
    const boardStop = route.stops.find((s) => s.stop_id === first.from_stop_id);
    first.departures = await departures(route, boardStop, now);
  }
  return plans;
}

module.exports = { plan, buildPlans };
