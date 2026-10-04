const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { strict } = require('../middleware/rateLimit');
const { AppError } = require('../utils/errors');
const schemas = require('../schemas');
const authService = require('../services/auth.service');
const userService = require('../services/user.service');
const audit = require('../services/audit.service');

router.post('/register', strict, validate(schemas.register), async (req, res) => {
  const { full_name: fullName, name, email, phone, password } = req.valid.body;
  const user = await userService.createAccount({ email, password, phone, full_name: fullName || name, role: 'passenger' });
  await audit.log({ userId: user.uid, action: 'REGISTER', entity: 'users', entityId: user.uid });
  res.status(201).json({ message: 'User registered successfully', uid: user.uid, name: user.full_name, email, role: 'passenger' });
});

router.post('/login', strict, validate(schemas.login), async (req, res) => {
  res.json(await authService.login(req.valid.body.email, req.valid.body.password));
});

router.post('/refresh', validate(schemas.refresh), async (req, res) => {
  res.json(await authService.refresh(req.valid.body.refresh_token));
});

router.post('/forgot-password', strict, validate(schemas.forgotPassword), async (req, res) => {
  res.json(await authService.forgotPassword(req.valid.body.email));
});

// A fresh custom token for the signed-in user, so clients that only hold an ID/refresh token can reopen
// their read-only Firestore listeners after a page reload
router.get('/firebase-token', authenticate, async (req, res) => {
  res.json({ customToken: await authService.firebaseToken(req.user) });
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
