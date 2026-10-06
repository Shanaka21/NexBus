const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { strict } = require('../middleware/rateLimit');
const schemas = require('../schemas');
const recommend = require('../services/recommend.service');
const assistant = require('../services/assistant.service');

router.get('/', authenticate, authorize('passenger'), validate(schemas.recommendations, 'query'), async (req, res) => {
  res.json(await recommend.recommend(req.valid.query));
});

// Free-text trip question ("I want to go to Nugegoda"), understood by a language model
router.post('/ask', authenticate, strict, authorize('passenger'), validate(schemas.ask), async (req, res) => {
  res.json(await assistant.ask(req.valid.body));
});

module.exports = router;
