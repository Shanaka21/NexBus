require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { general } = require('./middleware/rateLimit');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1); // behind Cloud Run / a reverse proxy
app.use(helmet());
// Browsers may call the API from the origins in DASHBOARD_ORIGIN (comma separated) and from localhost on any
// port, which is where the dashboard (:5173) and the Expo web app (:8081) run during development.
// Without DASHBOARD_ORIGIN every origin is allowed. Requests with no Origin (the phone app) are not affected by CORS.
const allowedOrigins = (process.env.DASHBOARD_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
const isLocalOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || !allowedOrigins.length || allowedOrigins.includes(origin) || isLocalOrigin(origin))
}));
// image uploads are base64 JSON with their own, larger limit (see middleware/imageBody.js), parsed after sign-in and rate limiting
const IMAGE_ROUTE = /^(\/api)?\/(uploads\/|users\/me\/photo)/;
const smallJson = express.json({ limit: '50kb' });
app.use((req, res, next) => (IMAGE_ROUTE.test(req.path) ? next() : smallJson(req, res, next)));
app.use(general);

app.get('/', (req, res) => {
  res.send('NexBus backend is running ✅');
});

// Every resource is available at "/" (existing mobile app) and at "/api" (as documented in the thesis)
const api = express.Router();
api.use('/auth', require('./routes/auth'));
api.use('/users', require('./routes/users'));
api.use('/uploads', require('./routes/uploads'));
api.use('/routes', require('./routes/routes'));
api.use('/stops', require('./routes/stops'));
api.use('/buses', require('./routes/buses'));
api.use('/vehicles', require('./routes/vehicles'));
api.use('/trips', require('./routes/trips'));
api.use('/location', require('./routes/location'));
api.use('/bookings', require('./routes/bookings'));
api.use('/payments', require('./routes/payments'));
api.use('/wallet', require('./routes/wallet'));
api.use('/recommendations', require('./routes/recommendations'));
api.use('/notifications', require('./routes/notifications'));
api.use('/operator', require('./routes/operator'));
api.use('/admin', require('./routes/admin'));
api.use('/internal', require('./routes/internal'));
api.use('/stats', require('./routes/stats'));
app.use('/api', api);
app.use('/', api);

app.use((req, res) => res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }));
app.use(errorHandler);

module.exports = app;
