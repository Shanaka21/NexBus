const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');
const schemas = require('../schemas');
const admin = require('../services/admin.service');

router.use(authenticate, authorize('admin'));

router.get('/operators', async (req, res) => res.json(await admin.listOperators()));

router.post('/operators', validate(schemas.operatorCompany), async (req, res) => {
  res.status(201).json(await admin.createOperator(req.user, req.valid.body));
});

router.get('/users', validate(schemas.usersQuery, 'query'), async (req, res) => {
  res.json(await admin.listUsers(req.valid.query));
});

router.post('/users', validate(schemas.adminUser), async (req, res) => {
  res.status(201).json(await admin.createUser(req.user, req.valid.body));
});

router.patch('/users/:id/status', validate(schemas.userStatus), async (req, res) => {
  res.json(await admin.setUserStatus(req.user, req.params.id, req.valid.body.status));
});

router.get('/logs', validate(schemas.logsQuery, 'query'), async (req, res) => {
  res.json(await admin.searchLogs(req.valid.query));
});

module.exports = router;
