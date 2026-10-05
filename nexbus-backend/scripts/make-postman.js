// Generates docs/NexBus.postman_collection.json (import it into Postman). Run: node scripts/make-postman.js
const fs = require('fs');
const path = require('path');

const ROLES = { passenger: 'passengerToken', driver: 'driverToken', operator: 'operatorToken', admin: 'adminToken' };

// [folder, name, method, path, role (null = public), body]
const E = [
  ['Auth', 'Register passenger', 'POST', '/auth/register', null, { full_name: 'Nimal Perera', email: 'nimal@example.com', phone: '0771234567', password: 'Secret@123' }],
  ['Auth', 'Login (passenger)', 'POST', '/auth/login', null, { email: 'demo@nexbus.lk', password: 'Demo@1234' }],
  ['Auth', 'Login (driver)', 'POST', '/auth/login', null, { email: 'driver@nexbus.lk', password: 'Driver@1234' }],
  ['Auth', 'Login (operator)', 'POST', '/auth/login', null, { email: 'operator@nexbus.lk', password: 'Operator@1234' }],
  ['Auth', 'Login (admin)', 'POST', '/auth/login', null, { email: 'admin@nexbus.lk', password: 'Admin@1234' }],
  ['Auth', 'Refresh token', 'POST', '/auth/refresh', null, { refresh_token: '{{refreshToken}}' }],
  ['Auth', 'Forgot password', 'POST', '/auth/forgot-password', null, { email: 'demo@nexbus.lk' }],
  ['Auth', 'Reset password', 'POST', '/auth/reset-password', null, { token: '{{resetToken}}', password: 'NewSecret@123' }],
  ['Auth', 'Google sign-in', 'POST', '/auth/google', null, { id_token: '{{googleIdToken}}' }],
  ['Users', 'My profile', 'GET', '/users/me', 'passenger'],
  ['Users', 'Update my profile', 'PATCH', '/users/me', 'passenger', { phone: '0771234567', preferred_language: 'si' }],
  ['Routes and stops', 'List routes', 'GET', '/routes', 'passenger'],
  ['Routes and stops', 'Get route', 'GET', '/routes/r138', 'passenger'],
  ['Routes and stops', 'Create route', 'POST', '/routes', 'operator', { route_number: '999', service_type: 'normal', base_fare_lkr: 100, estimated_duration_min: 60, stop_ids: ['pettah', 'borella', 'nugegoda'] }],
  ['Routes and stops', 'Update route', 'PUT', '/routes/r138', 'operator', { base_fare_lkr: 130 }],
  ['Routes and stops', 'Deactivate route', 'DELETE', '/routes/r017', 'admin'],
  ['Routes and stops', 'List stops (nearest)', 'GET', '/stops?near=6.9344,79.8428&limit=3', 'passenger'],
  ['Routes and stops', 'Create stop', 'POST', '/stops', 'operator', { name: 'Test stop', name_si: 'පරීක්ෂණ', latitude: 6.9, longitude: 79.9 }],
  ['Routes and stops', 'Stop arrivals (ETA)', 'GET', '/stops/nugegoda/arrivals', 'passenger'],
  ['Vehicles', 'Fleet (operator / admin)', 'GET', '/vehicles', 'operator'],
  ['Vehicles', 'Live fleet', 'GET', '/vehicles/live', 'operator'],
  ['Vehicles', 'Register vehicle', 'POST', '/vehicles', 'operator', { registration_no: 'NB-9999', route_id: 'r138', seat_capacity: 54, reservable_seats: 20 }],
  ['Vehicles', 'Update vehicle', 'PUT', '/vehicles/NB-4521', 'operator', { reservable_seats: 24 }],
  ['Vehicles', 'Set vehicle status', 'PUT', '/buses/NB-4521/status', 'operator', { status: 'emergency' }],
  ['Vehicles', 'Public bus list (live map)', 'GET', '/buses', 'passenger'],
  ['Trips', 'List trips (passenger by route)', 'GET', '/trips?route_id=r138', 'passenger'],
  ['Trips', 'List my trips today (driver)', 'GET', '/trips', 'driver'],
  ['Trips', 'Schedule trip', 'POST', '/trips', 'operator', { route_id: 'r138', vehicle_id: 'NB-4521', driver_id: '{{driverUid}}', scheduled_departure: '2026-10-10T07:00:00+05:30' }],
  ['Trips', 'Seat availability', 'GET', '/trips/{{tripId}}/availability', 'passenger'],
  ['Trips', 'Trip summary (distance/duration)', 'GET', '/trips/{{tripId}}/summary', 'driver'],
  ['Trips', 'Live detail (next stops, ETA)', 'GET', '/trips/{{tripId}}/live', 'passenger'],
  ['Trips', 'Start trip', 'PATCH', '/trips/{{tripId}}/status', 'driver', { status: 'running' }],
  ['Trips', 'End trip', 'PATCH', '/trips/{{tripId}}/status', 'driver', { status: 'completed' }],
  ['Tracking', 'Send GPS fix', 'POST', '/location', 'driver', { trip_id: '{{tripId}}', lat: 6.9372, lng: 79.8530, speed_kmh: 22, heading: 90, accuracy_m: 8 }],
  ['Bookings', 'Create booking', 'POST', '/bookings', 'passenger', { trip_id: '{{tripId}}', boarding_stop_id: 'pettah', alighting_stop_id: 'nugegoda', seat_count: 2 }],
  ['Bookings', 'My bookings', 'GET', '/bookings/me', 'passenger'],
  ['Bookings', 'Get booking', 'GET', '/bookings/{{bookingId}}', 'passenger'],
  ['Bookings', 'Cancel booking', 'PATCH', '/bookings/{{bookingId}}/cancel', 'passenger'],
  ['Payments', 'Create PayHere checkout', 'POST', '/payments/checkout', 'passenger', { booking_id: '{{bookingId}}' }],
  ['Payments', 'PayHere notify (form, signed)', 'POST', '/payments/notify', null, 'merchant_id=...&order_id=...&payment_id=...&payhere_amount=240.00&payhere_currency=LKR&status_code=2&md5sig=...'],
  ['Payments', 'Sandbox simulate (PAYHERE_SIMULATE=true)', 'POST', '/payments/simulate', 'passenger', { order_id: '{{orderId}}' }],
  ['Decision support', 'Recommendations', 'GET', '/recommendations?from_stop_id=pettah&to_stop_id=nugegoda&need_seat=true', 'passenger'],
  ['Notifications', 'My notifications', 'GET', '/notifications/me', 'passenger'],
  ['Notifications', 'Mark read', 'PATCH', '/notifications/{{notificationId}}/read', 'passenger'],
  ['Notifications', 'Mark all read', 'PATCH', '/notifications/read-all', 'passenger'],
  ['Operator', 'Drivers', 'GET', '/operator/drivers', 'operator'],
  ['Operator', 'Create driver', 'POST', '/operator/drivers', 'operator', { full_name: 'New Driver', email: 'newdriver@nexbus.lk', phone: '0712345678', password: 'Driver@1234' }],
  ['Operator', 'Bookings and payments', 'GET', '/operator/bookings?date=2026-10-04', 'operator'],
  ['Operator', 'Daily report', 'GET', '/operator/reports?date=2026-10-04', 'operator'],
  ['Operator', 'Overview stats', 'GET', '/stats', 'operator'],
  ['Admin', 'Operators', 'GET', '/admin/operators', 'admin'],
  ['Admin', 'Register operator', 'POST', '/admin/operators', 'admin', { name: 'New Bus Co', registration_no: 'NBC-003' }],
  ['Admin', 'Users', 'GET', '/admin/users?role=driver', 'admin'],
  ['Admin', 'Create staff account', 'POST', '/admin/users', 'admin', { full_name: 'New Operator', email: 'newop@nexbus.lk', password: 'Operator@1234', role: 'operator', operator_id: 'op-city' }],
  ['Admin', 'Enable / disable user', 'PATCH', '/admin/users/{{userUid}}/status', 'admin', { status: 'disabled' }],
  ['Admin', 'Audit logs', 'GET', '/admin/logs?severity=security&limit=100', 'admin'],
  ['Scheduler', 'Expire unpaid holds', 'POST', '/internal/expire-holds', 'scheduler'],
  ['Scheduler', 'Purge old location logs', 'POST', '/internal/purge-logs', 'scheduler'],
];

const folders = {};
for (const [folder, name, method, urlPath, role, body] of E) {
  const header = [];
  if (role === 'scheduler') header.push({ key: 'x-internal-token', value: '{{internalJobToken}}' });
  else if (role) header.push({ key: 'Authorization', value: `Bearer {{${ROLES[role]}}}` });

  const isForm = typeof body === 'string';
  if (body) header.push({ key: 'Content-Type', value: isForm ? 'application/x-www-form-urlencoded' : 'application/json' });

  const item = {
    name,
    request: {
      method,
      header,
      url: { raw: `{{baseUrl}}${urlPath}`, host: ['{{baseUrl}}'], path: urlPath.split('?')[0].split('/').filter(Boolean) },
      ...(body ? { body: { mode: 'raw', raw: isForm ? body : JSON.stringify(body, null, 2) } } : {}),
    },
  };
  // after a login, store the tokens in collection variables for the other requests
  if (name.startsWith('Login (')) {
    const role2 = name.match(/\((\w+)\)/)[1];
    item.event = [{
      listen: 'test',
      script: { type: 'text/javascript', exec: [
        'const r = pm.response.json();',
        `pm.collectionVariables.set('${ROLES[role2]}', r.idToken);`,
        "pm.collectionVariables.set('refreshToken', r.refreshToken);",
      ] },
    }];
  }
  (folders[folder] = folders[folder] || []).push(item);
}

const collection = {
  info: {
    name: 'NexBus API',
    description: 'All endpoints of the NexBus REST API. Run the four Login requests first: they store the tokens used by the other requests. Set baseUrl (default http://localhost:5000; every path also works under /api).',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:5000' },
    ...Object.values(ROLES).map((key) => ({ key, value: '' })),
    ...['refreshToken', 'tripId', 'bookingId', 'orderId', 'driverUid', 'userUid', 'notificationId', 'internalJobToken', 'resetToken', 'googleIdToken'].map((key) => ({ key, value: '' })),
  ],
  item: Object.entries(folders).map(([name, item]) => ({ name, item })),
};

const out = path.join(__dirname, '..', 'docs', 'NexBus.postman_collection.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(collection, null, 2) + '\n');
console.log(`wrote ${E.length} requests to ${path.relative(process.cwd(), out)}`);
