const { pool } = require('../config/database');
const { HttpError } = require('../errors/http-error');

async function listReceipts() {
  const result = await pool.query(
    `SELECT r.id,
            r.receipt_no AS "receiptNo",
            r.party_id AS "partyId",
            p.firm_name AS "firmName",
            r.payment_date AS "paymentDate",
            r.amount,
            r.discount,
            r.payment_mode AS "paymentMode",
            r.reference_no AS "referenceNo",
            r.remarks,
            r.created_at AS "createdAt"
     FROM payment_receipts r
     JOIN parties p ON p.id = r.party_id
     ORDER BY r.payment_date DESC, r.id DESC
     LIMIT 100`,
  );
  return result.rows;
}

async function createReceipt(receipt) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const partyResult = await client.query(
      `SELECT current_brokerage_due AS "currentDue"
       FROM parties WHERE id = $1 FOR UPDATE`,
      [receipt.partyId],
    );
    if (!partyResult.rowCount) throw new HttpError(404, 'Party was not found.');

    const currentDue = Number(partyResult.rows[0].currentDue);
    const settlement = receipt.amount + receipt.discount;
    if (settlement > currentDue + 0.005) {
      throw new HttpError(409, 'Payment and discount cannot exceed the party\'s current due.');
    }

    const billsResult = await client.query(
      `SELECT id, balance_amount AS "balanceAmount", paid_amount AS "paidAmount"
       FROM brokerage_bills
       WHERE party_id = $1 AND balance_amount > 0 AND status <> 'CANCELLED'
       ORDER BY created_at ASC, id ASC
       FOR UPDATE`,
      [receipt.partyId],
    );

    let cashRemaining = receipt.amount;
    let discountRemaining = receipt.discount;
    for (const bill of billsResult.rows) {
      const balance = Number(bill.balanceAmount);
      const cashApplied = Math.min(balance, cashRemaining);
      cashRemaining = Math.max(0, cashRemaining - cashApplied);
      const discountApplied = Math.min(balance - cashApplied, discountRemaining);
      discountRemaining = Math.max(0, discountRemaining - discountApplied);
      const newBalance = Math.max(0, balance - cashApplied - discountApplied);
      const newPaidAmount = Number(bill.paidAmount) + cashApplied;
      const status = newBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';

      if (cashApplied || discountApplied) {
        await client.query(
          `UPDATE brokerage_bills
           SET paid_amount = $2, balance_amount = $3, status = $4
           WHERE id = $1`,
          [bill.id, newPaidAmount, newBalance, status],
        );
      }
      if (!cashRemaining && !discountRemaining) break;
    }

    const receiptResult = await client.query(
      `INSERT INTO payment_receipts
         (receipt_no, party_id, payment_date, amount, discount, payment_mode, reference_no, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, receipt_no AS "receiptNo", party_id AS "partyId",
         payment_date AS "paymentDate", amount, discount,
         payment_mode AS "paymentMode", reference_no AS "referenceNo", remarks`,
      [receipt.receiptNo, receipt.partyId, receipt.paymentDate, receipt.amount,
        receipt.discount, receipt.paymentMode, receipt.referenceNo, receipt.remarks],
    );

    const updatedParty = await client.query(
      `UPDATE parties
       SET current_brokerage_due = GREATEST(0, current_brokerage_due - $2)
       WHERE id = $1
       RETURNING current_brokerage_due AS "currentDue"`,
      [receipt.partyId, settlement],
    );

    await client.query('COMMIT');
    return { ...receiptResult.rows[0], currentDue: updatedParty.rows[0].currentDue };
  } catch (error) {
    await client.query('ROLLBACK').catch((rollbackError) => {
      console.error('Receipt transaction rollback failed:', rollbackError);
    });
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { listReceipts, createReceipt };