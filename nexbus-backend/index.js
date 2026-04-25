require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://nexbus-7f898-default-rtdb.firebaseio.com'
});

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/auth',     require('./routes/auth'));
app.use('/buses',    require('./routes/buses'));
app.use('/bookings', require('./routes/bookings'));
app.use('/routes',   require('./routes/routes'));
app.use('/stats',    require('./routes/stats'));

app.get('/', (req, res) => {
  res.send('NexBus backend is running ✅');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`NexBus backend running on port ${PORT}`);
});
