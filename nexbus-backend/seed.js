// Seeds the pilot data: one operator, six routes (177 Kaduwela - Kollupitiya, 143 Kaduwela - Pettah, 190 Meegoda - Pettah,
// 505 Alawwa - Giriulla, 17 Panadura - Kandy, 05 Colombo - Kurunegala) in both directions, with only their bus stops, a
// timetable (a bus every few minutes from 05:00 to 22:00), the buses to run it, and demo accounts for every role.
// Stop positions are approximate (OpenStreetMap town centres).
// Safe to run again: stops, routes, vehicles and accounts are overwritten with the same ids; the seeded trips and demo
// bookings are recreated, while trips that real bookings point to are kept.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./config/db');

const OPERATORS = [
  { id: 'op-city', name: 'Colombo City Bus Services', registration_no: 'NCBS-001', contact_phone: '0112345678', email: 'ops@citybus.lk' }
];

// id, English name, Sinhala name, latitude, longitude: only the stops of the seeded routes
const STOPS = [
  ['fort', 'Colombo Fort', 'කොළඹ කොටුව', 6.9335, 79.8500],
  ['pettah', 'Pettah', 'පිටකොටුව', 6.9374, 79.8528],
  ['maradana', 'Maradana', 'මරදාන', 6.9290, 79.8650],
  ['borella', 'Borella', 'බොරැල්ල', 6.9147, 79.8774],
  ['kollupitiya', 'Kollupitiya', 'කොල්ලුපිටිය', 6.9109, 79.8493],
  ['rajagiriya', 'Rajagiriya', 'රාජගිරිය', 6.9094, 79.8949],
  ['battaramulla', 'Battaramulla', 'බත්තරමුල්ල', 6.9007, 79.9187],
  ['malabe', 'Malabe', 'මාලබේ', 6.9047, 79.9578],
  ['kaduwela', 'Kaduwela', 'කඩුවෙල', 6.9333, 79.9858],
  ['weliweriya', 'Weliweriya', 'වැලිවේරිය', 7.0323, 80.0283],
  ['yakkala', 'Yakkala', 'යක්කල', 7.0859, 80.0336],
  ['nugegoda', 'Nugegoda', 'නුගේගොඩ', 6.8649, 79.8997],
  ['meegoda', 'Meegoda', 'මීගොඩ', 6.8441, 80.0460],
  ['athurugiriya', 'Athurugiriya', 'අතුරුගිරිය', 6.8780, 79.9900],
  ['dehiwala', 'Dehiwala', 'දෙහිවල', 6.8518, 79.8645],
  ['mount_lavinia', 'Mount Lavinia', 'ගල්කිස්ස', 6.8311, 79.8636],
  ['moratuwa', 'Moratuwa', 'මොරටුව', 6.7731, 79.8816],
  ['panadura', 'Panadura', 'පානදුර', 6.7132, 79.9026],
  ['kadawatha', 'Kadawatha', 'කඩවත', 7.0010, 79.9505],
  ['nittambuwa', 'Nittambuwa', 'නිට්ටඹුව', 7.1442, 80.0968],
  ['warakapola', 'Warakapola', 'වරකාපොල', 7.2250, 80.1965],
  ['kegalle', 'Kegalle', 'කෑගල්ල', 7.2513, 80.3464],
  ['peradeniya', 'Peradeniya', 'පේරාදෙණිය', 7.2606, 80.5967],
  ['kandy', 'Kandy', 'මහනුවර', 7.2906, 80.6337],
  ['giriulla', 'Giriulla', 'ගිරිඋල්ල', 7.3299, 80.1225],
  ['alawwa', 'Alawwa', 'අලව්ව', 7.2940, 80.2392],
  ['polgahawela', 'Polgahawela', 'පොල්ගහවෙල', 7.3353, 80.3002],
  ['kurunagala', 'Kurunegala', 'කුරුණෑගල', 7.4870, 80.3649],
  // stops of the 143, 505 and 06 routes (positions from OpenStreetMap; Wallampitiya, Kosgas Junction and Balummahara are estimates)
  ['Welivita', 'Welivita', 'වැලිවිට', 6.9387, 79.9613],
  ['Angoda', 'Angoda', 'අංගොඩ', 6.9360, 79.9257],
  ['Wallampitiya', 'Wallampitiya', 'වල්ලම්පිටිය', 6.9560, 79.9030],
  ['Orugodawatta', 'Orugodawatta', 'ඔරුගොඩවත්ත', 6.9484, 79.8887],
  ['Kosgas Junction', 'Kosgas Junction', 'කොස්ගස් හංදිය', 6.9440, 79.8790],
  ['Armour Street', 'Armour Street', 'ආමර් වීදිය', 6.9418, 79.8649],
  ['nawathalwatta junction', 'Nawathalwatta Junction', 'නවතල්වත්ත හංදිය', 7.2888, 80.2049],
  ['boyawalana', 'Boyawalana', 'බෝයවලාන', 7.3343, 80.1766],
  ['paranagama', 'Paranagama', 'පරණගම', 7.3349, 80.1449],
  ['maharagama junction', 'Maharagama Junction', 'මහරගම හංදිය', 7.3380, 80.1496],
  ['kiribathgoda', 'Kiribathgoda', 'කිරිබත්ගොඩ', 6.9782, 79.9270],
  ['balummahara', 'Balummahara', 'බලුම්මහර', 7.0450, 79.9980],
  ['pasyala', 'Pasyala', 'පස්යාල', 7.1684, 80.1242],
  ['wewaldeniya', 'Wewaldeniya', 'වේවල්දෙණිය', 7.2022, 80.1528],
  ['ambepussa', 'Ambepussa', 'අඹේපුස්ස', 7.2421, 80.2110],
  ['pothuhera', 'Pothuhera', 'පොතුහැර', 7.4198, 80.3282]
];

// Timetable: a bus leaves every `headway` minutes from 05:00 until 22:00 (the last departure), from both ends of a route.
// The way back is a route of its own with the stops reversed and the same number, so booking, ETAs and the planner
// treat each direction like any other route. `minutes` is the trip time; it sets how many buses each direction needs.
const FIRST_DEPARTURE_MIN = 5 * 60;
const LAST_DEPARTURE_MIN = 22 * 60;
const DAYS_AHEAD = 3; // today and the next two days

const ROUTES = [
  { id: 'r177', number: '177', type: 'normal', fare: 70, minutes: 60, headway: 10, stops: ['kaduwela', 'malabe', 'battaramulla', 'rajagiriya', 'borella', 'kollupitiya'] },
  { id: 'r143', number: '143', type: 'normal', fare: 75, minutes: 75, headway: 5, stops: ['kaduwela', 'Welivita', 'Angoda', 'Wallampitiya', 'Orugodawatta', 'Kosgas Junction', 'Armour Street', 'pettah'] },
  { id: 'r190', number: '190', type: 'normal', fare: 100, minutes: 100, headway: 15, stops: ['meegoda', 'athurugiriya', 'malabe', 'battaramulla', 'rajagiriya', 'borella', 'maradana', 'pettah'] },
  { id: 'r505', number: '505', type: 'normal', fare: 50, minutes: 40, headway: 20, stops: ['alawwa', 'nawathalwatta junction','boyawalana','paranagama','maharagama junction','giriulla'] },
  { id: 'r017', number: '17', type: 'semi_luxury', fare: 520, minutes: 260, headway: 30, stops: ['panadura', 'moratuwa', 'mount_lavinia', 'dehiwala', 'nugegoda', 'rajagiriya', 'battaramulla', 'malabe', 'kaduwela', 'weliweriya', 'yakkala', 'nittambuwa', 'warakapola', 'kegalle', 'peradeniya', 'kandy'] },
  { id: 'r006', number: '06', type: 'semi_luxury', fare: 350, minutes: 180, headway: 30, stops: ['pettah', 'kiribathgoda', 'balummahara', 'yakkala','nittambuwa', 'pasyala', 'wewaldeniya', 'warakapola', 'ambepussa','alawwa','polgahawela','pothuhera','kurunagala'] }
];

// every route in both directions: r177 (Kaduwela - Kollupitiya) and r177r (Kollupitiya - Kaduwela)
const ALL_ROUTES = ROUTES.flatMap((r) => [r, { ...r, id: `${r.id}r`, stops: [...r.stops].reverse(), reverse: true }]);

// Enough buses per direction to keep the headway: one trip takes `minutes`, so a bus is back every minutes/headway departures
const SEATS = 56; // every seat can be reserved in the app (the seat picker shows reservable_seats)
const fleetSize = (r) => Math.ceil(r.minutes / r.headway) + 1;
const regNo = (r, i) => `NB-${r.number.padStart(3, '0')}${r.reverse ? 'B' : 'A'}${String(i + 1).padStart(2, '0')}`;
const fleetOf = Object.fromEntries(ALL_ROUTES.map((r) => [r.id, Array.from({ length: fleetSize(r) }, (_, i) => regNo(r, i))]));

// registration number, route id, seat capacity, reservable seats, operator id
const VEHICLES = ALL_ROUTES.flatMap((r) => fleetOf[r.id].map((reg) => [reg, r.id, SEATS, SEATS, 'op-city']));

// The two demo drivers each drive one bus; the other trips have no driver yet (an operator assigns one)
const DRIVER_VEHICLE = { 'driver@nexbus.lk': fleetOf.r143[0], 'driver2@nexbus.lk': fleetOf.r177[0] };

const ACCOUNTS = [
  { email: 'demo@nexbus.lk', password: 'Demo@1234', full_name: 'Demo User', role: 'passenger', phone: '0771234567' },
  { email: 'driver@nexbus.lk', password: 'Driver@1234', full_name: 'Nimal Perera', role: 'driver', operator_id: 'op-city', phone: '0712345601' },
  { email: 'driver2@nexbus.lk', password: 'Driver@1234', full_name: 'Sunil Fernando', role: 'driver', operator_id: 'op-city', phone: '0712345602' },
  { email: 'operator@nexbus.lk', password: 'Operator@1234', full_name: 'City Bus Operator', role: 'operator', operator_id: 'op-city', phone: '0112345678' },
  { email: 'admin@nexbus.lk', password: 'Admin@1234', full_name: 'NexBus Admin', role: 'admin', phone: '0112000000' }
];

const DAY_MS = 24 * 3600 * 1000;
const COLOMBO_OFFSET = 5.5 * 3600 * 1000;
const colomboDay = (ms) => new Date(ms + COLOMBO_OFFSET).toISOString().slice(0, 10);

function haversine(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Start of the current Sri Lanka day as epoch ms
function colomboMidnight(now = Date.now()) {
  return Math.floor((now + COLOMBO_OFFSET) / DAY_MS) * DAY_MS - COLOMBO_OFFSET;
}

const crypto = require('crypto');

async function ensureAccount(a) {
  const passwordHash = await bcrypt.hash(a.password, 10);
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [a.email]);
  if (existing.rows[0]) {
    const uid = existing.rows[0].id;
    await pool.query(
      'UPDATE users SET password_hash=$1, full_name=$2, phone=$3, role=$4, operator_id=$5, status=$6 WHERE id=$7',
      [passwordHash, a.full_name, a.phone, a.role, a.operator_id || null, 'active', uid]
    );
    return uid;
  }
  const uid = crypto.randomUUID();
  await pool.query(
    `INSERT INTO users (id, email, password_hash, full_name, phone, role, operator_id, status, preferred_language, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'active','en',$8)`,
    [uid, a.email, passwordHash, a.full_name, a.phone, a.role, a.operator_id || null, Date.now()]
  );
  return uid;
}

const dayKey = (ms) => new Date(ms + COLOMBO_OFFSET).toISOString().slice(0, 10).replace(/-/g, '');

const TRIP_COLUMNS = ['id', 'route_id', 'route_number', 'vehicle_id', 'registration_no', 'operator_id', 'driver_id', 'driver_name',
  'scheduled_departure', 'service_date', 'actual_departure', 'direction', 'status', 'delay_minutes', 'reservable_seats', 'available_seats', 'created_at'];

// Inserts many trips per query: the full timetable is a few thousand rows
async function insertTrips(rows) {
  const per = TRIP_COLUMNS.length;
  for (let i = 0; i < rows.length; i += 300) {
    const chunk = rows.slice(i, i + 300);
    const values = chunk.map((_, j) => `(${TRIP_COLUMNS.map((__, c) => `$${j * per + c + 1}`).join(',')})`).join(',');
    await pool.query(`INSERT INTO trips (${TRIP_COLUMNS.join(', ')}) VALUES ${values} ON CONFLICT (id) DO NOTHING`, chunk.flat());
  }
}

async function seed() {
  const now = Date.now();

  console.log('Seeding operators and stops...');
  for (const o of OPERATORS) {
    await pool.query(
      `INSERT INTO operators (id, name, registration_no, contact_phone, email, status, created_at) VALUES ($1,$2,$3,$4,$5,'active',$6)
       ON CONFLICT (id) DO UPDATE SET name=$2, registration_no=$3, contact_phone=$4, email=$5`,
      [o.id, o.name, o.registration_no, o.contact_phone, o.email, now]
    );
  }
  for (const [id, name, nameSi, latitude, longitude] of STOPS) {
    await pool.query(
      `INSERT INTO bus_stops (id, name, name_si, latitude, longitude, created_at) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET name=$2, name_si=$3, latitude=$4, longitude=$5`,
      [id, name, nameSi, latitude, longitude, now]
    );
  }
  console.log(`  ✓ ${OPERATORS.length} operators, ${STOPS.length} stops`);

  console.log('Clearing the previous seeded timetable...');
  // The demo bookings and the seeded trips of an earlier run are replaced; trips that real bookings point to stay
  await pool.query("DELETE FROM payments WHERE id LIKE 'demo-pay-%'");
  await pool.query("DELETE FROM bookings WHERE id LIKE 'demo-%'");
  await pool.query("DELETE FROM trips WHERE id LIKE 'seed-%' AND id NOT IN (SELECT trip_id FROM bookings WHERE trip_id IS NOT NULL)");

  console.log('Seeding routes...');
  const stopById = Object.fromEntries(STOPS.map(s => [s[0], s]));
  const routeDocs = {};
  for (const r of ALL_ROUTES) {
    let total = 0;
    const stops = r.stops.map((stopId, i) => {
      if (i > 0) total += haversine([stopById[r.stops[i - 1]][3], stopById[r.stops[i - 1]][4]], [stopById[stopId][3], stopById[stopId][4]]);
      return { stop_id: stopId, sequence_no: i + 1, distance_from_origin_km: Number(total.toFixed(3)) };
    });
    const first = stopById[r.stops[0]][1];
    const last = stopById[r.stops[r.stops.length - 1]][1];
    const doc = {
      route_number: r.number, route_name: `${first} - ${last}`, start_point: first, end_point: last,
      via: r.stops.slice(1, -1).map(id => stopById[id][1]).slice(0, 3).join(', '),
      service_type: r.type, base_fare_lkr: r.fare, distance_km: Number(total.toFixed(2)),
      estimated_duration_min: r.minutes, stops
    };
    routeDocs[r.id] = doc;
    await pool.query(
      `INSERT INTO routes (id, route_number, route_name, start_point, end_point, via, service_type, base_fare_lkr, distance_km, estimated_duration_min, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11)
       ON CONFLICT (id) DO UPDATE SET route_number=$2, route_name=$3, start_point=$4, end_point=$5, via=$6, service_type=$7, base_fare_lkr=$8, distance_km=$9, estimated_duration_min=$10`,
      [r.id, doc.route_number, doc.route_name, doc.start_point, doc.end_point, doc.via, doc.service_type, doc.base_fare_lkr, doc.distance_km, doc.estimated_duration_min, now]
    );
    await pool.query('DELETE FROM route_stops WHERE route_id = $1', [r.id]);
    for (const s of stops) {
      await pool.query('INSERT INTO route_stops (route_id, stop_id, sequence_no, distance_from_origin_km) VALUES ($1,$2,$3,$4)', [r.id, s.stop_id, s.sequence_no, s.distance_from_origin_km]);
    }
  }
  // stops that no seeded route uses any more (e.g. after a route is changed) are removed, unless something refers to them
  await pool.query(
    `DELETE FROM bus_stops WHERE id <> ALL($1)
       AND id NOT IN (SELECT stop_id FROM route_stops)
       AND id NOT IN (SELECT boarding_stop_id FROM bookings WHERE boarding_stop_id IS NOT NULL)
       AND id NOT IN (SELECT alighting_stop_id FROM bookings WHERE alighting_stop_id IS NOT NULL)`,
    [STOPS.map((x) => x[0])]
  );
  console.log(`  ✓ ${ALL_ROUTES.length} routes (${ROUTES.length} routes, both directions)`);

  console.log('Seeding vehicles...');
  // Upsert (not delete + recreate): live vehicle state (position, status) is kept across reseeds
  for (const [reg, routeId, capacity, reservable, operatorId] of VEHICLES) {
    await pool.query(
      `INSERT INTO vehicles (id, operator_id, route_id, seat_capacity, reservable_seats, booked_seats, status, delay_minutes, created_at)
       VALUES ($1,$2,$3,$4,$5,0,'active',0,$6)
       ON CONFLICT (id) DO UPDATE SET operator_id=$2, route_id=$3, seat_capacity=$4, reservable_seats=$5`,
      [reg, operatorId, routeId, capacity, reservable, now]
    );
  }
  // buses of an earlier fleet plan are removed unless a trip, booking or position log still refers to them
  await pool.query(
    `DELETE FROM vehicles WHERE id <> ALL($1)
       AND id NOT IN (SELECT vehicle_id FROM trips WHERE vehicle_id IS NOT NULL)
       AND id NOT IN (SELECT vehicle_id FROM bookings WHERE vehicle_id IS NOT NULL)
       AND id NOT IN (SELECT vehicle_id FROM location_logs WHERE vehicle_id IS NOT NULL)`,
    [VEHICLES.map((v) => v[0])]
  );
  console.log(`  ✓ ${VEHICLES.length} vehicles`);

  console.log('Seeding accounts...');
  const uids = {};
  for (const a of ACCOUNTS) {
    uids[a.email] = await ensureAccount(a);
    console.log(`  ✓ ${a.role.padEnd(9)} ${a.email} / ${a.password}`);
  }
  const driverOf = {};
  for (const [email, reg] of Object.entries(DRIVER_VEHICLE)) driverOf[reg] = { id: uids[email], name: ACCOUNTS.find((a) => a.email === email).full_name };

  for (const [reg, d] of Object.entries(driverOf)) await pool.query('UPDATE vehicles SET driver_id = $1 WHERE id = $2', [d.id, reg]);

  console.log('Seeding trips...');
  const today = colomboMidnight(now);
  const tripRow = (id, r, vehicle, scheduled, extra = {}) => {
    const d = driverOf[vehicle];
    const t = {
      status: 'scheduled', actual_departure: null, available_seats: SEATS, ...extra
    };
    return [id, r.id, r.number, vehicle, vehicle, 'op-city', d ? d.id : null, d ? d.name : null,
      scheduled, colomboDay(scheduled), t.actual_departure, r.reverse ? 'inbound' : 'outbound', t.status, 0, SEATS, t.available_seats, now];
  };

  const rows = [];
  const firstTrip = {}; // route id -> first upcoming trip id, used by the demo booking
  for (const r of ALL_ROUTES) {
    const fleet = fleetOf[r.id];
    let k = 0; // buses take the departures in turn, so each one is back in time for its next trip
    for (let day = 0; day < DAYS_AHEAD; day++) {
      for (let m = FIRST_DEPARTURE_MIN; m <= LAST_DEPARTURE_MIN; m += r.headway) {
        const vehicle = fleet[k++ % fleet.length];
        const scheduled = today + day * DAY_MS + m * 60000;
        if (scheduled < now) continue;
        const hhmm = `${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}`;
        const id = `seed-${r.id}-${dayKey(scheduled)}-${hhmm}`;
        if (!firstTrip[r.id]) firstTrip[r.id] = id;
        rows.push(tripRow(id, r, vehicle, scheduled));
      }
    }
  }
  await insertTrips(rows);
  console.log(`  ✓ ${rows.length} trips (05:00 to 22:00, ${DAYS_AHEAD} days)`);
  for (const r of ROUTES) {
    console.log(`    ${r.number.padEnd(4)} every ${String(r.headway).padStart(2)} min, ${fleetOf[r.id].length} buses each way`);
  }

  console.log('Seeding demo bookings...');
  const demoUid = uids['demo@nexbus.lk'];
  const upcomingId = firstTrip.r177;
  const pastTripId = 'seed-past-r143';
  await insertTrips([tripRow(pastTripId, ALL_ROUTES.find((r) => r.id === 'r143'), fleetOf.r143[0], now - 2 * DAY_MS, { status: 'completed', actual_departure: now - 2 * DAY_MS })]);

  const bookings = [
    { key: 0, trip: upcomingId, route: 'r177', from: 'kaduwela', to: 'borella', seats: 2, status: 'confirmed', pay: 'success', age: 0, seatsHeld: true },
    { key: 1, trip: pastTripId, route: 'r143', from: 'kaduwela', to: 'pettah', seats: 1, status: 'completed', pay: 'success', age: 2 },
    { key: 2, trip: pastTripId, route: 'r143', from: 'borella', to: 'maradana', seats: 3, status: 'cancelled', pay: 'unpaid', age: 5 }
  ];
  for (const bk of bookings) {
    const id = `demo-${demoUid}-${bk.key}`;
    const r = routeDocs[bk.route];
    const trip = (await pool.query('SELECT * FROM trips WHERE id = $1', [bk.trip])).rows[0];
    const amount = r.base_fare_lkr * bk.seats;
    const createdAt = now - bk.age * DAY_MS;
    await pool.query(
      `INSERT INTO bookings (id, booking_reference, user_id, trip_id, route_id, route_number, vehicle_id, operator_id,
         boarding_stop_id, alighting_stop_id, from_name, to_name, seat_count, fare_amount_lkr, status, payment_status,
         hold_expires_at, scheduled_departure, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,0,$17,$18)
       ON CONFLICT (id) DO UPDATE SET status=$15, payment_status=$16`,
      [id, `NBDEMO${bk.key}`, demoUid, bk.trip, bk.route, r.route_number, trip.vehicle_id, trip.operator_id,
        bk.from, bk.to, stopById[bk.from][1], stopById[bk.to][1], bk.seats, amount, bk.status, bk.pay,
        Number(trip.scheduled_departure), createdAt]
    );
    if (bk.pay === 'success') {
      const payId = `demo-pay-${bk.key}`;
      await pool.query(
        `INSERT INTO payments (id, booking_id, user_id, operator_id, amount_lkr, currency, payment_status, status_code, method, gateway_payment_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,'LKR','success',2,'VISA',$6,$7,$7)
         ON CONFLICT (id) DO NOTHING`,
        [payId, id, demoUid, trip.operator_id, amount, `DEMO${bk.key}`, createdAt]
      );
    }
    if (bk.seatsHeld) await pool.query('UPDATE trips SET available_seats = available_seats - $1 WHERE id = $2', [bk.seats, bk.trip]);
  }
  console.log(`  ✓ ${bookings.length} demo bookings`);

  console.log('Done!');
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
