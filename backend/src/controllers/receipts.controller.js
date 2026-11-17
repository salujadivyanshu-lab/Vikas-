const receiptsService = require('../services/receipts.service');

async function listReceipts(_req, res, next) {
  try {
    res.json(await receiptsService.listReceipts());
  } catch (error) {
    next(error);
  }
}

async function createReceipt(req, res, next) {
  try {
    res.status(201).json(await receiptsService.createReceipt(req.body));
  } catch (error) {
    next(error);
  }
}

module.exports = { listReceipts, createReceipt };