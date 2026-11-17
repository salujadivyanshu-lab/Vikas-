const { Router } = require('express');
const dealsController = require('../controllers/deals.controller');
const dashboardController = require('../controllers/dashboard.controller');
const healthController = require('../controllers/health.controller');
const itemsController = require('../controllers/items.controller');
const partiesController = require('../controllers/parties.controller');
const reportsController = require('../controllers/reports.controller');
const receiptsController = require('../controllers/receipts.controller');

const router = Router();

router.get('/health', healthController.getHealth);
router.get('/dashboard/dues', dashboardController.getDues);
router.get('/items', itemsController.listItems);
router.post('/items', itemsController.createItem);
router.get('/parties', partiesController.listParties);
router.post('/parties', partiesController.createParty);
router.put('/parties/:id', partiesController.updateParty);
router.delete('/parties/:id', partiesController.deleteParty);
router.get('/deals/next-number', dealsController.getNextDealNumber);
router.post('/deals', dealsController.createDeal);
router.get('/receipts', receiptsController.listReceipts);
router.post('/receipts', receiptsController.createReceipt);
router.get('/reports/deals', reportsController.listDeals);
router.get('/reports/receipts', reportsController.listReceipts);

module.exports = { apiRouter: router };