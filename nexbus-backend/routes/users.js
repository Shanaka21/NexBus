const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { AppError } = require('../utils/errors');
const schemas = require('../schemas');
const userService = require('../services/user.service');

router.use(authenticate);

router.get('/me', async (req, res) => {
  let profile;
  try {
    profile = await userService.getProfile(req.user.uid);
  } catch (err) {
    if (!(err instanceof AppError) || err.code !== 'USER_NOT_FOUND') throw err;
    profile = await userService.ensurePassengerProfile(req.user); // first sign-in with Google
  }
  res.json({ ...profile, role: req.user.role });
});

router.patch('/me', validate(schemas.profilePatch), async (req, res) => {
  const patch = { ...req.valid.body };
  if (patch.name && !patch.full_name) patch.full_name = patch.name;
  res.json(await userService.updateProfile(req.user.uid, patch));
});

module.exports = router;
