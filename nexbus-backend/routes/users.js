const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { AppError } = require('../utils/errors');
const schemas = require('../schemas');
const userService = require('../services/user.service');
const uploads = require('../services/upload.service');
const { upload } = require('../middleware/rateLimit');
const imageBody = require('../middleware/imageBody');

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

// Profile photo: stored on UploadThing, the old file is removed once the new one is saved
router.put('/me/photo', upload, imageBody, validate(schemas.imageUpload), async (req, res) => {
  const photo = await uploads.uploadImage({ base64: req.valid.body.image, folder: 'avatar' });
  let saved;
  try {
    saved = await userService.setPhoto(req.user.uid, photo);
  } catch (err) {
    await uploads.deleteImage(photo.key); // do not leave an orphan file behind
    throw err;
  }
  await uploads.deleteImage(saved.previousKey);
  res.json({ ...saved.profile, role: req.user.role });
});

router.delete('/me/photo', async (req, res) => {
  const saved = await userService.setPhoto(req.user.uid, null);
  await uploads.deleteImage(saved.previousKey);
  res.json({ ...saved.profile, role: req.user.role });
});

module.exports = router;
