jest.mock('../config/firebase', () => require('./helpers/firebase'));

process.env.PAYHERE_MERCHANT_ID = '1211149';
process.env.PAYHERE_MERCHANT_SECRET = 'test-secret';
const crypto = require('crypto');
const payment = require('../services/payment.service');

const md5u = (s) => crypto.createHash('md5').update(s).digest('hex').toUpperCase();

const notification = (over = {}) => {
  const n = { merchant_id: '1211149', order_id: 'NB123-abc', payment_id: 'P1', payhere_amount: '240.00', payhere_currency: 'LKR', status_code: '2', ...over };
  n.md5sig = over.md5sig || md5u(n.merchant_id + n.order_id + n.payhere_amount + n.payhere_currency + n.status_code + md5u('test-secret'));
  return n;
};

describe('PayHere md5sig verification', () => {
  test('matches the formula in the PayHere documentation', () => {
    const n = notification();
    expect(payment.expectedSignature(n, 'test-secret')).toBe(n.md5sig);
    expect(payment.validSignature(n)).toBe(true);
  });

  test('lower-case signature is accepted', () => {
    const n = notification();
    n.md5sig = n.md5sig.toLowerCase();
    expect(payment.validSignature(n)).toBe(true);
  });

  test('rejects a modified signature (TC27)', () => {
    expect(payment.validSignature({ ...notification(), md5sig: 'A'.repeat(32) })).toBe(false);
  });

  // the signature stays the one issued for the original data
  test('rejects a changed amount', () => {
    expect(payment.validSignature({ ...notification(), payhere_amount: '1.00' })).toBe(false);
  });

  test('rejects a changed status code', () => {
    expect(payment.validSignature({ ...notification(), status_code: '-2' })).toBe(false);
  });

  test('rejects a missing signature', () => {
    const n = notification();
    delete n.md5sig;
    expect(payment.validSignature(n)).toBe(false);
  });

  test('rejects everything when no secret is configured', () => {
    expect(payment.validSignature(notification(), '')).toBe(false);
  });
});

describe('handleNotify guards', () => {
  test('wrong merchant id is rejected before any database access', async () => {
    await expect(payment.handleNotify(notification({ merchant_id: '999' }))).rejects.toMatchObject({ code: 'INVALID_SIGNATURE', status: 400 });
  });

  test('invalid signature is rejected', async () => {
    await expect(payment.handleNotify(notification({ md5sig: 'B'.repeat(32) }))).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
  });
});

describe('status mapping', () => {
  test('PayHere codes map to payment states', () => {
    expect(payment.STATUS).toMatchObject({ 2: 'success', 0: 'pending', '-1': 'canceled', '-2': 'failed' });
  });
});
