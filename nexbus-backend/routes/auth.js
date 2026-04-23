const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const user = await admin.auth().createUser({ email, password, displayName: name });
    await admin.firestore().collection('users').doc(user.uid).set({ name, email, role: 'passenger' });
    res.json({ message: 'User registered successfully', uid: user.uid, name, email });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await admin.auth().getUserByEmail(email);
    const userDoc = await admin.firestore().collection('users').doc(user.uid).get();
    const userData = userDoc.data() || {};
    res.json({
      message: 'User found',
      uid: user.uid,
      name: userData.name || user.displayName || 'User',
      email: user.email,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
