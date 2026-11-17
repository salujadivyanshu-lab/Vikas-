const dealsRepository = require('../repositories/deals.repository');
const { HttpError } = require('../errors/http-error');

const currency = (value) => Number(value.toFixed(2));

function resolveNextDealNo(latestDealNo) {
  const numericValue = Number(String(latestDealNo || '').replace(/\D/g, ''));
  const fallback = 5000;
  const nextNumber = Number.isFinite(numericValue) && numericValue > 0 ? numericValue + 1 : fallback + 1;
  return String(nextNumber).padStart(4, '0');
}

function validateDeal(input) {
  const quantity = Number(input?.quantity);
  const rate = Number(input?.rate);
  const sellerRate = Number(input?.seller?.rate);
  const buyerRate = Number(input?.buyer?.rate);
  const sellerId = Number(input?.seller?.id);
  const buyerId = Number(input?.buyer?.id);
  const truckNo = input?.truckNo == null || input.truckNo === '' ? '' : String(input.truckNo);
  const motorNumber = Number(truckNo);
  const invalidMotor = truckNo !== '' && (!Number.isInteger(motorNumber) || motorNumber < 0 || motorNumber > 100);

  if (
    !input?.dealNo ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.dealDate || '') ||
    !input?.item ||
    !input?.unit ||
    !Number.isFinite(quantity) || quantity <= 0 ||
    !Number.isFinite(rate) || rate < 0 ||
    !Number.isInteger(sellerId) || sellerId <= 0 ||
    !Number.isInteger(buyerId) || buyerId <= 0 ||
    !Number.isFinite(sellerRate) || sellerRate < 0 ||
    !Number.isFinite(buyerRate) || buyerRate < 0 ||
    invalidMotor
  ) {
    throw new HttpError(400, 'Invalid deal details or party IDs.');
  }

  return {
    dealNo: input.dealNo,
    dealDate: input.dealDate,
    item: input.item,
    unit: input.unit,
    quantity,
    rate,
    sellerRate,
    buyerRate,
    sellerId,
    buyerId,
    truckNo,
    remarks: input.remarks || '',
    goodsAmount: currency(quantity * rate),
    sellerAmount: currency(quantity * sellerRate),
    buyerAmount: currency(quantity * buyerRate),
  };
}

async function createDeal(input, retryCount = 0) {
  const deal = validateDeal(input);

  try {
    const dealId = await dealsRepository.createDeal(deal);
    return { success: true, dealId };
  } catch (error) {
    if (error.code === '23505' && retryCount < 3) {
      const latest = await dealsRepository.getLatestDealNumber();
      const nextDealNo = resolveNextDealNo(latest);
      return createDeal({ ...deal, dealNo: nextDealNo }, retryCount + 1);
    }
    if (error.code === '23505') {
      throw new HttpError(409, 'Deal number or bill number already exists.');
    }
    if (error.code === '23503') {
      throw new HttpError(400, 'Seller or buyer party was not found.');
    }
    throw error;
  }
}

async function getNextDealNumber() {
  const latest = await dealsRepository.getLatestDealNumber();
  return { nextDealNo: resolveNextDealNo(latest) };
}

module.exports = { createDeal, validateDeal, resolveNextDealNo, getNextDealNumber };