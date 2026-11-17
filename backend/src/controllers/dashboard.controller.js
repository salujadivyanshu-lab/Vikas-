const dashboardRepository = require('../repositories/dashboard.repository');

async function getDues(req, res, next) {
  const fromDate = req.query.from ? String(req.query.from) : null;
  const toDate = req.query.to ? String(req.query.to) : null;
  const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

  if ((fromDate && !isValidDate(fromDate)) || (toDate && !isValidDate(toDate)) ||
      (fromDate && toDate && fromDate > toDate)) {
    return next(Object.assign(new Error('Financial year date range is invalid.'), { statusCode: 400 }));
  }
  try {
    res.json(await dashboardRepository.listPartyDues(fromDate, toDate));
  } catch (error) {
    next(error);
  }
}

module.exports = { getDues };