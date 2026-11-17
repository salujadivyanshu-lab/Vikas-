const { pool } = require('../config/database');

async function listParties(asOfDate) {
  const dateValue = asOfDate && /^\d{4}-\d{2}-\d{2}$/.test(asOfDate) ? asOfDate : null;

  const result = await pool.query(
    `SELECT id,
            firm_name AS "firmName",
            contact_person AS "contactPerson",
            mobile,
            phone,
            email,
            city,
            address,
            role,
            opening_balance AS "openingBalance",
            balance_type AS "balanceType",
            CASE
              WHEN $1::date IS NULL THEN current_brokerage_due
              ELSE (
                opening_balance +
                COALESCE((SELECT SUM(di.seller_brokerage_amount)
                         FROM trade_deals d
                         JOIN deal_items di ON di.deal_id = d.id
                         WHERE d.seller_id = parties.id AND d.deal_date <= $1::date), 0) +
                COALESCE((SELECT SUM(di.buyer_brokerage_amount)
                         FROM trade_deals d
                         JOIN deal_items di ON di.deal_id = d.id
                         WHERE d.buyer_id = parties.id AND d.deal_date <= $1::date), 0) -
                COALESCE((SELECT SUM(r.amount - r.discount)
                         FROM payment_receipts r
                         WHERE r.party_id = parties.id AND r.payment_date <= $1::date), 0)
              )
            END AS "currentDue",
            TO_CHAR(created_at, 'YYYY-MM-DD') AS "createdAt"
     FROM parties
     ORDER BY firm_name ASC`,
    [dateValue],
  );

  return result.rows;
}

async function createParty(party) {
  const result = await pool.query(
    `INSERT INTO parties (
       firm_name, contact_person, mobile, phone, email, city, address, role,
       opening_balance, balance_type, current_brokerage_due
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $9)
     RETURNING id, firm_name AS "firmName", contact_person AS "contactPerson",
       mobile, phone, email, city, address, role, opening_balance AS "openingBalance",
       balance_type AS "balanceType", current_brokerage_due AS "currentDue",
       TO_CHAR(created_at, 'YYYY-MM-DD') AS "createdAt"`,
    [party.firmName, party.contactPerson, party.mobile, party.phone, party.email,
      party.city, party.address, party.role, party.openingBalance, party.balanceType],
  );
  return result.rows[0];
}

async function updateParty(id, party) {
  const result = await pool.query(
    `UPDATE parties
     SET firm_name = $2, contact_person = $3, mobile = $4, phone = $5,
         email = $6, city = $7, address = $8, role = $9,
       current_brokerage_due = GREATEST(0, current_brokerage_due - opening_balance + $10),
       opening_balance = $10, balance_type = $11, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id, firm_name AS "firmName", contact_person AS "contactPerson",
       mobile, phone, email, city, address, role, opening_balance AS "openingBalance",
       balance_type AS "balanceType", current_brokerage_due AS "currentDue",
       TO_CHAR(created_at, 'YYYY-MM-DD') AS "createdAt"`,
    [id, party.firmName, party.contactPerson, party.mobile, party.phone, party.email,
      party.city, party.address, party.role, party.openingBalance, party.balanceType],
  );
  return result.rows[0] || null;
}

async function deleteParty(id) {
  const result = await pool.query(
    `DELETE FROM parties WHERE id = $1 AND current_brokerage_due = 0 RETURNING id`,
    [id],
  );
  if (result.rowCount) return { deleted: true };

  const existing = await pool.query(
    `SELECT current_brokerage_due AS "currentDue" FROM parties WHERE id = $1`,
    [id],
  );
  if (!existing.rowCount) return { deleted: false, notFound: true };
  return { deleted: false, currentDue: existing.rows[0].currentDue };
}

module.exports = { listParties, createParty, updateParty, deleteParty };