// End-to-end smoke test against a running API and the seeded database.
// Usage: node scripts/smoke.js [baseUrl]      (run `npm run seed` first)
const BASE = process.argv[2] || 'http://localhost:5000';
let failures = 0;

async function call(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; payload = new URLSearchParams(form).toString(); }
  else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failures++;
}

async function login(email, password) {
  const r = await call('POST', '/auth/login', { body: { email, password } });
  if (r.status !== 200) throw new Error(`login failed for ${email}: ${JSON.stringify(r.data)}`);
  return r.data;
}

(async () => {
  // --- security basics
  check('no token -> 401', (await call('GET', '/routes')).status === 401);
  check('bad token -> 401', (await call('GET', '/routes', { token: 'abc' })).status === 401);
  check('wrong password -> 401', (await call('POST', '/auth/login', { body: { email: 'demo@nexbus.lk', password: 'nope-nope' } })).status === 401);
  check('invalid login body -> 400', (await call('POST', '/auth/login', { body: { email: 'x' } })).status === 400);

  const passenger = await login('demo@nexbus.lk', 'Demo@1234');
  const driver = await login('driver@nexbus.lk', 'Driver@1234');
  const operator = await login('operator@nexbus.lk', 'Operator@1234');
  const admin = await login('admin@nexbus.lk', 'Admin@1234');
  check('login returns roles', passenger.role === 'passenger' && driver.role === 'driver' && operator.role === 'operator' && admin.role === 'admin');
  const P = passenger.idToken, D = driver.idToken, O = operator.idToken, A = admin.idToken;

  // --- RBAC
  check('passenger cannot create vehicle -> 403', (await call('POST', '/vehicles', { token: P, body: { registration_no: 'ZZ-1', route_id: 'r138', seat_capacity: 40, reservable_seats: 10 } })).status === 403);
  check('passenger cannot read admin logs -> 403', (await call('GET', '/admin/logs', { token: P })).status === 403);
  check('driver cannot book -> 403', (await call('POST', '/bookings', { token: D, body: {} })).status === 403);

  // --- reference data
  const routes = await call('GET', '/routes', { token: P });
  check('routes with ordered stops', routes.status === 200 && routes.data.length >= 8 && routes.data[0].stops.length >= 2);
  const near = await call('GET', '/stops?near=6.9344,79.8428&limit=3', { token: P });
  check('nearest stops sorted', near.status === 200 && near.data.length === 3 && near.data[0].distance_km <= near.data[1].distance_km, near.data[0]?.name);
  check('bad stop id rejected', (await call('GET', '/stops/../../users/arrivals', { token: P })).status >= 400);

  // --- trips and arrivals
  const trips = await call('GET', '/trips?route_id=r138', { token: P });
  check('trips listed for route', trips.status === 200 && trips.data.length > 0);
  const driverTrips = (await call('GET', '/trips', { token: D })).data;
  const myTrip = driverTrips.find(t => t.route_id === 'r138' && t.status === 'scheduled') || driverTrips.find(t => t.status === 'scheduled');
  check('driver sees own trips', Array.isArray(driverTrips) && driverTrips.length > 0, `${driverTrips.length} trips`);

  const arrivals = await call('GET', '/stops/nugegoda/arrivals', { token: P });
  check('stop arrivals with ETA', arrivals.status === 200 && arrivals.data.length > 0 && typeof arrivals.data[0].eta_min === 'number', arrivals.data[0] && `${arrivals.data[0].route_number} in ${arrivals.data[0].eta_min} min`);

  // --- driver starts a trip and shares GPS
  const route = routes.data.find(r => r.id === myTrip.route_id);
  const start = await call('PATCH', `/trips/${myTrip.id}/status`, { token: D, body: { status: 'running' } });
  check('driver starts trip', start.status === 200, myTrip.id);
  const wrongDriver = await call('POST', '/location', { token: D, body: { trip_id: 'does-not-exist', lat: 6.93, lng: 79.85, accuracy_m: 10 } });
  check('location for unassigned trip -> 403', wrongDriver.status === 403);
  check('location outside Sri Lanka -> 400', (await call('POST', '/location', { token: D, body: { trip_id: myTrip.id, lat: 12.5, lng: 79.85, accuracy_m: 10 } })).status === 400);
  check('low accuracy fix -> 422', (await call('POST', '/location', { token: D, body: { trip_id: myTrip.id, lat: 6.93, lng: 79.85, accuracy_m: 250 } })).status === 422);
  const s0 = route.stops[0], s1 = route.stops[1];
  const fix = await call('POST', '/location', { token: D, body: { trip_id: myTrip.id, lat: s0.lat + (s1.lat - s0.lat) * 0.3, lng: s0.lng + (s1.lng - s0.lng) * 0.3, speed_kmh: 22, accuracy_m: 8 } });
  check('valid GPS fix accepted', fix.status === 204, `status ${fix.status}`);
  const lastStop = route.stops[route.stops.length - 1];
  const live = await call('GET', `/stops/${lastStop.stopId}/arrivals`, { token: P });
  const mine = live.data.find(a => a.trip_id === myTrip.id);
  check('running bus shows live ETA', !!mine && mine.status !== 'scheduled', mine && `${mine.eta_min} min, ${mine.status}`);

  const tripLive = await call('GET', `/trips/${myTrip.id}/live`, { token: P });
  check('trip live detail has next stops', tripLive.status === 200 && tripLive.data.next_stops.length > 0 && tripLive.data.status !== 'scheduled', tripLive.data.next_stops?.map(s => `${s.name} ${s.eta_min}m`).join(', '));
  const me = await call('GET', '/users/me', { token: P });
  check('users/me returns profile', me.status === 200 && me.data.email === 'demo@nexbus.lk' && me.data.role === 'passenger');
  const bad = await call('PATCH', '/users/me', { token: P, body: { phone: 'abc' } });
  check('invalid phone rejected', bad.status === 400);

  // --- recommendation
  const fromId = route.stops[0].stopId, toId = route.stops[2].stopId;
  const rec = await call('GET', `/recommendations?from_stop_id=${fromId}&to_stop_id=${toId}&need_seat=true`, { token: P });
  check('recommendations ranked + explained', rec.status === 200 && rec.data.options.length > 0 && !!rec.data.explanation, rec.data.explanation);
  check('same stop rejected', (await call('GET', `/recommendations?from_stop_id=${fromId}&to_stop_id=${fromId}`, { token: P })).status === 400);

  // --- booking + payment (seat-level selection: seat_numbers instead of a plain count)
  const bookable = trips.data.find(t => t.status === 'scheduled' && t.available_seats >= 10 && t.id !== myTrip.id);
  const before = bookable.available_seats;
  const seatsOf = (t) => call('GET', `/trips/${t.id}/seats`, { token: P });
  check('seat map lists reservable seats', (await seatsOf(bookable)).data.reservable_seats === bookable.reservable_seats);
  // "more than 4 seats" is pure Joi validation, already covered by tests/schemas.test.js; only the
  // business-rule check (seat number vs this trip's reservable_seats) needs an end-to-end call here.
  check('out of range seat rejected', (await call('POST', '/bookings', { token: P, body: { trip_id: bookable.id, boarding_stop_id: fromId, alighting_stop_id: toId, seat_numbers: [999] } })).status === 400);
  check('alighting before boarding rejected', (await call('POST', '/bookings', { token: P, body: { trip_id: bookable.id, boarding_stop_id: toId, alighting_stop_id: fromId, seat_numbers: [1] } })).status === 400);
  const booking = await call('POST', '/bookings', { token: P, body: { trip_id: bookable.id, boarding_stop_id: fromId, alighting_stop_id: toId, seat_numbers: [1, 2] } });
  check('booking created pending_payment', booking.status === 201 && booking.data.booking_status === 'pending_payment', `${booking.data.booking_reference} ${booking.data.fare} seats ${booking.data.seat_numbers}`);
  const avail1 = await call('GET', `/trips/${bookable.id}/availability`, { token: P });
  check('seats held', avail1.data.available_seats === before - 2, `${before} -> ${avail1.data.available_seats}`);
  check('seat map shows 1 and 2 taken', (await seatsOf(bookable)).data.taken.join(',') === '1,2');
  check('re-picking a taken seat is rejected', (await call('POST', '/bookings', { token: P, body: { trip_id: bookable.id, boarding_stop_id: fromId, alighting_stop_id: toId, seat_numbers: [2] } })).status === 409);

  // concurrency: two passengers racing for the exact same seat number -> exactly one wins
  const sameSeatRacers = await Promise.all(Array.from({ length: 2 }, () => call('POST', '/bookings', { token: P, body: { trip_id: bookable.id, boarding_stop_id: fromId, alighting_stop_id: toId, seat_numbers: [9] } })));
  const sameSeatWinners = sameSeatRacers.filter(r => r.status === 201);
  check('only one passenger wins a contested seat', sameSeatWinners.length === 1, `${sameSeatRacers.map(r => r.status)}`);
  for (const r of sameSeatWinners) await call('PATCH', `/bookings/${r.data.id}/cancel`, { token: P });

  // concurrency: last seats taken by parallel requests, each picking a distinct seat. Kept small (3, not
  // a whole busload) because every POST /bookings here shares the same strict rate limit as /auth/login
  // and /payments/checkout, and this script runs all of them within the same 60s window.
  const racers = await Promise.all([3, 4, 5].map(seat => call('POST', '/bookings', { token: P, body: { trip_id: bookable.id, boarding_stop_id: fromId, alighting_stop_id: toId, seat_numbers: [seat] } })));
  const won = racers.filter(r => r.status === 201).length;
  const left = (await call('GET', `/trips/${bookable.id}/availability`, { token: P })).data.available_seats;
  check('parallel bookings never oversell', left >= 0 && left === before - 2 - won, `${won} won, ${left} seats left`);
  for (const r of racers.filter(r => r.status === 201)) await call('PATCH', `/bookings/${r.data.id}/cancel`, { token: P });

  const checkout = await call('POST', '/payments/checkout', { token: P, body: { booking_id: booking.data.id } });
  check('checkout returns PayHere object', checkout.status === 200 && checkout.data.amount && checkout.data.order_id, checkout.data.amount);
  const forged = await call('POST', '/payments/notify', { form: { merchant_id: checkout.data.merchant_id, order_id: checkout.data.order_id, payment_id: 'X', payhere_amount: checkout.data.amount, payhere_currency: 'LKR', status_code: '2', md5sig: 'DEADBEEF' } });
  check('forged notification rejected', forged.status === 400, forged.data.code);
  const stillPending = await call('GET', `/bookings/${booking.data.id}`, { token: P });
  check('booking unchanged after forged notify', stillPending.data.booking_status === 'pending_payment');
  const paid = await call('POST', '/payments/simulate', { token: P, body: { order_id: checkout.data.order_id } });
  check('verified payment processed', paid.status === 200, JSON.stringify(paid.data));
  const confirmed = await call('GET', `/bookings/${booking.data.id}`, { token: P });
  check('booking confirmed after payment', confirmed.data.booking_status === 'confirmed' && confirmed.data.payment_status === 'success');
  const again = await call('POST', '/payments/simulate', { token: P, body: { order_id: checkout.data.order_id } });
  check('duplicate notification is harmless', again.status === 200 && (await call('GET', `/trips/${bookable.id}/availability`, { token: P })).data.available_seats === before - 2);

  const notes = await call('GET', '/notifications/me', { token: P });
  const confirmNote = notes.data.find(n => n.type === 'booking_confirmed');
  check('confirmation notification stored', !!confirmNote);
  if (confirmNote) check('mark notification read', (await call('PATCH', `/notifications/${confirmNote.id}/read`, { token: P })).status === 200);

  const cancel = await call('PATCH', `/bookings/${booking.data.id}/cancel`, { token: P });
  check('cancel returns seats + flags refund', cancel.status === 200 && cancel.data.refund_required === true);
  check('seats returned', (await call('GET', `/trips/${bookable.id}/availability`, { token: P })).data.available_seats === before);
  check('mine list contains booking', (await call('GET', '/bookings/me', { token: P })).data.some(b => b.id === booking.data.id));

  // --- operator
  const fleet = await call('GET', '/vehicles', { token: O });
  check('operator fleet scoped to company', fleet.status === 200 && fleet.data.length > 0 && fleet.data.every(v => v.operator_id === 'op-city'));
  const opBookings = await call('GET', '/operator/bookings', { token: O });
  check('operator bookings + payment', opBookings.status === 200 && opBookings.data.some(b => b.payment));
  const report = await call('GET', '/operator/reports', { token: O });
  check('operator daily report', report.status === 200 && typeof report.data.revenue_lkr === 'number', JSON.stringify(report.data.trips));
  check('operator cannot edit other company vehicle -> 403', (await call('PUT', '/vehicles/SE-0101', { token: O, body: { status: 'inactive' } })).status === 403);
  const stats = await call('GET', '/stats', { token: O });
  check('stats for operator', stats.status === 200 && stats.data.buses.total === fleet.data.length);

  // --- driver finishes trip
  check('driver completes trip', (await call('PATCH', `/trips/${myTrip.id}/status`, { token: D, body: { status: 'completed' } })).status === 200);
  const summary = await call('GET', `/trips/${myTrip.id}/summary`, { token: D });
  check('trip summary has distance/duration', summary.status === 200 && typeof summary.data.distance_km === 'number' && summary.data.status === 'completed', JSON.stringify(summary.data));
  check('passenger cannot read trip summary -> 403', (await call('GET', `/trips/${myTrip.id}/summary`, { token: P })).status === 403);

  // --- admin
  const logs = await call('GET', '/admin/logs?limit=300', { token: A });
  check('audit log has security events', logs.status === 200 && logs.data.some(l => l.action === 'ACCESS_DENIED') && logs.data.some(l => l.action === 'PAYMENT_NOTIFY_REJECTED'), `${logs.data.length} entries`);
  const users = await call('GET', '/admin/users', { token: A });
  check('admin lists users', users.status === 200 && users.data.length >= 6);
  check('internal job without token -> 403', (await call('POST', '/internal/expire-holds')).status === 403);

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
