// Seeds the pilot data: operators, stops, routes, vehicles, trips and demo accounts for every role.
// Safe to run again: stops, routes, vehicles and accounts are overwritten with the same ids, and
// trips are created only when they do not exist yet, so live trip state and seat counts are kept.
require('dotenv').config();
const { db, auth } = require('./config/firebase');

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

// Routes written by the previous seed script that have no stop data
const OBSOLETE_ROUTES = ['r006', 'r002', 'r014', 'r100', 'r187', 'r154', 'r177', 'r190'];

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

async function commit(writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    writes.slice(i, i + 400).forEach(fn => fn(batch));
    await batch.commit();
  }
}

async function ensureAccount(a) {
  let user;
  try {
    user = await auth.getUserByEmail(a.email);
    await auth.updateUser(user.uid, { password: a.password, displayName: a.full_name, disabled: false });
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    user = await auth.createUser({ email: a.email, password: a.password, displayName: a.full_name });
  }
  await auth.setCustomUserClaims(user.uid, { role: a.role, operatorId: a.operator_id || null });
  await db.collection('users').doc(user.uid).set({
    full_name: a.full_name, name: a.full_name, email: a.email, phone: a.phone, role: a.role,
    operator_id: a.operator_id || null, status: 'active', preferred_language: 'en', created_at: Date.now()
  }, { merge: true });
  return user.uid;
}

async function seed() {
  const now = Date.now();

  console.log('Seeding operators and stops...');
  await commit([
    ...OPERATORS.map(({ id, ...data }) => (b) => b.set(db.collection('operators').doc(id), { ...data, status: 'active', created_at: now })),
    ...STOPS.map(([id, name, name_si, latitude, longitude]) => (b) => b.set(db.collection('bus_stops').doc(id), { name, name_si, latitude, longitude, created_at: now }))
  ]);
  console.log(`  ✓ ${OPERATORS.length} operators, ${STOPS.length} stops`);

  console.log('Seeding routes...');
  const stopById = Object.fromEntries(STOPS.map(s => [s[0], s]));
  const routeDocs = {};
  const routeWrites = ROUTES.map(r => {
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
      estimated_duration_min: r.minutes, stops, status: 'active', created_at: now
    };
    routeDocs[r.id] = doc;
    return (b) => b.set(db.collection('routes').doc(r.id), doc);
  });
  await commit([...routeWrites, ...OBSOLETE_ROUTES.map(id => (b) => b.delete(db.collection('routes').doc(id)))]);
  console.log(`  ✓ ${ROUTES.length} routes (removed ${OBSOLETE_ROUTES.length} old routes without stops)`);

  console.log('Seeding vehicles...');
  const oldVehicles = await db.collection('vehicles').get();
  await commit([
    ...oldVehicles.docs.map(d => (b) => b.delete(d.ref)),
  ]);
  await commit(VEHICLES.map(([reg, routeId, capacity, reservable, operatorId]) => (b) => b.set(db.collection('vehicles').doc(reg), {
    registration_no: reg, bus_number: reg, operator_id: operatorId, route_id: routeId,
    route_number: routeDocs[routeId].route_number, seat_capacity: capacity, capacity, reservable_seats: reservable,
    booked_seats: 0, status: 'active', delay_minutes: 0, current_trip_id: null, created_at: now
  })));
  console.log(`  ✓ ${VEHICLES.length} vehicles (cleared ${oldVehicles.size} old)`);

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
  const tripWrites = [];
  const existing = new Set((await db.collection('trips').get()).docs.map(d => d.id));
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

  const dayKey = (ms) => new Date(ms + COLOMBO_OFFSET).toISOString().slice(0, 10).replace(/-/g, '');
  VEHICLES.forEach((v, vi) => {
    for (let day = 0; day < 7; day++) {
      slots.forEach((minutes, si) => {
        const scheduled = today + day * DAY_MS + (minutes + vi * 6) * 60000;
        if (scheduled < now) return;
        const id = `seed-${v[0]}-${dayKey(today + day * DAY_MS)}-${si}`;
        if (!existing.has(id)) tripWrites.push((b) => b.set(db.collection('trips').doc(id), tripDoc(vi, scheduled)));
      });
    }
    // a bus about to leave, so the demo always has upcoming trips
    const demoId = `seed-${v[0]}-${dayKey(today)}-demo`;
    if (!existing.has(demoId)) tripWrites.push((b) => b.set(db.collection('trips').doc(demoId), tripDoc(vi, now + (10 + vi * 3) * 60000)));
  });
  await commit(tripWrites);
  console.log(`  ✓ ${tripWrites.length} new trips`);

  console.log('Seeding demo bookings...');
  const demoUid = uids['demo@nexbus.lk'];
  const upcomingId = `seed-NB-4521-${dayKey(today)}-demo`;
  const pastTripId = 'seed-past-r122';
  const pastTrip = { ...tripDoc(3, now - 2 * DAY_MS), status: 'completed', actual_departure: now - 2 * DAY_MS, available_seats: 16 };
  const bookings = [
    { key: 0, trip: upcomingId, route: 'r138', from: 'pettah', to: 'nugegoda', seats: 2, status: 'confirmed', pay: 'success', age: 0, seatsHeld: true },
    { key: 1, trip: pastTripId, route: 'r122', from: 'pettah', to: 'kaduwela', seats: 1, status: 'completed', pay: 'success', age: 2 },
    { key: 2, trip: pastTripId, route: 'r122', from: 'borella', to: 'hanwella', seats: 3, status: 'cancelled', pay: 'unpaid', age: 5 }
  ];
  await db.collection('trips').doc(pastTripId).set(pastTrip);
  await db.collection('bookings').doc(`demo-${demoUid}-3`).delete(); // old-format booking from the previous seed
  for (const bk of bookings) {
    const ref = db.collection('bookings').doc(`demo-${demoUid}-${bk.key}`);
    const wasThere = (await ref.get()).exists;
    const r = routeDocs[bk.route];
    const tripRef = db.collection('trips').doc(bk.trip);
    const trip = (await tripRef.get()).data();
    const amount = r.base_fare_lkr * bk.seats;
    await ref.set({
      booking_reference: `NBDEMO${bk.key}`, user_id: demoUid, trip_id: bk.trip, route_id: bk.route, route_number: r.route_number,
      vehicle_id: trip.vehicle_id, operator_id: trip.operator_id, boarding_stop_id: bk.from, alighting_stop_id: bk.to,
      from: stopById[bk.from][1], to: stopById[bk.to][1], seat_count: bk.seats, fare_amount_lkr: amount,
      booking_status: bk.status, status: bk.status, payment_status: bk.pay, hold_expires_at: 0,
      scheduled_departure: trip.scheduled_departure, created_at: now - bk.age * DAY_MS, created_day: colomboDay(now - bk.age * DAY_MS)
    });
    if (bk.pay === 'success') {
      await db.collection('payments').doc(`demo-pay-${bk.key}`).set({
        booking_id: ref.id, order_id: `demo-pay-${bk.key}`, user_id: demoUid, operator_id: trip.operator_id,
        amount_lkr: amount, currency: 'LKR', payment_status: 'success', status_code: 2, method: 'VISA',
        gateway_payment_id: `DEMO${bk.key}`, created_at: now - bk.age * DAY_MS, updated_at: now - bk.age * DAY_MS,
        created_day: colomboDay(now - bk.age * DAY_MS), paid_day: colomboDay(now - bk.age * DAY_MS)
      });
    }
    if (bk.seatsHeld && !wasThere) await tripRef.update({ available_seats: trip.available_seats - bk.seats });
  }
  console.log(`  ✓ ${bookings.length} demo bookings`);

  console.log('Done!');
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
