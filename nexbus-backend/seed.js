// Seeds the pilot data: operators, stops, routes, vehicles, trips and demo accounts for every role.
// Safe to run again: stops, routes, vehicles and accounts are overwritten with the same ids, and
// trips are created only when they do not exist yet, so live trip state and seat counts are kept.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./config/db');

const OPERATORS = [
  { id: 'op-city', name: 'Colombo City Bus Services', registration_no: 'NCBS-001', contact_phone: '0112345678', email: 'ops@citybus.lk' },
  { id: 'op-south', name: 'Southern Express Lines', registration_no: 'SEL-002', contact_phone: '0912345678', email: 'ops@southexpress.lk' }
];

// id, English name, Sinhala name, latitude, longitude
const STOPS = [
  ['fort', 'Fort', 'කොටුව', 6.9335, 79.8500],
  ['pettah', 'Pettah', 'පිටකොටුව', 6.9374, 79.8528],
  ['maradana', 'Maradana', 'මරදාන', 6.9290, 79.8650],
  ['borella', 'Borella', 'බොරැල්ල', 6.9147, 79.8774],
  ['narahenpita', 'Narahenpita', 'නාරාහේන්පිට', 6.8960, 79.8777],
  ['nugegoda', 'Nugegoda', 'නුගේගොඩ', 6.8649, 79.8997],
  ['maharagama', 'Maharagama', 'මහරගම', 6.8480, 79.9265],
  ['kottawa', 'Kottawa', 'කොට්ටාව', 6.8412, 79.9654],
  ['homagama', 'Homagama', 'හෝමාගම', 6.8441, 80.0021],
  ['rajagiriya', 'Rajagiriya', 'රාජගිරිය', 6.9094, 79.8949],
  ['battaramulla', 'Battaramulla', 'බත්තරමුල්ල', 6.9007, 79.9187],
  ['kaduwela', 'Kaduwela', 'කඩුවෙල', 6.9333, 79.9858],
  ['hanwella', 'Hanwella', 'හංවැල්ල', 6.9005, 80.0830],
  ['avissawella', 'Avissawella', 'අවිස්සාවේල්ල', 6.9535, 80.2104],
  ['kollupitiya', 'Kollupitiya', 'කොල්ලුපිටිය', 6.9109, 79.8493],
  ['bambalapitiya', 'Bambalapitiya', 'බම්බලපිටිය', 6.8892, 79.8553],
  ['wellawatte', 'Wellawatte', 'වැල්ලවත්ත', 6.8741, 79.8590],
  ['dehiwala', 'Dehiwala', 'දෙහිවල', 6.8518, 79.8645],
  ['mount_lavinia', 'Mount Lavinia', 'ගල්කිස්ස', 6.8311, 79.8636],
  ['moratuwa', 'Moratuwa', 'මොරටුව', 6.7731, 79.8816],
  ['panadura', 'Panadura', 'පානදුර', 6.7132, 79.9026],
  ['kalutara', 'Kalutara', 'කළුතර', 6.5854, 79.9607],
  ['galle', 'Galle', 'ගාල්ල', 6.0329, 80.2168],
  ['kadawatha', 'Kadawatha', 'කඩවත', 7.0010, 79.9505],
  ['nittambuwa', 'Nittambuwa', 'නිට්ටඹුව', 7.1442, 80.0968],
  ['kegalle', 'Kegalle', 'කෑගල්ල', 7.2513, 80.3464],
  ['peradeniya', 'Peradeniya', 'පේරාදෙණිය', 7.2606, 80.5967],
  ['kandy', 'Kandy', 'මහනුවර', 7.2906, 80.6337],
  ['wattala', 'Wattala', 'වත්තල', 6.9896, 79.8918],
  ['ja_ela', 'Ja-Ela', 'ජා-ඇල', 7.0742, 79.8919],
  ['negombo', 'Negombo', 'මීගමුව', 7.2008, 79.8737]
];

const ROUTES = [
  { id: 'r138', number: '138', type: 'semi_luxury', fare: 120, minutes: 95, stops: ['pettah', 'maradana', 'borella', 'narahenpita', 'nugegoda', 'maharagama', 'kottawa', 'homagama'] },
  { id: 'r017', number: '17', type: 'normal', fare: 80, minutes: 70, stops: ['pettah', 'maradana', 'borella', 'nugegoda', 'kottawa'] },
  { id: 'r122', number: '122', type: 'semi_luxury', fare: 150, minutes: 120, stops: ['pettah', 'borella', 'rajagiriya', 'battaramulla', 'kaduwela', 'hanwella', 'avissawella'] },
  { id: 'r005', number: '05', type: 'normal', fare: 70, minutes: 65, stops: ['fort', 'kollupitiya', 'bambalapitiya', 'wellawatte', 'dehiwala', 'mount_lavinia', 'moratuwa'] },
  { id: 'r048', number: '48', type: 'semi_luxury', fare: 420, minutes: 240, stops: ['fort', 'pettah', 'kadawatha', 'nittambuwa', 'kegalle', 'peradeniya', 'kandy'] },
  { id: 'r400', number: '400', type: 'normal', fare: 180, minutes: 90, stops: ['fort', 'pettah', 'wattala', 'ja_ela', 'negombo'] },
  { id: 'r001', number: '01', type: 'semi_luxury', fare: 650, minutes: 210, stops: ['fort', 'mount_lavinia', 'moratuwa', 'panadura', 'kalutara', 'galle'] },
  { id: 'rE01', number: 'E01', type: 'expressway', fare: 1100, minutes: 150, stops: ['fort', 'maharagama', 'kottawa', 'galle'] }
];

// registration number, route id, seat capacity, reservable seats, operator id
const VEHICLES = [
  ['NB-4521', 'r138', 54, 20, 'op-city'], ['NB-4522', 'r138', 54, 20, 'op-city'], ['NB-4523', 'r138', 54, 0, 'op-city'],
  ['NB-1221', 'r122', 50, 16, 'op-city'], ['NB-1222', 'r122', 50, 16, 'op-city'],
  ['NC-4801', 'r048', 54, 24, 'op-city'], ['NC-4802', 'r048', 54, 24, 'op-city'],
  ['NC-0501', 'r005', 50, 0, 'op-city'], ['NC-0502', 'r005', 50, 12, 'op-city'],
  ['NC-1701', 'r017', 44, 10, 'op-city'],
  ['NC-4001', 'r400', 54, 20, 'op-city'],
  ['SE-0101', 'r001', 54, 30, 'op-south'], ['SE-0102', 'r001', 54, 30, 'op-south'],
  ['EX-0101', 'rE01', 45, 40, 'op-south'], ['EX-0102', 'rE01', 45, 40, 'op-south']
];

const ACCOUNTS = [
  { email: 'demo@nexbus.lk', password: 'Demo@1234', full_name: 'Demo User', role: 'passenger', phone: '0771234567' },
  { email: 'driver@nexbus.lk', password: 'Driver@1234', full_name: 'Nimal Perera', role: 'driver', operator_id: 'op-city', phone: '0712345601' },
  { email: 'driver2@nexbus.lk', password: 'Driver@1234', full_name: 'Sunil Fernando', role: 'driver', operator_id: 'op-city', phone: '0712345602' },
  { email: 'southdriver@nexbus.lk', password: 'Driver@1234', full_name: 'Kamal Silva', role: 'driver', operator_id: 'op-south', phone: '0712345603' },
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

  console.log('Seeding routes...');
  const stopById = Object.fromEntries(STOPS.map(s => [s[0], s]));
  const routeDocs = {};
  for (const r of ROUTES) {
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
  console.log(`  ✓ ${ROUTES.length} routes`);

  console.log('Seeding vehicles...');
  // Upsert (not delete + recreate): trips/bookings/payments reference vehicles by foreign key, and unlike
  // Firestore, Postgres enforces that — wiping vehicles that already have trips would fail. This also
  // preserves any live vehicle state (position, status) across reseeds, same as operators/routes above.
  for (const [reg, routeId, capacity, reservable, operatorId] of VEHICLES) {
    await pool.query(
      `INSERT INTO vehicles (id, operator_id, route_id, seat_capacity, reservable_seats, booked_seats, status, delay_minutes, created_at)
       VALUES ($1,$2,$3,$4,$5,0,'active',0,$6)
       ON CONFLICT (id) DO UPDATE SET operator_id=$2, route_id=$3, seat_capacity=$4, reservable_seats=$5`,
      [reg, operatorId, routeId, capacity, reservable, now]
    );
  }
  console.log(`  ✓ ${VEHICLES.length} vehicles`);

  console.log('Seeding accounts...');
  const uids = {};
  for (const a of ACCOUNTS) {
    uids[a.email] = await ensureAccount(a);
    console.log(`  ✓ ${a.role.padEnd(9)} ${a.email} / ${a.password}`);
  }

  console.log('Seeding trips...');
  const driverFor = { 'op-city': ['driver@nexbus.lk', 'driver2@nexbus.lk'], 'op-south': ['southdriver@nexbus.lk'] };
  const today = colomboMidnight(now);
  const slots = [7 * 60, 12 * 60 + 30, 17 * 60 + 30]; // minutes after midnight
  const existing = new Set((await pool.query('SELECT id FROM trips')).rows.map(r => r.id));
  const driverNames = Object.fromEntries(ACCOUNTS.map(a => [a.email, a.full_name]));

  const tripDoc = (vehicleIndex, scheduled) => {
    const [reg, routeId, , reservable, operatorId] = VEHICLES[vehicleIndex];
    const drivers = driverFor[operatorId];
    const driverEmail = drivers[vehicleIndex % drivers.length];
    return {
      route_id: routeId, route_number: routeDocs[routeId].route_number, vehicle_id: reg, registration_no: reg,
      operator_id: operatorId, driver_id: uids[driverEmail], driver_name: driverNames[driverEmail],
      scheduled_departure: scheduled, service_date: colomboDay(scheduled), actual_departure: null, direction: 'outbound', status: 'scheduled',
      delay_minutes: 0, reservable_seats: reservable, available_seats: reservable, created_at: now
    };
  };

  const insertTrip = async (id, t) => pool.query(
    `INSERT INTO trips (id, route_id, route_number, vehicle_id, registration_no, operator_id, driver_id, driver_name,
       scheduled_departure, service_date, actual_departure, direction, status, delay_minutes, reservable_seats, available_seats, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [id, t.route_id, t.route_number, t.vehicle_id, t.registration_no, t.operator_id, t.driver_id, t.driver_name,
      t.scheduled_departure, t.service_date, t.actual_departure, t.direction, t.status, t.delay_minutes, t.reservable_seats, t.available_seats, t.created_at]
  );

  const dayKey = (ms) => new Date(ms + COLOMBO_OFFSET).toISOString().slice(0, 10).replace(/-/g, '');
  let newTrips = 0;
  for (let vi = 0; vi < VEHICLES.length; vi++) {
    for (let day = 0; day < 7; day++) {
      for (let si = 0; si < slots.length; si++) {
        const scheduled = today + day * DAY_MS + (slots[si] + vi * 6) * 60000;
        if (scheduled < now) continue;
        const id = `seed-${VEHICLES[vi][0]}-${dayKey(today + day * DAY_MS)}-${si}`;
        if (!existing.has(id)) { await insertTrip(id, tripDoc(vi, scheduled)); newTrips++; }
      }
    }
    // a bus about to leave, so the demo always has upcoming trips
    const demoId = `seed-${VEHICLES[vi][0]}-${dayKey(today)}-demo`;
    if (!existing.has(demoId)) { await insertTrip(demoId, tripDoc(vi, now + (10 + vi * 3) * 60000)); newTrips++; }
  }
  console.log(`  ✓ ${newTrips} new trips`);

  console.log('Seeding demo bookings...');
  const demoUid = uids['demo@nexbus.lk'];
  const upcomingId = `seed-NB-4521-${dayKey(today)}-demo`;
  const pastTripId = 'seed-past-r122';
  const pastTrip = { ...tripDoc(3, now - 2 * DAY_MS), status: 'completed', actual_departure: now - 2 * DAY_MS, available_seats: 16 };
  const pastExisted = existing.has(pastTripId);
  if (pastExisted) {
    await pool.query('UPDATE trips SET status=$1, actual_departure=$2, available_seats=$3 WHERE id=$4', [pastTrip.status, pastTrip.actual_departure, pastTrip.available_seats, pastTripId]);
  } else {
    await insertTrip(pastTripId, pastTrip);
  }

  const bookings = [
    { key: 0, trip: upcomingId, route: 'r138', from: 'pettah', to: 'nugegoda', seats: 2, status: 'confirmed', pay: 'success', age: 0, seatsHeld: true },
    { key: 1, trip: pastTripId, route: 'r122', from: 'pettah', to: 'kaduwela', seats: 1, status: 'completed', pay: 'success', age: 2 },
    { key: 2, trip: pastTripId, route: 'r122', from: 'borella', to: 'hanwella', seats: 3, status: 'cancelled', pay: 'unpaid', age: 5 }
  ];
  for (const bk of bookings) {
    const id = `demo-${demoUid}-${bk.key}`;
    const wasThere = (await pool.query('SELECT id FROM bookings WHERE id = $1', [id])).rows[0];
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
    if (bk.seatsHeld && !wasThere) await pool.query('UPDATE trips SET available_seats = available_seats - $1 WHERE id = $2', [bk.seats, bk.trip]);
  }
  console.log(`  ✓ ${bookings.length} demo bookings`);

  console.log('Done!');
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
