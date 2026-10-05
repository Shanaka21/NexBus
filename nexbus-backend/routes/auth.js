const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { strict } = require('../middleware/rateLimit');
const { AppError } = require('../utils/errors');
const schemas = require('../schemas');
const authService = require('../services/auth.service');
const userService = require('../services/user.service');
const audit = require('../services/audit.service');

const googleClient = new OAuth2Client();

router.post('/register', strict, validate(schemas.register), async (req, res) => {
  const { full_name: fullName, name, email, phone, password } = req.valid.body;
  const user = await userService.createAccount({ email, password, phone, full_name: fullName || name, role: 'passenger' });
  await audit.log({ userId: user.uid, action: 'REGISTER', entity: 'users', entityId: user.uid });
  res.status(201).json({ message: 'User registered successfully', uid: user.uid, name: user.full_name, email, role: 'passenger' });
});

router.post('/login', strict, validate(schemas.login), async (req, res) => {
  res.json(await authService.login(req.valid.body.email, req.valid.body.password));
});

// Mobile Google sign-in: client gets a Google ID token via expo-auth-session, we verify it here.
router.post('/google', strict, validate(schemas.google), async (req, res) => {
  // The mobile app may authorize with its web, Android or iOS OAuth client id depending on platform;
  // accept any of them as a valid audience (comma-separated in the env var).
  const clientIds = (process.env.GOOGLE_CLIENT_ID || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!clientIds.length) throw new AppError(500, 'AUTH_NOT_CONFIGURED', 'Google sign-in is not configured on the server');
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: req.valid.body.id_token, audience: clientIds });
    payload = ticket.getPayload();
  } catch {
    throw new AppError(401, 'TOKEN_INVALID', 'Invalid Google sign-in token');
  }
  res.json(await authService.loginWithGoogle({ googleSub: payload.sub, email: payload.email, name: payload.name }));
});

router.post('/refresh', validate(schemas.refresh), async (req, res) => {
  res.json(await authService.refresh(req.valid.body.refresh_token));
});

router.post('/forgot-password', strict, validate(schemas.forgotPassword), async (req, res) => {
  res.json(await authService.forgotPassword(req.valid.body.email));
});

router.post('/reset-password', strict, validate(schemas.resetPassword), async (req, res) => {
  res.json(await authService.resetPassword(req.valid.body.token, req.valid.body.password));
});

// Legacy profile endpoints (kept for the existing mobile screens); new code should use /users/me
router.get('/:uid', authenticate, async (req, res) => {
  if (req.params.uid !== req.user.uid && req.user.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'You can read only your own profile');
  }
  res.json(await userService.getProfile(req.params.uid));
});

router.put('/:uid', authenticate, validate(schemas.profilePatch), async (req, res) => {
  if (req.params.uid !== req.user.uid) throw new AppError(403, 'FORBIDDEN', 'You can update only your own profile');
  const patch = { ...req.valid.body };
  if (patch.name && !patch.full_name) patch.full_name = patch.name;
  await userService.updateProfile(req.user.uid, patch);
  res.json({ message: 'Profile updated' });
});

module.exports = router;
