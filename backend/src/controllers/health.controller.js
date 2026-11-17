const { pool } = require('../config/database');

async function getHealth(_req, res, next) {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getHealth };