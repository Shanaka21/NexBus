const eta = require('../services/eta.service');

// A straight north-south route: ~1.11 km per 0.01 degree of latitude
const lat = (km) => 6.9 + km / 111.19;
const stops = [0, 2, 5, 9].map((km, i) => ({ lat: lat(km), lng: 79.85, distanceFromOriginKm: km, sequenceNo: i + 1 }));

describe('haversine', () => {
  test('known distance: Fort to Kandy is roughly 94 km in a straight line', () => {
    const d = eta.haversine({ lat: 6.9335, lng: 79.85 }, { lat: 7.2906, lng: 80.6337 });
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(98);
  });
  test('zero distance for the same point', () => {
    expect(eta.haversine({ lat: 6.9, lng: 79.8 }, { lat: 6.9, lng: 79.8 })).toBe(0);
  });
});

describe('progressKm', () => {
  test('bus on a stop has that stop distance', () => {
    expect(eta.progressKm(stops, { lat: lat(5), lng: 79.85 })).toBeCloseTo(5, 1);
  });
  test('bus between two stops is placed proportionally', () => {
    expect(eta.progressKm(stops, { lat: lat(3.5), lng: 79.85 })).toBeCloseTo(3.5, 1);
  });
});

describe('ETA (TC14)', () => {
  test('3.0 km remaining at 18 km/h is 10 minutes', () => {
    // bus at 2 km, target stop at 5 km
    expect(eta.etaRunning(stops, 2, { lat: lat(2), lng: 79.85 }, 18, 25)).toBe(10);
  });
  test('bus that has passed the stop returns null (TC15)', () => {
    expect(eta.etaRunning(stops, 1, { lat: lat(6), lng: 79.85 }, 18, 25)).toBeNull();
  });
  test('very low speed is lifted to the 8 km/h minimum', () => {
    // 4 km remaining at 8 km/h = 30 min
    expect(eta.etaRunning(stops, 3, { lat: lat(5), lng: 79.85 }, 1, 25)).toBe(30);
  });
  test('unrealistic speed is capped at 45 km/h', () => {
    // 9 km at 45 km/h = 12 min
    expect(eta.etaRunning(stops, 3, { lat: lat(0), lng: 79.85 }, 200, 25)).toBe(12);
  });
  test('falls back to the route average speed when there are no recent fixes', () => {
    expect(eta.etaRunning(stops, 3, { lat: lat(0), lng: 79.85 }, null, 18)).toBe(30);
  });
  test('scheduled trip adds the wait until departure', () => {
    const now = 1_000_000;
    expect(eta.etaScheduled(stops, 2, now + 10 * 60000, 25, now)).toBe(10 + Math.ceil((5 / 25) * 60));
  });
});

describe('recent speed', () => {
  test('averages fixes of the last 60 s only', () => {
    const now = 1_000_000;
    const fixes = [{ t: now - 120000, speed: 5 }, { t: now - 30000, speed: 20 }, { t: now - 10000, speed: 30 }];
    expect(eta.recentSpeedKmh(fixes, now)).toBe(25);
  });
  test('null when nothing is recent', () => {
    expect(eta.recentSpeedKmh([{ t: 0, speed: 10 }], 1_000_000)).toBeNull();
  });
});

describe('delay (TC16)', () => {
  const route = { estimated_duration_min: 30, distance_km: 9 };
  const T0 = 1_000_000;
  const trip = { scheduled_departure: T0 };

  test('on schedule gives zero delay', () => {
    // 15 min of a 30 min trip: should be at 4.5 km
    expect(eta.delayMinutes(route, stops, trip, { lat: lat(5), lng: 79.85 }, 18, T0 + 15 * 60000)).toBe(0);
  });
  test('behind schedule gives a positive delay', () => {
    // should be at 4.5 km after 15 min, but is only at 1 km: 3.5 km behind at 18 km/h = ~12 min
    expect(eta.delayMinutes(route, stops, trip, { lat: lat(1), lng: 79.85 }, 18, T0 + 15 * 60000)).toBe(12);
  });
  test('delay is never negative', () => {
    expect(eta.delayMinutes(route, stops, trip, { lat: lat(9), lng: 79.85 }, 18, T0 + 5 * 60000)).toBe(0);
  });
});

describe('vehicle status (TC13)', () => {
  const now = 1_000_000;
  test('offline when no update for 2 minutes', () => {
    expect(eta.vehicleStatus(now - 121000, 0, now)).toBe('offline');
  });
  test('delayed at 10 minutes', () => {
    expect(eta.vehicleStatus(now - 5000, 10, now)).toBe('delayed');
  });
  test('on time otherwise', () => {
    expect(eta.vehicleStatus(now - 5000, 9, now)).toBe('on_time');
  });
});
