// Tests firestore.rules against the local Firestore emulator (npm run emulators, then npm run test:rules).
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, setLogLevel } = require('firebase/firestore');

setLogLevel('error'); // denied writes are expected here; keep the output readable

let env;

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'nexbus-rules-test',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8'), host, port: Number(port) }
  });
  // seed data written with rules disabled (like the Admin SDK does)
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'routes/r1'), { route_number: '138' });
    await setDoc(doc(db, 'bus_stops/s1'), { name: 'Pettah' });
    await setDoc(doc(db, 'vehicles/v1'), { registration_no: 'NB-1', operator_id: 'opA' });
    await setDoc(doc(db, 'trips/t1'), { status: 'running', operator_id: 'opA' });
    await setDoc(doc(db, 'bookings/b-p1'), { user_id: 'p1', operator_id: 'opA' });
    await setDoc(doc(db, 'bookings/b-p2'), { user_id: 'p2', operator_id: 'opB' });
    await setDoc(doc(db, 'payments/pay-p1'), { user_id: 'p1', operator_id: 'opA' });
    await setDoc(doc(db, 'notifications/n-p1'), { user_id: 'p1' });
    await setDoc(doc(db, 'notifications/n-p2'), { user_id: 'p2' });
    await setDoc(doc(db, 'users/p1'), { email: 'p1@x.lk' });
    await setDoc(doc(db, 'users/p2'), { email: 'p2@x.lk' });
    await setDoc(doc(db, 'operators/opA'), { name: 'A' });
    await setDoc(doc(db, 'location_logs/l1'), { latitude: 6.9 });
    await setDoc(doc(db, 'system_logs/log1'), { action: 'LOGIN' });
  });
});

afterAll(() => env.cleanup());

const passenger = (uid = 'p1') => env.authenticatedContext(uid, { role: 'passenger' }).firestore();
const operator = (opId = 'opA') => env.authenticatedContext('o1', { role: 'operator', operatorId: opId }).firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

describe('reference and live data', () => {
  test('signed-out visitors can read nothing', async () => {
    for (const p of ['routes/r1', 'bus_stops/s1', 'vehicles/v1', 'trips/t1']) await assertFails(getDoc(doc(anonymous(), p)));
  });
  test('signed-in users can read routes, stops, vehicles and trips', async () => {
    for (const p of ['routes/r1', 'bus_stops/s1', 'vehicles/v1', 'trips/t1']) await assertSucceeds(getDoc(doc(passenger(), p)));
  });
});

describe('clients can never write (ST6)', () => {
  test.each(['bookings/new', 'trips/t1', 'vehicles/v1', 'routes/r1', 'payments/x', 'users/p1', 'notifications/n-p1'])(
    'passenger cannot write %s', async (p) => {
      await assertFails(setDoc(doc(passenger(), p), { hacked: true }));
    });
  test('passenger cannot update or delete a booking', async () => {
    await assertFails(updateDoc(doc(passenger(), 'bookings/b-p1'), { booking_status: 'confirmed' }));
    await assertFails(deleteDoc(doc(passenger(), 'bookings/b-p1')));
  });
  test('operators cannot write either', async () => {
    await assertFails(updateDoc(doc(operator(), 'trips/t1'), { available_seats: 999 }));
    await assertFails(setDoc(doc(operator(), 'vehicles/new'), { x: 1 }));
  });
});

describe('private records (ST7)', () => {
  test('passenger reads own booking, payment, notification and profile', async () => {
    await assertSucceeds(getDoc(doc(passenger('p1'), 'bookings/b-p1')));
    await assertSucceeds(getDoc(doc(passenger('p1'), 'payments/pay-p1')));
    await assertSucceeds(getDoc(doc(passenger('p1'), 'notifications/n-p1')));
    await assertSucceeds(getDoc(doc(passenger('p1'), 'users/p1')));
  });
  test('passenger cannot read another passenger\'s records', async () => {
    await assertFails(getDoc(doc(passenger('p1'), 'bookings/b-p2')));
    await assertFails(getDoc(doc(passenger('p1'), 'notifications/n-p2')));
    await assertFails(getDoc(doc(passenger('p1'), 'users/p2')));
    await assertFails(getDoc(doc(passenger('p2'), 'payments/pay-p1')));
  });
  test('operator reads bookings of their own company only', async () => {
    await assertSucceeds(getDoc(doc(operator('opA'), 'bookings/b-p1')));
    await assertFails(getDoc(doc(operator('opA'), 'bookings/b-p2')));
    await assertSucceeds(getDoc(doc(operator('opA'), 'payments/pay-p1')));
  });
  test('listing all bookings is refused', async () => {
    await assertFails(getDocs(collection(passenger('p1'), 'bookings')));
  });
});

describe('server-only collections', () => {
  test.each(['operators/opA', 'location_logs/l1', 'system_logs/log1'])('no client can read %s', async (p) => {
    await assertFails(getDoc(doc(passenger(), p)));
    await assertFails(getDoc(doc(operator(), p)));
    await assertFails(getDoc(doc(env.authenticatedContext('a1', { role: 'admin' }).firestore(), p)));
  });
});
