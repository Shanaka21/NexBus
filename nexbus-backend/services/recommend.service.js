const { AppError } = require('../utils/errors');
const routeService = require('./route.service');
const stopService = require('./stop.service');
const arrival = require('./arrival.service');

// Scoring rules (design Table 4.9): lower is better.
function scoreTrip(c, needSeat) {
  const reservable = c.reservable_seats > 0;
  if (needSeat && reservable && c.available_seats === 0) return null; // excluded: fully booked
  const seatAdjustment = needSeat && reservable ? -3 : 0;
  return c.eta_min + 0.5 * (c.delay_minutes || 0) + seatAdjustment;
}

function explain(best, others) {
  let text = `Recommended: Bus ${best.route_number} (${best.registration_no}) arrives in ${best.eta_min} min`;
  if (best.reservable_seats > 0) text += ` with ${best.available_seats} seats free`;
  const earlier = others.find(o => o.eta_min < best.eta_min);
  if (earlier) {
    text += `. The bus arriving in ${earlier.eta_min} min is ` +
      (earlier.reservable_seats > 0 && earlier.available_seats === 0
        ? 'fully booked'
        : `${earlier.delay_minutes || 0} min late`);
  }
  return `${text}.`;
}

function rank(candidates, needSeat) {
  const scored = candidates
    .map(c => ({ ...c, score: scoreTrip(c, needSeat) }))
    .filter(c => c.score !== null)
    .sort((a, b) => a.score - b.score);
  const top = scored.slice(0, 3);
  return { options: top, explanation: top.length ? explain(top[0], scored.slice(1)) : null };
}

// Up to three ranked options between two stops (FR-DSS-01, FR-DSS-02)
async function recommend({ from_stop_id: fromId, to_stop_id: toId, need_seat: needSeat }, now = Date.now()) {
  await Promise.all([stopService.getStop(fromId), stopService.getStop(toId)]);
  const [routes, trips] = await Promise.all([routeService.allRoutes(), arrival.activeTrips()]);
  const candidates = [];

  for (const route of routes) {
    const stops = await stopService.routeStops(route);
    const from = stops.findIndex(s => s.stopId === fromId);
    const to = stops.findIndex(s => s.stopId === toId);
    if (from === -1 || to === -1 || from >= to) continue;

    for (const trip of trips.filter(t => t.route_id === route.id)) {
      const info = arrival.tripEta(trip, route, stops, from, now);
      if (!info || info.status === 'offline') continue; // passed the stop, or position is stale
      candidates.push({
        trip_id: trip.id,
        route_id: route.id,
        route_number: route.route_number,
        route_name: route.route_name,
        registration_no: trip.registration_no,
        boarding_stop_id: fromId,
        alighting_stop_id: toId,
        delay_minutes: trip.delay_minutes || 0,
        reservable_seats: trip.reservable_seats || 0,
        available_seats: trip.available_seats || 0,
        fare_lkr: route.base_fare_lkr,
        ...info
      });
    }
  }

  if (!candidates.length) {
    if (!anyRouteServes(routes, fromId, toId)) throw new AppError(404, 'NO_ROUTE', 'No route serves both stops');
    return { options: [], explanation: null };
  }
  return rank(candidates, needSeat);
}

function anyRouteServes(routes, fromId, toId) {
  for (const route of routes) {
    const ids = (route.stops || []).slice().sort((a, b) => a.sequence_no - b.sequence_no).map(s => s.stop_id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from !== -1 && to !== -1 && from < to) return true;
  }
  return false;
}

module.exports = { scoreTrip, explain, rank, recommend };
