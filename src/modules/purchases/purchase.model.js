const pool = require("../../config/db");

const TABLE = "purchases";
const ITEMS_TABLE = "purchase_items";

const LIST_SELECT = `
  SELECT
    p.*, (p.payable - COALESCE((SELECT SUM(total_amount) FROM purchase_returns WHERE purchase_id = p.id),0)) AS net_payable,
    s.supplier_name,
    b.name AS business_unit_name,
    GROUP_CONCAT(DISTINCT i.item_name ORDER BY i.item_name SEPARATOR ', ') AS item_names
  FROM purchases p
  LEFT JOIN suppliers s ON s.id = p.supplier_id
  LEFT JOIN business_units b ON b.id = p.business_unit_id
  LEFT JOIN purchase_items pi2 ON pi2.purchase_id = p.id
  LEFT JOIN item_details i ON i.id = pi2.item_id
`;

const findAll = async ({
  limit,
  offset,
  search,
  supplier_id,
  payment_status,
  order_status,
  item_id,
  from_date,
  to_date,
}) => {
  const where = [];
  const params = [];

  if (search) {
    where.push("(p.invoice_no LIKE ? OR s.supplier_name LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (supplier_id) {
    where.push("p.supplier_id = ?");
    params.push(supplier_id);
  }
  if (payment_status) {
    where.push("p.payment_status = ?");
    params.push(payment_status);
  }
  if (order_status) {
    where.push("p.order_status = ?");
    params.push(order_status);
  }
  if (item_id) {
    where.push("pi.item_id = ?");
    params.push(item_id);
  }
  if (from_date) {
    where.push("p.created_at >= ?");
    params.push(`${from_date} 00:00:00`);
  }
  if (to_date) {
    where.push("p.created_at <= ?");
    params.push(`${to_date} 23:59:59`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Only join purchase_items when filtering by item_id — keeps the common
  // (no item filter) query cheap and avoids needing DISTINCT there.
  const itemJoinSql = item_id ? `INNER JOIN ${ITEMS_TABLE} pi ON pi.purchase_id = p.id` : "";
  const selectCols = `SELECT p.*, (p.payable - COALESCE((SELECT SUM(total_amount) FROM purchase_returns WHERE purchase_id = p.id),0)) AS net_payable, s.supplier_name, b.name AS business_unit_name,
  GROUP_CONCAT(DISTINCT i.item_name ORDER BY i.item_name SEPARATOR ', ') AS item_names`;

const [rows] = await pool.query(
  `${selectCols}
   FROM ${TABLE} p
   LEFT JOIN suppliers s ON s.id = p.supplier_id
   LEFT JOIN business_units b ON b.id = p.business_unit_id
   LEFT JOIN purchase_items pi2 ON pi2.purchase_id = p.id
   LEFT JOIN item_details i ON i.id = pi2.item_id
   ${itemJoinSql}
   ${whereSql}
   GROUP BY p.id
   ORDER BY p.id DESC
   LIMIT ? OFFSET ?`,
  [...params, limit, offset]
);

  const [countRows] = await pool.query(
    `SELECT COUNT(DISTINCT p.id) AS total
     FROM ${TABLE} p
     LEFT JOIN suppliers s ON s.id = p.supplier_id
     ${itemJoinSql}
     ${whereSql}`,
    params
  );

  return { rows, total: countRows[0].total };
};

const findById = async (id) => {
  const [rows] = await pool.query(`${LIST_SELECT} WHERE p.id = ? GROUP BY p.id`, [id]);
  return rows[0] || null;
};

const findItemsByPurchaseId = async (purchaseId) => {
  const [rows] = await pool.query(
    `SELECT pi.*, i.item_name, i.label_barcode
     FROM ${ITEMS_TABLE} pi
     LEFT JOIN item_details i ON i.id = pi.item_id
     WHERE pi.purchase_id = ?
     ORDER BY pi.id ASC`,
    [purchaseId]
  );
  return rows;
};

// Creates the purchase header + all line items inside one DB transaction.
const createWithItems = async ({ header, items }) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO purchases
      (supplier_id, business_unit_id, invoice_no, notes, discount_amount, sub_total, payable, paid, payment_status, order_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        header.supplier_id, header.business_unit_id, header.invoice_no, header.notes,
        header.discount_amount, header.sub_total, header.payable, header.paid,
        header.payment_status, header.order_status,
      ]
    );
    const purchaseId = result.insertId;

    for (const item of items) {
      await conn.query(
        `INSERT INTO purchase_items (purchase_id, item_id, purchase_price, sale_price, qty, total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [purchaseId, item.item_id, item.purchase_price, item.sale_price, item.qty, item.total]
      );
    }

    // NEW: record upfront payment on the supplier ledger
    if (header.paid > 0) {
      await conn.query(
        `INSERT INTO supplier_payments (supplier_id, purchase_id, amount, payment_date)
         VALUES (?, ?, ?, NOW())`,
        [header.supplier_id, purchaseId, header.paid]
      );
    }

    const grnNo = `GRN-${purchaseId}`;
    await conn.query(
      `INSERT INTO goods_receipts (purchase_id, business_unit_id, grn_no, grn_date, status, remarks)
       VALUES (?, ?, ?, CURDATE(), 'pending', NULL)`,
      [purchaseId, header.business_unit_id, grnNo]
    );

    await conn.commit();
    return purchaseId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const ApiError = require('../../utils/api-error');
async function lockEditable(conn, id, structural = false) {
  const [[row]] = await conn.query('SELECT * FROM purchases WHERE id = ? FOR UPDATE', [id]);
  if (!row) throw new ApiError(404, 'Purchase not found');
  const [[usage]] = await conn.query(
    'SELECT (SELECT COUNT(*) FROM goods_receipt_items gri JOIN goods_receipts gr ON gr.id = gri.grn_id WHERE gr.purchase_id = ?) AS receipts, (SELECT COUNT(*) FROM supplier_payments WHERE purchase_id = ?) AS payments, (SELECT COUNT(*) FROM purchase_returns WHERE purchase_id = ?) AS returns_count', [id, id, id]);
  if (structural && (Number(usage.receipts) || Number(usage.payments) || Number(usage.returns_count) || row.order_status !== 'pending')) throw new ApiError(409, 'Posted receipts/payments prevent structural purchase edits or deletion');
  return row;
}
const updateHeader = async (id, data) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await lockEditable(conn, id, data.supplier_id !== undefined || data.business_unit_id !== undefined);
    const fields = ['supplier_id', 'business_unit_id', 'invoice_no', 'notes'].filter(key => data[key] !== undefined);
    if (fields.length) await conn.query('UPDATE purchases SET ' + fields.map(key => key + ' = ?').join(', ') + ' WHERE id = ?', [...fields.map(key => data[key]), id]);
    if (data.business_unit_id !== undefined) await conn.query('UPDATE goods_receipts SET business_unit_id = ? WHERE purchase_id = ?', [data.business_unit_id, id]);
    await conn.commit();
  } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }
};
const remove = async (id) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await lockEditable(conn, id, true);
    await conn.query('DELETE FROM goods_receipts WHERE purchase_id = ?', [id]);
    await conn.query('DELETE FROM purchase_items WHERE purchase_id = ?', [id]);
    const [result] = await conn.query('DELETE FROM purchases WHERE id = ?', [id]);
    await conn.commit();
    return result.affectedRows > 0;
  } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }
};

module.exports = {
  findAll,
  findById,
  findItemsByPurchaseId,
  createWithItems,
  updateHeader,
  remove,
};
