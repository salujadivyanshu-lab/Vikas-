const { pool } = require('../config/database');

async function listItems() {
  const result = await pool.query(
    `SELECT id, name, default_unit AS "defaultUnit"
     FROM items
     ORDER BY name ASC`,
  );
  return result.rows;
}

async function createItem(name, defaultUnit) {
  const result = await pool.query(
    `INSERT INTO items (name, item_name, default_unit)
      VALUES ($1, $2, $3)
     RETURNING id, name, default_unit AS "defaultUnit"`,
        [name, name, defaultUnit],
  );
  return result.rows[0];
}

module.exports = { listItems, createItem };