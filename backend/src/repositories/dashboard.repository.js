const { pool } = require('../config/database');

async function listPartyDues(fromDate = null, toDate = null) {
  const result = await pool.query(
    `SELECT p.id,
            p.firm_name AS "firmName",
            p.contact_person AS "contactPerson",
            p.mobile,
            p.city,
            p.role,
            p.current_brokerage_due AS "netDue",
            (SELECT COUNT(DISTINCT d.id)::integer
             FROM trade_deals d
             WHERE (d.seller_id = p.id OR d.buyer_id = p.id)
               AND ($1::date IS NULL OR d.deal_date >= $1::date)
               AND ($2::date IS NULL OR d.deal_date <= $2::date)) AS "totalDeals",
            COALESCE((SELECT SUM(b.total_brokerage)
                      FROM brokerage_bills b
                      JOIN trade_deals d ON d.id = b.deal_id
                      WHERE b.party_id = p.id AND b.status <> 'CANCELLED'
                        AND ($1::date IS NULL OR d.deal_date >= $1::date)
                        AND ($2::date IS NULL OR d.deal_date <= $2::date)), 0) AS "totalBilled",
            COALESCE((SELECT SUM(r.amount - r.discount)
                      FROM payment_receipts r
                      WHERE r.party_id = p.id
                        AND ($1::date IS NULL OR r.payment_date >= $1::date)
                        AND ($2::date IS NULL OR r.payment_date <= $2::date)), 0) AS "totalReceived",
            COALESCE((SELECT GREATEST(0, CURRENT_DATE - COALESCE(MIN(b.created_at::date), p.created_at::date))
                      FROM brokerage_bills b
                      WHERE b.party_id = p.id
                        AND b.balance_amount > 0
                        AND b.status <> 'CANCELLED'), 0)::integer AS "oldestUnpaidDays",
            (SELECT MAX(r.payment_date)::text
             FROM payment_receipts r
             WHERE r.party_id = p.id) AS "lastPaymentDate",
            NULL::numeric AS "pendingGoodsValue"
     FROM parties p
     ORDER BY p.current_brokerage_due DESC, p.firm_name ASC`,
    [fromDate, toDate],
  );
  return result.rows;
}

module.exports = { listPartyDues };