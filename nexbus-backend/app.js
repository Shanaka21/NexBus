require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { general } = require('./middleware/rateLimit');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1); // behind Cloud Run / a reverse proxy
app.use(helmet());
app.use(cors({ origin: process.env.DASHBOARD_ORIGIN ? process.env.DASHBOARD_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '50kb' }));
app.use(general);

app.get('/', (req, res) => {
  res.send('NexBus backend is running ✅');
});

// Every resource is available at "/" (existing mobile app) and at "/api" (as documented in the thesis)
const api = express.Router();
api.use('/auth', require('./routes/auth'));
api.use('/users', require('./routes/users'));
api.use('/routes', require('./routes/routes'));
api.use('/stops', require('./routes/stops'));
api.use('/buses', require('./routes/buses'));
api.use('/vehicles', require('./routes/vehicles'));
api.use('/trips', require('./routes/trips'));
api.use('/location', require('./routes/location'));
api.use('/bookings', require('./routes/bookings'));
api.use('/payments', require('./routes/payments'));
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
