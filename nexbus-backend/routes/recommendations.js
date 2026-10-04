const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');
const schemas = require('../schemas');
const recommend = require('../services/recommend.service');

router.get('/', authenticate, authorize('passenger'), validate(schemas.recommendations, 'query'), async (req, res) => {
  res.json(await recommend.recommend(req.valid.query));
});

module.exports = router;
