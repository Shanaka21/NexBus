const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://nexbus-7f898-default-rtdb.firebaseio.com"
});

const app = express();
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const busRoutes = require('./routes/buses');
const bookingRoutes = require('./routes/bookings');

app.use('/auth', authRoutes);
app.use('/buses', busRoutes);
app.use('/bookings', bookingRoutes);

app.get('/', (req, res) => {
  res.send('NexBus backend is running ✅');
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});