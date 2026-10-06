const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { chat } = require('../middleware/rateLimit');
const schemas = require('../schemas');
const recommend = require('../services/recommend.service');
const assistant = require('../services/assistant.service');
const journey = require('../services/journey.service');

router.get('/', authenticate, authorize('passenger'), validate(schemas.recommendations, 'query'), async (req, res) => {
  res.json(await recommend.recommend(req.valid.query));
});

// Which buses to take between two stops: direct routes and journeys with one change, whatever is running right now
router.get('/journey', authenticate, authorize('passenger'), validate(schemas.recommendations, 'query'), async (req, res) => {
  const { from_stop_id: from, to_stop_id: to } = req.valid.query;
  const plans = await journey.plan(from, to);
  // a change is only worth showing when no single bus does the trip
  const direct = plans.filter((p) => p.type === 'direct');
  res.json({ plans: direct.length ? direct : plans });
});

// Chat with the assistant: trip questions ("I want to go to Nugegoda") get live bus answers, anything else a normal reply
router.post('/ask', authenticate, chat, authorize('passenger'), validate(schemas.ask), async (req, res) => {
  res.json(await assistant.ask(req.valid.body));
});

module.exports = router;
