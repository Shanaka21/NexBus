const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { AppError } = require('../utils/errors');
const notify = require('../services/notify.service');

router.use(authenticate);

router.get('/me', async (req, res) => {
  res.json(await notify.listForUser(req.user.uid));
});

router.patch('/read-all', async (req, res) => {
  res.json({ updated: await notify.markAllRead(req.user.uid) });
});

router.patch('/:id/read', async (req, res) => {
  if (!(await notify.markRead(req.user.uid, req.params.id))) {
    throw new AppError(404, 'NOT_FOUND', 'Notification not found');
  }
  res.json({ message: 'Marked as read' });
});

module.exports = router;
