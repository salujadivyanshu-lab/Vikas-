const receiptsRepository = require('../repositories/receipts.repository');
const { HttpError } = require('../errors/http-error');

const paymentModes = new Set(['CASH', 'NEFT_RTGS', 'UPI', 'CHEQUE']);

function validateReceipt(input) {
  const receipt = {
    receiptNo: String(input?.receiptNo || '').trim(),
    partyId: Number(input?.partyId),
    paymentDate: String(input?.paymentDate || ''),
    amount: Number(input?.amount),
    discount: Number(input?.discount || 0),
    paymentMode: input?.paymentMode,
    referenceNo: String(input?.referenceNo || '').trim(),
    remarks: String(input?.remarks || '').trim(),
  };

  const date = new Date(`${receipt.paymentDate}T00:00:00Z`);
  if (
    !receipt.receiptNo ||
    !Number.isSafeInteger(receipt.partyId) || receipt.partyId < 1 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(receipt.paymentDate) || Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== receipt.paymentDate ||
    !Number.isFinite(receipt.amount) || receipt.amount <= 0 ||
    !Number.isFinite(receipt.discount) || receipt.discount < 0 ||
    !paymentModes.has(receipt.paymentMode)
  ) {
    throw new HttpError(400, 'Invalid receipt details.');
  }

  receipt.amount = Number(receipt.amount.toFixed(2));
  receipt.discount = Number(receipt.discount.toFixed(2));
  return receipt;
}

async function listReceipts() {
  return receiptsRepository.listReceipts();
}

async function createReceipt(input) {
  const receipt = validateReceipt(input);
  try {
    return await receiptsRepository.createReceipt(receipt);
  } catch (error) {
    if (error.code === '23505') throw new HttpError(409, 'Receipt number already exists.');
    if (error.code === '23503') throw new HttpError(400, 'Party was not found.');
    throw error;
  }
}

module.exports = { listReceipts, createReceipt, validateReceipt };