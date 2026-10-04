const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { strict } = require('../middleware/rateLimit');
const { AppError } = require('../utils/errors');
const schemas = require('../schemas');
const payment = require('../services/payment.service');
const audit = require('../services/audit.service');

// Called by PayHere (form data, no Firebase token). Trust comes from the md5sig, merchant, amount and currency checks.
router.post('/notify', express.urlencoded({ extended: false, limit: '10kb' }), async (req, res) => {
  const { value, error } = schemas.payhereNotify.validate(req.body, { stripUnknown: true });
  if (error) {
    await payment.rejected(req.body, 'MALFORMED');
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid payment notification');
  }
  try {
    await payment.handleNotify(value);
  } catch (err) {
    if (err instanceof AppError && ['INVALID_SIGNATURE', 'AMOUNT_MISMATCH'].includes(err.code)) {
      await payment.rejected(value, err.code);
    }
    throw err;
  }
  res.status(200).send('OK'); // 200 stops PayHere from resending
});

router.post('/checkout', authenticate, strict, authorize('passenger'), validate(schemas.checkout), async (req, res) => {
  const paymentObject = await payment.createCheckout(req.user, req.valid.body.booking_id);
  await audit.log({ userId: req.user.uid, action: 'PAYMENT_CHECKOUT', entity: 'bookings', entityId: req.valid.body.booking_id });
  res.json(paymentObject);
});

// Sandbox only (PAYHERE_SIMULATE=true): completes a payment through the real verification path
router.post('/simulate', authenticate, authorize('passenger'), validate(schemas.simulate), async (req, res) => {
  const result = await payment.simulate(req.user, req.valid.body.order_id, req.valid.body.status_code);
  res.json({ message: 'Simulated payment processed', status: result.status || 'success' });
});

module.exports = router;
