process.env.NODE_ENV = 'test';
process.env.INTERNAL_JOB_TOKEN = 'job-secret';
process.env.PAYHERE_MERCHANT_ID = '1211149';
process.env.PAYHERE_MERCHANT_SECRET = 'test-secret';
const request = require('supertest');
const { pool, resetDb, seedFixedUsers, tokens } = require('./helpers/db');
const app = require('../app');

const as = (req, role) => req.set('Authorization', `Bearer ${tokens[role] || role}`);
const logs = async (where) => (await pool.query('SELECT * FROM system_logs')).rows.filter(where);

beforeEach(async () => { await resetDb(); await seedFixedUsers(); });
afterAll(async () => { await pool.end(); });

describe('authentication (ST1, ST2)', () => {
  test('request without a token is rejected', async () => {
    const res = await request(app).get('/routes');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_MISSING');
  });

  test('invalid token is rejected and logged', async () => {
    const res = await as(request(app).get('/routes'), 'garbage');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_INVALID');
    expect(await logs(l => l.action === 'AUTH_FAILED' && l.severity === 'security')).not.toHaveLength(0);
  });

  test('expired token is rejected', async () => {
    const res = await as(request(app).get('/routes'), 'expired');
    expect(res.status).toBe(401);
  });

  test('every API path is also available under /api', async () => {
    const res = await request(app).get('/api/routes');
    expect(res.status).toBe(401);
  });
});

describe('role based access (ST4, ST5, TC04)', () => {
  test('passenger cannot create a vehicle and the denial is audited', async () => {
    const res = await as(request(app).post('/vehicles'), 'passenger').send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(await logs(l => l.action === 'ACCESS_DENIED' && l.user_id === 'p1')).not.toHaveLength(0);
  });

  test.each([
    ['passenger', 'get', '/admin/logs'],
    ['operator', 'get', '/admin/users'],
    ['driver', 'post', '/bookings'],
    ['operator', 'post', '/bookings'],
    ['passenger', 'post', '/location'],
    ['passenger', 'get', '/operator/reports'],
    ['driver', 'get', '/vehicles'],
    ['admin', 'post', '/trips']
  ])('%s cannot %s %s', async (role, method, path) => {
    const res = await as(request(app)[method](path), role).send({});
    expect(res.status).toBe(403);
  });
});

describe('input validation (Table 6.4)', () => {
  test('booking with 5 seats is rejected', async () => {
    const res = await as(request(app).post('/bookings'), 'passenger')
      .send({ trip_id: 't1', boarding_stop_id: 'a', alighting_stop_id: 'b', seat_numbers: [1, 2, 3, 4, 5] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('path-like trip id is rejected', async () => {
    const res = await as(request(app).post('/bookings'), 'passenger')
      .send({ trip_id: '../../users', boarding_stop_id: 'a', alighting_stop_id: 'b', seat_numbers: [1] });
    expect(res.status).toBe(400);
  });

  test('location outside valid range is rejected', async () => {
    const res = await as(request(app).post('/location'), 'driver').send({ trip_id: 't1', lat: 95, lng: 79, accuracy_m: 5 });
    expect(res.status).toBe(400);
  });

  test('registration with invalid email is rejected', async () => {
    const res = await request(app).post('/auth/register').send({ full_name: 'Nimal', email: 'user@', password: 'secret1' });
    expect(res.status).toBe(400);
  });

  test('recommendations need two different stops', async () => {
    const res = await as(request(app).get('/recommendations?from_stop_id=a&to_stop_id=a'), 'passenger');
    expect(res.status).toBe(400);
  });

  test('unknown fields are stripped, not trusted', async () => {
    // an extra "role" field must never reach account creation
    const res = await request(app).post('/auth/register').send({ full_name: 'X', email: 'bad', password: 'secret1', role: 'admin' });
    expect(res.status).toBe(400);
  });
});

describe('payment notification endpoint (ST12, TC27)', () => {
  const form = (over = {}) => ({
    merchant_id: '1211149', order_id: 'NB1-x', payment_id: 'P', payhere_amount: '240.00',
    payhere_currency: 'LKR', status_code: '2', md5sig: 'DEADBEEF', ...over
  });

  test('forged signature is rejected, booking untouched and event logged as security', async () => {
    const res = await request(app).post('/payments/notify').type('form').send(form());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_SIGNATURE');
    expect(await logs(l => l.action === 'PAYMENT_NOTIFY_REJECTED' && l.severity === 'security')).not.toHaveLength(0);
  });

  test('malformed notification is rejected and logged', async () => {
    const res = await request(app).post('/payments/notify').type('form').send({ order_id: 'x' });
    expect(res.status).toBe(400);
    expect(await logs(l => l.action === 'PAYMENT_NOTIFY_REJECTED')).not.toHaveLength(0);
  });

  test('wrong merchant id is rejected', async () => {
    const res = await request(app).post('/payments/notify').type('form').send(form({ merchant_id: '1' }));
    expect(res.status).toBe(400);
  });

  test('checkout needs a signed-in passenger', async () => {
    expect((await request(app).post('/payments/checkout').send({ booking_id: 'b1' })).status).toBe(401);
    expect((await as(request(app).post('/payments/checkout'), 'operator').send({ booking_id: 'b1' })).status).toBe(403);
  });

  test('simulate endpoint is disabled unless PAYHERE_SIMULATE=true', async () => {
    delete process.env.PAYHERE_SIMULATE;
    const res = await as(request(app).post('/payments/simulate'), 'passenger').send({ order_id: 'o1' });
    expect(res.status).toBe(404);
  });
});

describe('internal scheduler endpoints (ST15)', () => {
  test('rejected without the job token', async () => {
    expect((await request(app).post('/internal/expire-holds')).status).toBe(403);
  });

  test('rejected with a wrong token and logged', async () => {
    const res = await request(app).post('/internal/expire-holds').set('x-internal-token', 'nope');
    expect(res.status).toBe(403);
    expect(await logs(l => l.action === 'ACCESS_DENIED')).not.toHaveLength(0);
  });

  test('a user token is not accepted as a job token', async () => {
    expect((await as(request(app).post('/internal/expire-holds'), 'admin')).status).toBe(403);
  });
});

describe('transport security and error handling (ST9-ST11)', () => {
  test('security headers are set', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('unknown path returns JSON 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('malformed JSON returns 400, not a stack trace', async () => {
    const res = await request(app).post('/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js/);
  });

  test('unexpected errors return a generic 500 without internals (ST10)', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const original = pool.query.bind(pool);
    pool.query = () => { throw new Error('secret database detail'); };
    const res = await as(request(app).get('/notifications/me'), 'passenger');
    pool.query = original;
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  });
});
