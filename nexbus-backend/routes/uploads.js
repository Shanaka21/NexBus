const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../schemas');
const { upload } = require('../middleware/rateLimit');
const imageBody = require('../middleware/imageBody');
const uploads = require('../services/upload.service');

router.use(authenticate);

// Generic image upload for the apps (any signed-in user). Body: { image: "<base64 or data URL>" }
router.post('/image', upload, imageBody, validate(schemas.imageUpload), async (req, res) => {
  const { url, key } = await uploads.uploadImage({ base64: req.valid.body.image });
  res.status(201).json({ url, key });
});

module.exports = router;
