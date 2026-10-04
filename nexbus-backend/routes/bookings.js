const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { strict } = require('../middleware/rateLimit');
const schemas = require('../schemas');
const bookingService = require('../services/booking.service');

router.use(authenticate);

router.post('/', strict, authorize('passenger'), validate(schemas.booking), async (req, res) => {
  res.status(201).json({ message: 'Booking created', ...(await bookingService.createBooking(req.user, req.valid.body)) });
});

// Own bookings. "/" is the older path, "/me" the documented one.
const listMine = async (req, res) => res.json(await bookingService.listMine(req.user));
router.get('/', authorize('passenger'), listMine);
router.get('/me', authorize('passenger'), listMine);

router.get('/:id', authorize('passenger', 'operator'), async (req, res) => {
  res.json(await bookingService.getBooking(req.user, req.params.id));
});

const cancel = async (req, res) => res.json(await bookingService.cancelBooking(req.user, req.params.id));
router.patch('/:id/cancel', authorize('passenger'), cancel);
router.put('/:id/cancel', authorize('passenger'), cancel); // older clients

module.exports = router;
