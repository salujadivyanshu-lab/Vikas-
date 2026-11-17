const { pool } = require('../config/database');

async function getLatestDealNumber() {
  const result = await pool.query(
    `SELECT COALESCE(MAX(CAST(regexp_replace(deal_no, '\\D', '', 'g') AS BIGINT)), 5000) AS "latestDealNumber"
     FROM trade_deals`,
  );

  return result.rows[0]?.latestDealNumber ?? 5000;
}

async function createDeal(deal) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const itemResult = await client.query(
      `INSERT INTO items (name, item_name, default_unit)
        VALUES ($1, $2, $3)
       ON CONFLICT (name) DO UPDATE SET item_name = EXCLUDED.item_name
       RETURNING id`,
            [deal.item, deal.item, deal.unit],
    );
    const dealResult = await client.query(
      `INSERT INTO trade_deals
         (deal_no, deal_date, seller_id, buyer_id, truck_motor_no, remarks, total_goods_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [deal.dealNo, deal.dealDate, deal.sellerId, deal.buyerId, deal.truckNo, deal.remarks, deal.goodsAmount],
    );
    const dealId = dealResult.rows[0].id;

    await client.query(
      `INSERT INTO deal_items
         (deal_id, item_id, quantity, unit, rate_per_unit, item_total_amount,
          seller_brokerage_rate, buyer_brokerage_rate, seller_brokerage_amount, buyer_brokerage_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [dealId, itemResult.rows[0].id, deal.quantity, deal.unit, deal.rate, deal.goodsAmount,
        deal.sellerRate, deal.buyerRate, deal.sellerAmount, deal.buyerAmount],
    );
    await client.query(
      `INSERT INTO brokerage_bills (bill_no, deal_id, party_id, party_role, total_brokerage, balance_amount)
       VALUES ($1, $2, $3, 'SELLER', $4, $4), ($5, $2, $6, 'BUYER', $7, $7)`,
      [`BILL-S-${deal.dealNo}`, dealId, deal.sellerId, deal.sellerAmount,
        `BILL-B-${deal.dealNo}`, deal.buyerId, deal.buyerAmount],
    );
    await client.query(
      `UPDATE parties
       SET current_brokerage_due = current_brokerage_due
         + CASE WHEN id = $1 THEN $2 ELSE 0 END
         + CASE WHEN id = $3 THEN $4 ELSE 0 END
       WHERE id IN ($1, $3)`,
      [deal.sellerId, deal.sellerAmount, deal.buyerId, deal.buyerAmount],
    );

    await client.query('COMMIT');
    return dealId;
  } catch (error) {
    await client.query('ROLLBACK').catch((rollbackError) => {
      console.error('Deal transaction rollback failed:', rollbackError);
    });
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { createDeal, getLatestDealNumber };