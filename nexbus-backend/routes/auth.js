const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
console.log('FIREBASE_API_KEY loaded:', FIREBASE_API_KEY ? 'YES' : 'MISSING');

// Register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }
  try {
    const user = await admin.auth().createUser({ email, password, displayName: name });
    await admin.firestore().collection('users').doc(user.uid).set({
      name,
      email,
      role: 'passenger',
      created_at: Date.now()
    });
    res.json({ message: 'User registered successfully', uid: user.uid, name, email });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login — verifies password via Firebase Auth REST API
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  try {
    const authRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true })
      }
    );
    const authData = await authRes.json();
    console.log('Firebase Auth response:', JSON.stringify(authData));
    if (authData.error) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const userDoc = await admin.firestore().collection('users').doc(authData.localId).get();
    const userData = userDoc.data() || {};
    res.json({
      message: 'Login successful',
      uid: authData.localId,
      name: userData.name || authData.displayName || 'User',
      email: authData.email
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user profile
router.get('/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    const data = userDoc.data();
    res.json({ uid: userDoc.id, ...data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
router.put('/:uid', async (req, res) => {
  const { uid } = req.params;
  const { name, phone, region } = req.body;
  try {
    const updates = {};
    if (name)   updates.name   = name;
    if (phone)  updates.phone  = phone;
    if (region) updates.region = region;
    await admin.firestore().collection('users').doc(uid).set(updates, { merge: true });
    res.json({ message: 'Profile updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
