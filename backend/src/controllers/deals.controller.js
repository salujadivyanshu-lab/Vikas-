const dealsService = require('../services/deals.service');

async function createDeal(req, res, next) {
  try {
    const result = await dealsService.createDeal(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function getNextDealNumber(_req, res, next) {
  try {
    const result = await dealsService.getNextDealNumber();
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = { createDeal, getNextDealNumber };