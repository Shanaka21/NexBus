const Joi = require('joi');

// Document ids: letters, digits, dash and underscore only (blocks path tricks such as "../users")
const id = Joi.string().pattern(/^[A-Za-z0-9_-]{1,64}$/).messages({ 'string.pattern.base': '{{#label}} is not a valid id' });
const email = Joi.string().email().max(120).lowercase().trim();
const phone = Joi.string().pattern(/^[0-9+\- ]{7,20}$/).allow('').messages({ 'string.pattern.base': 'phone number is not valid' });
const password = Joi.string().min(6).max(72);

const stopName = Joi.string().trim().min(1).max(80);
const lat = Joi.number().min(-90).max(90);
const lng = Joi.number().min(-180).max(180);

exports.register = Joi.object({
  full_name: Joi.string().trim().min(2).max(80),
  name: Joi.string().trim().min(2).max(80), // older clients send `name`
  email: email.required(),
  phone,
  password: password.required()
}).or('full_name', 'name');

exports.login = Joi.object({ email: email.required(), password: Joi.string().required() });
exports.refresh = Joi.object({ refresh_token: Joi.string().required() });
exports.forgotPassword = Joi.object({ email: email.required() });
exports.resetPassword = Joi.object({ token: Joi.string().required(), password: password.required() });
exports.google = Joi.object({ id_token: Joi.string().required() });

exports.profilePatch = Joi.object({
  full_name: Joi.string().trim().min(2).max(80),
  name: Joi.string().trim().min(2).max(80),
  phone,
  region: Joi.string().trim().max(60).allow(''),
  preferred_language: Joi.string().valid('en', 'si', 'ta'),
  push_token: Joi.string().max(4096)
}).min(1);

exports.stop = Joi.object({
  name: stopName.required(),
  name_si: Joi.string().trim().max(80).allow(''),
  latitude: Joi.number().min(5.9).max(9.9).required(),
  longitude: Joi.number().min(79.5).max(81.9).required()
});

exports.stopsQuery = Joi.object({
  near: Joi.string().pattern(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/),
  limit: Joi.number().integer().min(1).max(50)
});

exports.route = Joi.object({
  route_number: Joi.string().trim().min(1).max(10).required(),
  route_name: Joi.string().trim().max(120),
  service_type: Joi.string().valid('normal', 'semi_luxury', 'luxury', 'expressway'),
  base_fare_lkr: Joi.number().positive().max(100000).required(),
  estimated_duration_min: Joi.number().integer().min(1).max(1440).required(),
  stop_ids: Joi.array().items(id).min(2).required()
});

exports.routeUpdate = Joi.object({
  route_number: Joi.string().trim().min(1).max(10),
  route_name: Joi.string().trim().max(120),
  service_type: Joi.string().valid('normal', 'semi_luxury', 'luxury', 'expressway'),
  base_fare_lkr: Joi.number().positive().max(100000),
  estimated_duration_min: Joi.number().integer().min(1).max(1440),
  stop_ids: Joi.array().items(id).min(2)
}).min(1);

exports.vehicle = Joi.object({
  registration_no: Joi.string().trim().min(3).max(20).required(),
  route_id: id.required(),
  seat_capacity: Joi.number().integer().min(1).max(80).required(),
  reservable_seats: Joi.number().integer().min(0).max(Joi.ref('seat_capacity')).required()
});

exports.vehicleUpdate = Joi.object({
  registration_no: Joi.string().trim().min(3).max(20),
  route_id: id,
  seat_capacity: Joi.number().integer().min(1).max(80),
  reservable_seats: Joi.number().integer().min(0).max(80),
  status: Joi.string().valid('active', 'delayed', 'emergency', 'inactive')
}).min(1);

exports.vehicleStatus = Joi.object({ status: Joi.string().valid('active', 'delayed', 'emergency', 'inactive').required() });

exports.trip = Joi.object({
  route_id: id.required(),
  vehicle_id: id.required(),
  driver_id: id.required(),
  scheduled_departure: Joi.date().required(),
  direction: Joi.string().valid('outbound', 'inbound')
});

exports.tripsQuery = Joi.object({
  route_id: id,
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
  status: Joi.string().valid('scheduled', 'running', 'completed', 'cancelled')
});

exports.tripStatus = Joi.object({ status: Joi.string().valid('running', 'completed', 'cancelled').required() });

exports.location = Joi.object({
  trip_id: id.required(),
  lat: lat.required(),
  lng: lng.required(),
  speed_kmh: Joi.number().min(0).max(200).default(0),
  heading: Joi.number().min(0).max(360).default(0),
  accuracy_m: Joi.number().min(0).required()
});

exports.booking = Joi.object({
  trip_id: id.required(),
  boarding_stop_id: id.required(),
  alighting_stop_id: id.required().invalid(Joi.ref('boarding_stop_id')),
  seat_numbers: Joi.array().items(Joi.number().integer().min(1).max(200)).unique().min(1).max(4).required()
});

exports.checkout = Joi.object({ booking_id: id.required() });
exports.simulate = Joi.object({
  order_id: Joi.string().max(80).required(),
  status_code: Joi.string().valid('2', '0', '-1', '-2').default('2')
});

// PayHere posts form data; unknown fields are ignored
exports.payhereNotify = Joi.object({
  merchant_id: Joi.string().required(),
  order_id: Joi.string().max(80).required(),
  payment_id: Joi.string().max(80).allow(''),
  payhere_amount: Joi.string().pattern(/^\d+(\.\d+)?$/).required(),
  payhere_currency: Joi.string().max(5).required(),
  status_code: Joi.string().pattern(/^-?\d$/).required(),
  md5sig: Joi.string().required(),
  method: Joi.string().max(20).allow('')
});

exports.recommendations = Joi.object({
  from_stop_id: id.required(),
  to_stop_id: id.required().invalid(Joi.ref('from_stop_id')),
  need_seat: Joi.boolean().default(false)
});

exports.ask = Joi.object({
  query: Joi.string().trim().min(1).max(300).required(),
  // the last few chat turns, so follow-ups like "and a seat please" make sense
  history: Joi.array().items(Joi.object({
    role: Joi.string().valid('user', 'assistant').required(),
    text: Joi.string().trim().min(1).max(600).required()
  })).max(8),
  lat: Joi.number().min(5.9).max(9.9),
  lng: Joi.number().min(79.5).max(81.9)
}).and('lat', 'lng');

exports.driver = Joi.object({
  full_name: Joi.string().trim().min(2).max(80).required(),
  email: email.required(),
  phone,
  password: password.required()
});

exports.operatorBookingsQuery = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
  status: Joi.string().valid('pending_payment', 'confirmed', 'expired', 'cancelled', 'completed')
});

exports.reportQuery = Joi.object({ date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/) });

exports.operatorCompany = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  registration_no: Joi.string().trim().min(2).max(40).required(),
  contact_phone: phone,
  email: email
});

exports.adminUser = Joi.object({
  full_name: Joi.string().trim().min(2).max(80).required(),
  email: email.required(),
  phone,
  password: password.required(),
  role: Joi.string().valid('operator', 'admin').required(),
  operator_id: id.when('role', { is: 'operator', then: Joi.required(), otherwise: Joi.forbidden() })
});

exports.userStatus = Joi.object({ status: Joi.string().valid('active', 'disabled').required() });
exports.usersQuery = Joi.object({ role: Joi.string().valid('passenger', 'driver', 'operator', 'admin') });
exports.logsQuery = Joi.object({
  action: Joi.string().max(40),
  user_id: id,
  severity: Joi.string().valid('info', 'warning', 'security'),
  limit: Joi.number().integer().min(1).max(500)
});
