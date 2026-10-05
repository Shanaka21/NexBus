// Real-Postgres test helper (replaces the old in-memory Firestore stand-in). Tests run against the
// same Neon database as dev; resetDb() truncates everything so each test file starts from a clean slate.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const jwt = require('jsonwebtoken');
const { pool } = require('../../config/db');

const TABLES = [
  'system_logs', 'notifications', 'payments', 'bookings', 'location_logs', 'trips',
  'route_stops', 'vehicles', 'routes', 'bus_stops', 'refresh_tokens', 'password_resets', 'users', 'operators'
];

async function resetDb() {
  await pool.query(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

const FIXED_USERS = [
  { id: 'p1', email: 'p@x.lk', role: 'passenger', operator_id: null },
  { id: 'd1', email: 'd@x.lk', role: 'driver', operator_id: 'op1' },
  { id: 'o1', email: 'o@x.lk', role: 'operator', operator_id: 'op1' },
  { id: 'a1', email: 'a@x.lk', role: 'admin', operator_id: null }
];

async function seedFixedUsers() {
  await pool.query(
    "INSERT INTO operators (id, name, registration_no, status, created_at) VALUES ('op1','Test Operator','TEST-OP-1','active',$1)",
    [Date.now()]
  );
  for (const u of FIXED_USERS) {
    await pool.query(
      'INSERT INTO users (id, email, full_name, role, operator_id, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [u.id, u.email, u.email, u.role, u.operator_id, 'active', Date.now()]
    );
  }
}

function signFor(u) {
  return jwt.sign(
    { uid: u.id, email: u.email, role: u.role, operatorId: u.operator_id, tokenVersion: 0 },
    process.env.JWT_SECRET,
    { expiresIn: '30m' }
  );
}

const byRole = Object.fromEntries(FIXED_USERS.map((u) => [u.role, u]));

const tokens = {
  passenger: signFor(byRole.passenger),
  driver: signFor(byRole.driver),
  operator: signFor(byRole.operator),
  admin: signFor(byRole.admin),
  garbage: 'garbage',
  expired: jwt.sign(
    { uid: byRole.passenger.id, email: byRole.passenger.email, role: 'passenger', operatorId: null, tokenVersion: 0 },
    process.env.JWT_SECRET,
    { expiresIn: -10 }
  )
};

module.exports = { pool, resetDb, seedFixedUsers, tokens, FIXED_USERS };
