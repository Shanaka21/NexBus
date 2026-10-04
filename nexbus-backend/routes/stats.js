const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const stats = require('../services/stats.service');

router.get('/', authenticate, authorize('operator', 'admin'), async (req, res) => {
  res.json(await stats.overview(req.user));
});

module.exports = router;
