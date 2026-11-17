const assert = require('node:assert/strict');
const test = require('node:test');
const { validateDeal, resolveNextDealNo } = require('../src/services/deals.service');

const validDeal = {
  dealNo: '5021',
  dealDate: '2026-10-05',
  item: 'POHA REGULAR',
  unit: 'TON',
  quantity: 25,
  rate: 2550,
  seller: { id: 1, rate: 120 },
  buyer: { id: 2, rate: 100 },
};

test('validates and calculates persisted deal amounts', () => {
  assert.deepEqual(validateDeal(validDeal), {
    dealNo: '5021',
    dealDate: '2026-10-05',
    item: 'POHA REGULAR',
    unit: 'TON',
    quantity: 25,
    rate: 2550,
    sellerRate: 120,
    buyerRate: 100,
    sellerId: 1,
    buyerId: 2,
    truckNo: '',
    remarks: '',
    goodsAmount: 63750,
    sellerAmount: 3000,
    buyerAmount: 2500,
  });
});

test('rejects non-positive quantities with a client error', () => {
  assert.throws(
    () => validateDeal({ ...validDeal, quantity: 0 }),
    { statusCode: 400, message: 'Invalid deal details or party IDs.' },
  );
});

test('rejects missing party identifiers', () => {
  assert.throws(
    () => validateDeal({ ...validDeal, seller: { rate: 120 } }),
    { statusCode: 400 },
  );
});

test('accepts motor numbers from 0 to 100 and rejects values outside that range', () => {
  assert.equal(validateDeal({ ...validDeal, truckNo: '0' }).truckNo, '0');
  assert.equal(validateDeal({ ...validDeal, truckNo: '100' }).truckNo, '100');
  for (const truckNo of ['-1', '101', '1.5', 'motor']) {
    assert.throws(() => validateDeal({ ...validDeal, truckNo }), { statusCode: 400 });
  }
});

test('increments the next deal number from the latest sauda number', () => {
  assert.equal(resolveNextDealNo('5021'), '5022');
  assert.equal(resolveNextDealNo('0009'), '0010');
  assert.equal(resolveNextDealNo(null), '5001');
});
