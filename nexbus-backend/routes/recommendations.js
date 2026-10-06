const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { chat } = require('../middleware/rateLimit');
const schemas = require('../schemas');
const recommend = require('../services/recommend.service');
const assistant = require('../services/assistant.service');

router.get('/', authenticate, authorize('passenger'), validate(schemas.recommendations, 'query'), async (req, res) => {
  res.json(await recommend.recommend(req.valid.query));
});

// Chat with the assistant: trip questions ("I want to go to Nugegoda") get live bus answers, anything else a normal reply
router.post('/ask', authenticate, chat, authorize('passenger'), validate(schemas.ask), async (req, res) => {
  res.json(await assistant.ask(req.valid.body));
});

module.exports = router;
