const { Pool } = require('pg');
const { database } = require('./env');

const pool = new Pool(database);

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

module.exports = { pool };