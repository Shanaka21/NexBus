// Replays a bus journey along a route by sending GPS fixes exactly like the driver app does.
//
// Usage:
//   node scripts/gps-simulator.js --trip <tripId> [--email driver@nexbus.lk] [--password Driver@1234]
//                                 [--api http://localhost:5000] [--interval 10] [--speed 25] [--start] [--finish]
//
//   --interval  seconds between fixes (design value 10; use 2 for a quick demo)
//   --speed     bus speed in km/h (a low speed on a timetable makes the trip run late and triggers delay alerts)
//   --start     start the trip first (status running);  --finish  complete the trip at the last stop
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));

const API = args.api || process.env.API_URL || 'http://localhost:5000';
const EMAIL = args.email || 'driver@nexbus.lk';
const PASSWORD = args.password || 'Driver@1234';
const INTERVAL = Number(args.interval || 10);
const SPEED = Number(args.speed || 25);

if (!args.trip) {
  console.error('Missing --trip <tripId>. List your trips with GET /trips as the driver.');
  process.exit(1);
}

const rad = (d) => (d * Math.PI) / 180;
function km(a, b) {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

async function call(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

(async () => {
  const login = await call('POST', '/auth/login', null, { email: EMAIL, password: PASSWORD });
  if (login.status !== 200) throw new Error(`Login failed: ${login.data?.error}`);
  const token = login.data.idToken;

  const trips = (await call('GET', '/trips', token)).data;
  const trip = trips.find(t => t.id === args.trip);
  if (!trip) throw new Error('Trip not found among your trips');
  const route = (await call('GET', `/routes/${trip.route_id}`, token)).data;
  const path = route.stops.map(s => ({ lat: s.lat, lng: s.lng }));

  if (args.start) {
    const r = await call('PATCH', `/trips/${trip.id}/status`, token, { status: 'running' });
    console.log('start trip:', r.status, r.data?.error || 'running');
  }

  const stepKm = (SPEED * INTERVAL) / 3600;
  let segment = 0;
  let along = 0; // km travelled on the current segment
  let sent = 0;

  const timer = setInterval(async () => {
    const a = path[segment];
    const b = path[segment + 1];
    if (!b) {
      clearInterval(timer);
      console.log('reached the last stop');
      if (args.finish) console.log('complete trip:', (await call('PATCH', `/trips/${trip.id}/status`, token, { status: 'completed' })).status);
      return;
    }
    const length = km(a, b);
    along += stepKm;
    while (along >= length && path[segment + 2]) { along -= length; segment++; }
    const from = path[segment];
    const to = path[segment + 1];
    const segLen = km(from, to);
    const f = Math.min(1, along / segLen);
    if (f >= 1 && !path[segment + 2]) segment++;
    const fix = {
      trip_id: trip.id,
      lat: from.lat + (to.lat - from.lat) * f,
      lng: from.lng + (to.lng - from.lng) * f,
      speed_kmh: SPEED, heading: 0, accuracy_m: 8
    };
    const r = await call('POST', '/location', token, fix);
    sent++;
    console.log(`${new Date().toISOString()} fix #${sent} (${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}) -> ${r.status}${r.data?.error ? ' ' + r.data.error : ''}`);
  }, INTERVAL * 1000);
})().catch(e => { console.error(e.message); process.exit(1); });
