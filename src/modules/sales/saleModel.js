const pool = require('../../config/db');

function searchWhere(search) {
  if (!search) return { clause: '', params: [] };
  return {
    clause: `WHERE si.receipt_no LIKE ? OR c.customer_name LIKE ?`,
    params: [`%${search}%`, `%${search}%`],
  };
}

function buildFilters({ search, customer_id, item_id, category_id, status, from_date, to_date }) {
  const where = [];
  const params = [];

  if (search) {
    where.push('(si.receipt_no LIKE ? OR c.customer_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (customer_id) {
    where.push('si.customer_id = ?');
    params.push(customer_id);
  }
  if (from_date) {
    where.push('si.created_at >= ?');
    params.push(`${from_date} 00:00:00`);
  }
  if (to_date) {
    where.push('si.created_at <= ?');
    params.push(`${to_date} 23:59:59`);
  }
  if (item_id) {
    where.push('sii.item_id = ?');
    params.push(item_id);
  }
  if (category_id) {
    where.push('id_.item_category_id = ?');
    params.push(category_id);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // Status is derived from paid vs payable, so it can only be filtered with
  // HAVING on the aggregated `paid` value — never in WHERE.
  let havingSql = '';
  if (status === 'unpaid') havingSql = 'HAVING COALESCE(cp.paid, 0) <= 0';
  else if (status === 'partially_paid') havingSql = 'HAVING COALESCE(cp.paid, 0) > 0 AND COALESCE(cp.paid, 0) < si.payable';
  else if (status === 'paid') havingSql = 'HAVING COALESCE(cp.paid, 0) >= si.payable';

  return { whereSql, havingSql, params };
}

async function getCustomerById(conn, id) {
  const [rows] = await conn.query('SELECT id FROM customers WHERE id = ?', [id]);
  return rows[0];
}

// Locks the rows FOR UPDATE inside the active transaction so concurrent sales
// against the same item can't both pass the stock check.
async function getItemsForUpdate(conn, itemIds) {
  if (!itemIds.length) return [];
  const [rows] = await conn.query(
    `SELECT id, item_name, sale_price, stock, item_unit_id, is_enable
     FROM item_details WHERE id IN (?) FOR UPDATE`,
    [itemIds]
  );
  return rows;
}

async function insertInvoiceHeader(conn, data) {
  const [result] = await conn.query(
    `INSERT INTO sale_invoices (customer_id, business_unit_id, description, discount, sub_total, payable, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.customer_id ?? null,
      data.business_unit_id,
      data.description ?? null,
      data.discount,
      data.sub_total,
      data.payable,
      data.status,
    ]
  );
  return result.insertId;
}

async function getBusinessUnitById(conn, id) {
  const [rows] = await conn.query('SELECT id, is_active FROM business_units WHERE id = ?', [id]);
  return rows[0];
}

// Per-location on-hand quantity for a set of items at one business unit —
// used to check "is there actually stock at THIS location", separate from
// item_details.stock (the global total across all locations).
async function getInventoryQuantities(conn, itemIds, businessUnitId) {
  if (!itemIds.length) return new Map();
  const [rows] = await conn.query(
    'SELECT item_id, quantity FROM inventory WHERE item_id IN (?) AND business_unit_id = ? FOR UPDATE',
    [itemIds, businessUnitId]
  );
  return new Map(rows.map((r) => [r.item_id, r.quantity]));
}

async function setReceiptNo(conn, id, receiptNo) {
  await conn.query('UPDATE sale_invoices SET receipt_no = ? WHERE id = ?', [receiptNo, id]);
}

async function insertInvoiceItems(conn, invoiceId, items) {
  const values = items.map((it) => [invoiceId, it.item_id, it.qty, it.unit_price, it.total_price]);
  await conn.query(
    `INSERT INTO sale_invoice_items (invoice_id, item_id, qty, unit_price, total_price) VALUES ?`,
    [values]
  );
}

// async function decrementStock(conn, itemId, qty) {
//   await conn.query('UPDATE item_details SET stock = stock - ? WHERE id = ?', [qty, itemId]);
// }

// async function incrementStock(conn, itemId, qty) {
//   await conn.query('UPDATE item_details SET stock = stock + ? WHERE id = ?', [qty, itemId]);
// }

// Same upsert used by goods-receipts, but subtracting instead of adding.
// business_unit_id is now part of the row's identity — inventory is
// per-location, not global (see migrations 011/012).
async function adjustInventory(conn, itemId, unitId, businessUnitId, deltaQty) {
  const [rows] = await conn.query(
    'SELECT id, quantity FROM inventory WHERE item_id = ? AND unit_id = ? AND business_unit_id = ? FOR UPDATE',
    [itemId, unitId, businessUnitId]
  );

  if (rows.length) {
    await conn.query('UPDATE inventory SET quantity = quantity + ? WHERE id = ?', [deltaQty, rows[0].id]);
  } else {
    // Only meaningful when adding stock back (delta > 0); a sale should never
    // hit this branch since inventory must already exist at that location to
    // be sold from.
    await conn.query(
      'INSERT INTO inventory (item_id, unit_id, business_unit_id, quantity) VALUES (?, ?, ?, ?)',
      [itemId, unitId, businessUnitId, Math.max(deltaQty, 0)]
    );
  }
}

// `paid` is derived from SUM(customer_payments.amount) for this invoice —
// NOT a stored column — so it can never drift out of sync with the actual
// payment records. `mobile` comes straight off the linked customer row.
async function findAll({ limit, offset, search, customer_id, item_id, category_id, status, from_date, to_date }) {
  const { whereSql, havingSql, params } = buildFilters({ search, customer_id, item_id, category_id, status, from_date, to_date });

  const needsItemJoin = Boolean(item_id || category_id);
  const itemJoinSql = needsItemJoin
    ? `INNER JOIN sale_invoice_items sii ON sii.invoice_id = si.id
       INNER JOIN item_details id_ ON id_.id = sii.item_id`
    : '';

  const [rows] = await pool.query(
    `SELECT ${needsItemJoin ? 'DISTINCT' : ''} si.*, c.customer_name, c.mobile_number AS mobile,
            COALESCE(cp.paid, 0) AS paid
     FROM sale_invoices si
     LEFT JOIN customers c ON c.id = si.customer_id
     LEFT JOIN (
       SELECT invoice_id, SUM(amount) AS paid
       FROM customer_payments
       GROUP BY invoice_id
     ) cp ON cp.invoice_id = si.id
     ${itemJoinSql}
     ${whereSql}
     ${havingSql}
     ORDER BY si.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

async function count({ search, customer_id, item_id, category_id, status, from_date, to_date }) {
  const { whereSql, havingSql, params } = buildFilters({ search, customer_id, item_id, category_id, status, from_date, to_date });

  const needsItemJoin = Boolean(item_id || category_id);
  const itemJoinSql = needsItemJoin
    ? `INNER JOIN sale_invoice_items sii ON sii.invoice_id = si.id
       INNER JOIN item_details id_ ON id_.id = sii.item_id`
    : '';

  // HAVING needs a GROUP BY to operate on per-invoice paid, so when status
  // filtering is active we wrap it in a subquery to count the group rows.
  const sql = havingSql
    ? `SELECT COUNT(*) AS total FROM (
         SELECT si.id
         FROM sale_invoices si
         LEFT JOIN customers c ON c.id = si.customer_id
         LEFT JOIN (
           SELECT invoice_id, SUM(amount) AS paid
           FROM customer_payments GROUP BY invoice_id
         ) cp ON cp.invoice_id = si.id
         ${itemJoinSql}
         ${whereSql}
         GROUP BY si.id
         ${havingSql}
       ) t`
    : `SELECT COUNT(DISTINCT si.id) AS total
       FROM sale_invoices si
       LEFT JOIN customers c ON c.id = si.customer_id
       ${itemJoinSql}
       ${whereSql}`;

  const [rows] = await pool.query(sql, params);
  return rows[0].total;
}


const getNextReceipt = async () => {
  const [rows] = await pool.query(`
    SELECT receipt_no
    FROM sale_invoices
    ORDER BY id DESC
    LIMIT 1
  `);

  let next = 1;

  if (rows.length) {
    const num = parseInt(rows[0].receipt_no.replace(/\D/g, "")) || 0;
    next = num + 1;
  }

  return `REC-${String(next).padStart(6, "0")}`;
};
async function findById(id) {
  const [rows] = await pool.query(
    `SELECT si.*, c.customer_name, c.mobile_number AS mobile,
            COALESCE(cp.paid, 0) AS paid
     FROM sale_invoices si
     LEFT JOIN customers c ON c.id = si.customer_id
     LEFT JOIN (
       SELECT invoice_id, SUM(amount) AS paid
       FROM customer_payments
       WHERE invoice_id = ?
       GROUP BY invoice_id
     ) cp ON cp.invoice_id = si.id
     WHERE si.id = ?`,
    [id, id]
  );
  return rows[0];
}

async function findItemsByInvoiceId(invoiceId) {
  const [rows] = await pool.query(
    `SELECT sii.*, id_.item_name
     FROM sale_invoice_items sii
     LEFT JOIN item_details id_ ON id_.id = sii.item_id
     WHERE sii.invoice_id = ?`,
    [invoiceId]
  );
  return rows;
}

async function updateHeader(id, data) {
  await pool.query(
    `UPDATE sale_invoices SET customer_id = ?, description = ?, discount = ?, sub_total = ?, payable = ?, status = ?
     WHERE id = ?`,
    [data.customer_id ?? null, data.description ?? null, data.discount, data.sub_total, data.payable, data.status, id]
  );
}

async function insertPayment(conn, data) {
  await conn.query(
    `INSERT INTO customer_payments (invoice_id, customer_id, amount, payment_date, payment_method)
     VALUES (?, ?, ?, ?, ?)`,
    [data.invoice_id, data.customer_id ?? null, data.amount, data.payment_date || new Date(), data.payment_method || "Cash"]
  );
}

async function countPayments(id) {
  const [rows] = await pool.query('SELECT COUNT(*) AS c FROM customer_payments WHERE invoice_id = ?', [id]);
  return rows[0].c;
}

async function countReturns(id) {
  const [rows] = await pool.query('SELECT COUNT(*) AS c FROM sale_returns WHERE sale_invoice_id = ?', [id]);
  return rows[0].c;
}

async function deleteInvoiceItems(conn, id) {
  await conn.query('DELETE FROM sale_invoice_items WHERE invoice_id = ?', [id]);
}

async function deleteInvoiceHeader(conn, id) {
  await conn.query('DELETE FROM sale_invoices WHERE id = ?', [id]);
}

async function insertLedgerEntry(conn, { businessUnitId, itemId, type, qty, refType, refId }) {
  await conn.query(
    `INSERT INTO item_stock (business_unit_id, item_id, type, qty, ref_type, ref_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [businessUnitId, itemId, type, qty, refType, refId]
  );
}

async function getSummary({ search, customer_id, item_id, category_id, status, from_date, to_date }) {
  const { whereSql, havingSql, params } = buildFilters({ search, customer_id, item_id, category_id, status, from_date, to_date });
  const needsItemJoin = Boolean(item_id || category_id);
  const itemJoinSql = needsItemJoin
    ? `INNER JOIN sale_invoice_items sii ON sii.invoice_id = si.id
       INNER JOIN item_details id_ ON id_.id = sii.item_id`
    : '';

  const [rows] = await pool.query(
    `SELECT
       COUNT(*) AS invoice_count,
       COALESCE(SUM(sub_total), 0) AS total_sub_total,
       COALESCE(SUM(payable), 0) AS total_payable,
       COALESCE(SUM(paid), 0) AS total_paid
     FROM (
       SELECT DISTINCT si.id, si.sub_total, si.payable, COALESCE(cp.paid, 0) AS paid
       FROM sale_invoices si
       LEFT JOIN customers c ON c.id = si.customer_id
       LEFT JOIN (
         SELECT invoice_id, SUM(amount) AS paid FROM customer_payments GROUP BY invoice_id
       ) cp ON cp.invoice_id = si.id
       ${itemJoinSql}
       ${whereSql}
       ${havingSql}
     ) filtered`,
    params
  );
  return rows[0];
}

module.exports = {
  getCustomerById,
  getItemsForUpdate,
  getBusinessUnitById,
  getInventoryQuantities,
  insertInvoiceHeader,
  setReceiptNo,
  insertInvoiceItems,
  insertLedgerEntry,
  // decrementStock,
  // incrementStock,
  adjustInventory,
  getSummary,
  findAll,
  count,
  findById,
  findItemsByInvoiceId,
  updateHeader,
  insertPayment,
  countPayments,
  countReturns,
  deleteInvoiceItems,
  deleteInvoiceHeader,
  getNextReceipt
};
