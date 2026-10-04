const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');
const schemas = require('../schemas');
const routeService = require('../services/route.service');
const audit = require('../services/audit.service');

router.use(authenticate);

router.get('/', async (req, res) => {
  const routes = await routeService.allRoutes();
  res.json(await Promise.all(routes.map(routeService.withStops)));
});

router.get('/:id', async (req, res) => {
  res.json(await routeService.withStops(await routeService.getRoute(req.params.id)));
});

router.post('/', authorize('operator', 'admin'), validate(schemas.route), async (req, res) => {
  const route = await routeService.createRoute(req.valid.body);
  await audit.log({ userId: req.user.uid, action: 'ROUTE_CREATED', entity: 'routes', entityId: route.id });
  res.status(201).json({ message: 'Route created', ...(await routeService.withStops(route)) });
});

router.put('/:id', authorize('operator', 'admin'), validate(schemas.routeUpdate), async (req, res) => {
  const route = await routeService.updateRoute(req.params.id, req.valid.body);
  await audit.log({ userId: req.user.uid, action: 'ROUTE_UPDATED', entity: 'routes', entityId: req.params.id });
  res.json({ message: 'Route updated', ...(await routeService.withStops(route)) });
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  await routeService.deactivateRoute(req.params.id);
  await audit.log({ userId: req.user.uid, action: 'ROUTE_DEACTIVATED', entity: 'routes', entityId: req.params.id });
  res.json({ message: 'Route deactivated' });
});

module.exports = router;
