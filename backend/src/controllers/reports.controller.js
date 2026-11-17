const reportsRepository = require('../repositories/reports.repository');

function readDateRange(req, next) {
  const from = req.query.from ? String(req.query.from) : '';
  const to = req.query.to ? String(req.query.to) : '';
  const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

  if ((from && !isDate(from)) || (to && !isDate(to)) || (from && to && from > to)) {
    const error = new Error('Report date range is invalid.');
    error.statusCode = 400;
    next(error);
    return null;
  }
  return { from, to };
}

async function listDeals(req, res, next) {
  const range = readDateRange(req, next);
  if (!range) return;
  try {
    const sellerId = req.query.sellerId ? Number(req.query.sellerId) : null;
    const buyerId = req.query.buyerId ? Number(req.query.buyerId) : null;
    res.json(await reportsRepository.listDeals(range.from, range.to, sellerId, buyerId));
  } catch (error) {
    next(error);
  }
}

async function listReceipts(req, res, next) {
  const range = readDateRange(req, next);
  if (!range) return;
  try {
    const sellerId = req.query.sellerId ? Number(req.query.sellerId) : null;
    const buyerId = req.query.buyerId ? Number(req.query.buyerId) : null;
    res.json(await reportsRepository.listReceipts(range.from, range.to, sellerId, buyerId));
  } catch (error) {
    next(error);
  }
}

module.exports = { listDeals, listReceipts };