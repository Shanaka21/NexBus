const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { strict } = require('../middleware/rateLimit');
const schemas = require('../schemas');
const wallet = require('../services/wallet.service');
const payment = require('../services/payment.service');
const audit = require('../services/audit.service');

router.use(authenticate, authorize('passenger'));

router.get('/', async (req, res) => {
  res.json(await wallet.getWallet(req.user));
});

// Returns the PayHere payment object for the top-up; the balance only changes when PayHere's notification arrives
router.post('/topup', strict, validate(schemas.walletTopup), async (req, res) => {
  const paymentObject = await payment.createTopupCheckout(req.user, req.valid.body.amount);
  await audit.log({ userId: req.user.uid, action: 'WALLET_TOPUP_CHECKOUT', entity: 'payments', entityId: paymentObject.order_id });
  res.json(paymentObject);
});

router.post('/pay', strict, validate(schemas.walletPay), async (req, res) => {
  res.json(await wallet.payBooking(req.user, req.valid.body.booking_id));
});

module.exports = router;
