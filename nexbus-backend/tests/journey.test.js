const { buildPlans } = require('../services/journey.service');

const stops = new Map(['a', 'b', 'c', 'd', 'e', 'x'].map((id) => [id, { id, name: id.toUpperCase() }]));
const route = (id, ids) => ({
  id, route_number: id, route_name: `${ids[0]} - ${ids[ids.length - 1]}`, base_fare_lkr: 100,
  distance_km: (ids.length - 1) * 10, estimated_duration_min: (ids.length - 1) * 20,
  stops: ids.map((stop_id, i) => ({ stop_id, sequence_no: i + 1, distance_from_origin_km: i * 10 }))
});

// 1: a-b-c-d    2: d-e    3: x-c-e
const routes = [route('1', ['a', 'b', 'c', 'd']), route('2', ['d', 'e']), route('3', ['x', 'c', 'e'])];

describe('journey planner', () => {
  test('a direct forward route is a single leg with its stops and time', () => {
    const [best] = buildPlans(routes, stops, 'a', 'c');
    expect(best.type).toBe('direct');
    expect(best.legs).toHaveLength(1);
    expect(best.legs[0]).toMatchObject({ route_number: '1', direction: 'forward', stop_count: 2, km: 20, minutes: 40, via: ['B'] });
  });

  test('the opposite direction is still found, but marked reverse and ranked after forward ones', () => {
    const [best] = buildPlans(routes, stops, 'c', 'a');
    expect(best.legs[0]).toMatchObject({ route_number: '1', direction: 'reverse', from_stop_id: 'c', to_stop_id: 'a', via: ['B'] });
  });

  test('with no direct route it finds journeys with one change, quickest first', () => {
    const plans = buildPlans(routes, stops, 'a', 'e');
    const legs = (p) => p.legs.map((l) => [l.route_number, l.from_stop_id, l.to_stop_id]);
    expect(plans[0].type).toBe('change');
    expect(legs(plans[0])).toEqual([['1', 'a', 'c'], ['3', 'c', 'e']]); // 40 + 20 min + the wait
    expect(legs(plans[1])).toEqual([['1', 'a', 'd'], ['2', 'd', 'e']]); // 60 + 20 min + the wait
  });

  test('a direct route beats a journey with a change', () => {
    const plans = buildPlans(routes, stops, 'c', 'e');
    expect(plans[0]).toMatchObject({ type: 'direct' });
    expect(plans[0].legs[0].route_number).toBe('3');
  });

  test('stops that no route reaches give no plan', () => {
    expect(buildPlans(routes, stops, 'a', 'zzz')).toEqual([]);
  });

  test('never returns more than three plans, each with a different route combination', () => {
    const plans = buildPlans(routes, stops, 'a', 'e');
    expect(plans.length).toBeLessThanOrEqual(3);
    const keys = plans.map((p) => p.legs.map((l) => `${l.route_id}:${l.from_stop_id}>${l.to_stop_id}`).join('|'));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
