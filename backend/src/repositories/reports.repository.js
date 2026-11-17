const { pool } = require('../config/database');

async function listDeals(fromDate, toDate, sellerId, buyerId) {
  const result = await pool.query(
    `SELECT d.id,
            d.deal_no AS "dealNo",
            d.deal_date::text AS "dealDate",
            seller.firm_name AS "sellerName",
            buyer.firm_name AS "buyerName",
            d.truck_motor_no AS motor,
            i.name AS "itemName",
            di.quantity,
            di.unit,
            di.rate_per_unit AS rate,
            di.item_total_amount AS "goodsAmount",
            di.seller_brokerage_amount AS "sellerBrokerage",
            di.buyer_brokerage_amount AS "buyerBrokerage",
            di.seller_brokerage_rate AS "sellerBrokerageRate",
            di.buyer_brokerage_rate AS "buyerBrokerageRate"
     FROM trade_deals d
     JOIN parties seller ON seller.id = d.seller_id
     JOIN parties buyer ON buyer.id = d.buyer_id
     JOIN deal_items di ON di.deal_id = d.id
     JOIN items i ON i.id = di.item_id
     WHERE ($1::date IS NULL OR d.deal_date >= $1::date)
       AND ($2::date IS NULL OR d.deal_date <= $2::date)
       AND ($3::bigint IS NULL OR d.seller_id = $3::bigint)
       AND ($4::bigint IS NULL OR d.buyer_id = $4::bigint)
     ORDER BY d.deal_date DESC, d.id DESC`,
    [fromDate || null, toDate || null, sellerId ? Number(sellerId) : null, buyerId ? Number(buyerId) : null],
  );
  return result.rows;
}

async function listReceipts(fromDate, toDate, sellerId, buyerId) {
  const result = await pool.query(
    `SELECT r.id,
            r.receipt_no AS "receiptNo",
            r.payment_date::text AS "paymentDate",
            p.firm_name AS "firmName",
            r.amount,
            r.discount,
            r.payment_mode AS "paymentMode",
            r.reference_no AS "referenceNo",
            r.remarks
     FROM payment_receipts r
     JOIN parties p ON p.id = r.party_id
     WHERE ($1::date IS NULL OR r.payment_date >= $1::date)
       AND ($2::date IS NULL OR r.payment_date <= $2::date)
       AND ($3::bigint IS NULL OR r.party_id = $3::bigint)
       AND ($4::bigint IS NULL OR r.party_id = $4::bigint)
     ORDER BY r.payment_date DESC, r.id DESC`,
    [fromDate || null, toDate || null, sellerId ? Number(sellerId) : null, buyerId ? Number(buyerId) : null],
  );
  return result.rows;
}

module.exports = { listDeals, listReceipts };