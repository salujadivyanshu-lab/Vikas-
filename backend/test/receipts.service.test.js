const assert = require('node:assert/strict');
const test = require('node:test');
const { validateReceipt } = require('../src/services/receipts.service');

const validReceipt = {
  receiptNo: 'RCP-1058',
  partyId: 8,
  paymentDate: '2026-10-05',
  amount: 1200,
  discount: 50,
  paymentMode: 'UPI',
  referenceNo: 'UTR-123',
  remarks: 'Part payment',
};

test('validates receipt fields and normalizes currency values', () => {
  assert.deepEqual(validateReceipt({ ...validReceipt, amount: '1200.456', discount: '50.127' }), {
    ...validReceipt,
    amount: 1200.46,
    discount: 50.13,
  });
});

test('rejects invalid dates and unsupported payment modes', () => {
  assert.throws(() => validateReceipt({ ...validReceipt, paymentDate: '2026-02-30' }), { statusCode: 400 });
  assert.throws(() => validateReceipt({ ...validReceipt, paymentMode: 'CARD' }), { statusCode: 400 });
});

test('rejects non-positive receipt amounts and invalid party IDs', () => {
  assert.throws(() => validateReceipt({ ...validReceipt, amount: 0 }), { statusCode: 400 });
  assert.throws(() => validateReceipt({ ...validReceipt, partyId: -1 }), { statusCode: 400 });
});