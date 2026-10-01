const pool = require("../../config/db");

const GRN_TABLE = "goods_receipts";
const GRN_ITEMS_TABLE = "goods_receipt_items";
const PURCHASE_ITEMS_TABLE = "purchase_items";


// Get all GRNs
const findAll = async ({
  limit,
  offset,
  status,
  purchase_id,
}) => {

  const where = [];
  const params = [];

  if (status) {
    where.push("gr.status = ?");
    params.push(status);
  }

  if (purchase_id) {
    where.push("gr.purchase_id = ?");
    params.push(purchase_id);
  }

  const whereSQL = where.length
    ? `WHERE ${where.join(" AND ")}`
    : "";


  const [rows] = await pool.query(
  `
  SELECT
    gr.*,
    p.invoice_no,
    p.sub_total,
    p.discount_amount,
    p.payable,
    p.paid,
    (p.payable - p.paid) AS balance_due,
    s.supplier_name,
    COALESCE(qty.total_ordered_qty, 0) AS total_ordered_qty,
    COALESCE(qty.total_received_qty, 0) AS total_received_qty,
    COALESCE(qty.total_ordered_qty, 0) - COALESCE(qty.total_received_qty, 0) AS total_outstanding_qty

  FROM ${GRN_TABLE} gr

  LEFT JOIN purchases p
    ON p.id = gr.purchase_id

  LEFT JOIN suppliers s
    ON s.id = p.supplier_id

  LEFT JOIN (
    SELECT
      pi.purchase_id,
      SUM(pi.qty) AS total_ordered_qty,
      SUM(COALESCE(gri.received_qty, 0)) AS total_received_qty
    FROM purchase_items pi
    LEFT JOIN goods_receipt_items gri ON gri.purchase_item_id = pi.id
    GROUP BY pi.purchase_id
  ) qty ON qty.purchase_id = gr.purchase_id

  ${whereSQL}

  ORDER BY gr.id DESC

  LIMIT ? OFFSET ?
  `,
  [...params, limit, offset]
);


  const [count] = await pool.query(
    `
    SELECT COUNT(*) total
    FROM ${GRN_TABLE} gr

    ${whereSQL}
    `,
    params
  );


  return {
    rows,
    total: count[0].total
  };
};



// Get single GRN
const findById = async (id) => {
  const [rows] = await pool.query(
    `
    SELECT
      gr.*,
      p.invoice_no,
      p.sub_total,
      p.discount_amount,
      p.payable,
      p.paid,
      (p.payable - p.paid) AS balance_due,
      s.supplier_name,
      COALESCE(qty.total_ordered_qty, 0) AS total_ordered_qty,
      COALESCE(qty.total_received_qty, 0) AS total_received_qty,
      COALESCE(qty.total_ordered_qty, 0) - COALESCE(qty.total_received_qty, 0) AS total_outstanding_qty

    FROM ${GRN_TABLE} gr

    LEFT JOIN purchases p
      ON p.id = gr.purchase_id

    LEFT JOIN suppliers s
      ON s.id = p.supplier_id

    LEFT JOIN (
      SELECT
        pi.purchase_id,
        SUM(pi.qty) AS total_ordered_qty,
        SUM(COALESCE(gri.received_qty, 0)) AS total_received_qty
      FROM purchase_items pi
      LEFT JOIN goods_receipt_items gri ON gri.purchase_item_id = pi.id
      GROUP BY pi.purchase_id
    ) qty ON qty.purchase_id = gr.purchase_id

    WHERE gr.id = ?
    `,
    [id]
  );

  return rows[0] || null;
};




// Expected items with received and outstanding qty
const findExpectedItems = async (purchaseId)=>{


  const [rows] = await pool.query(
    `
    SELECT

      pi.id AS purchase_item_id,

      pi.item_id,

      i.item_name,

      pi.purchase_price,

      pi.sale_price,

      pi.qty AS ordered_qty,


      COALESCE(
        SUM(gri.received_qty),
        0
      ) AS already_received_qty,


      (
        pi.qty -
        COALESCE(
          SUM(gri.received_qty),
          0
        )
      ) AS outstanding_qty


    FROM ${PURCHASE_ITEMS_TABLE} pi


    LEFT JOIN item_details i
      ON i.id = pi.item_id


    LEFT JOIN ${GRN_ITEMS_TABLE} gri

      ON gri.purchase_item_id = pi.id


    WHERE pi.purchase_id = ?


    GROUP BY pi.id

    HAVING outstanding_qty > 0


    ORDER BY pi.id ASC
    `,
    [purchaseId]
  );


  return rows;
};




// Items received in a particular GRN
const findReceiptItems = async(grnId)=>{


  const [rows] = await pool.query(
    `
    SELECT

      gri.*,

      i.item_name

    FROM ${GRN_ITEMS_TABLE} gri


    LEFT JOIN item_details i
      ON i.id = gri.item_id


    WHERE gri.grn_id = ?


    ORDER BY gri.id ASC

    `,
    [grnId]
  );


  return rows;

};





// Insert GRN items
const receive = async ({ grnId, purchaseId, items, remarks }) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const item of items) {
      if (item.received_qty <= 0) continue;

      // Re-check outstanding qty INSIDE the transaction with a locking read
      // to prevent concurrent over-receiving (TOCTOU fix).
      const [[purchaseItem]] = await conn.query(
        `SELECT pi.id, pi.item_id, pi.qty AS ordered_qty,
                COALESCE(SUM(gri.received_qty), 0) AS already_received_qty
         FROM purchase_items pi
         LEFT JOIN goods_receipt_items gri ON gri.purchase_item_id = pi.id
         WHERE pi.id = ?
         GROUP BY pi.id
         FOR UPDATE`,
        [item.purchase_item_id]
      );

      if (!purchaseItem) {
        throw new Error(`Purchase item ${item.purchase_item_id} not found`);
      }

      const outstanding = purchaseItem.ordered_qty - purchaseItem.already_received_qty;
      if (item.received_qty > outstanding) {
        throw new Error(
          `Received qty for item ${purchaseItem.item_id} exceeds outstanding (${outstanding})`
        );
      }

      // 1. Insert GRN item line
      await conn.query(
        `INSERT INTO ${GRN_ITEMS_TABLE}
         (grn_id, purchase_item_id, item_id, purchase_price, sale_price,
          received_qty, accepted_qty, rejected_qty, condition_note)
         SELECT ?, pi.id, pi.item_id, pi.purchase_price, pi.sale_price, ?, ?, 0, ?
         FROM purchase_items pi WHERE pi.id = ?`,
        [grnId, item.received_qty, item.received_qty, item.condition_note || null, item.purchase_item_id]
      );

      // Need business_unit_id + unit_id to post inventory
      const [[grnRow]] = await conn.query(
        `SELECT business_unit_id FROM ${GRN_TABLE} WHERE id = ? FOR UPDATE`,
        [grnId]
      );
      const [[itemRow]] = await conn.query(
        `SELECT item_unit_id FROM item_details WHERE id = ?`,
        [purchaseItem.item_id]
      );
      if (!itemRow) throw new Error(`Item ${purchaseItem.item_id} not found`);

      // 2. Increase inventory — source of truth
      await conn.query(
        `INSERT INTO inventory (business_unit_id, item_id, unit_id, quantity)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
        [grnRow.business_unit_id, purchaseItem.item_id, itemRow.item_unit_id, item.received_qty]
      );

      // 3. Insert ledger row — immutable
      await conn.query(
        `INSERT INTO item_stock (business_unit_id, item_id, type, qty, ref_type, ref_id)
         VALUES (?, ?, 'PURCHASE', ?, 'GOODS_RECEIPT', ?)`,
        [grnRow.business_unit_id, purchaseItem.item_id, item.received_qty, grnId]
      );
    }

    // Determine if fully received now, across the WHOLE purchase (not just this GRN call)
    const [[{ remainingOutstanding }]] = await conn.query(
      `SELECT COALESCE(SUM(pi.qty - COALESCE(r.received, 0)), 0) AS remainingOutstanding
       FROM purchase_items pi
       LEFT JOIN (
         SELECT purchase_item_id, SUM(received_qty) AS received
         FROM ${GRN_ITEMS_TABLE}
         GROUP BY purchase_item_id
       ) r ON r.purchase_item_id = pi.id
       WHERE pi.purchase_id = ?`,
      [purchaseId]
    );

    const grnStatus = remainingOutstanding <= 0 ? "received" : "partial";

    await conn.query(
      `UPDATE ${GRN_TABLE} SET status = ?, remarks = ? WHERE id = ?`,
      [grnStatus, remarks || null, grnId]
    );

    if (remainingOutstanding <= 0) {
      await conn.query(
        `UPDATE purchases SET order_status = 'received' WHERE id = ?`,
        [purchaseId]
      );
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};




module.exports = {

 findAll,

 findById,

 findExpectedItems,

 findReceiptItems,

 receive

};