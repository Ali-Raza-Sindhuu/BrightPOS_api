// openingStockService.js
const pool = require('../../config/db.js');

async function createOpeningStock({ business_unit_id, stock_date, remarks, created_by, items }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [headerResult] = await connection.query(
      `INSERT INTO opening_stock (business_unit_id, stock_date, remarks, created_by)
       VALUES (?, ?, ?, ?)`,
      [business_unit_id, stock_date, remarks || null, created_by || null]
    );
    const opening_stock_id = headerResult.insertId;

    for (const line of items) {
      const { item_id, qty } = line;
      const numericQty = Number(qty);

      // Duplicate-opening guard
      const [[existingOpening]] = await connection.query(
        `SELECT id FROM item_stock
         WHERE item_id = ? AND business_unit_id = ? AND type = 'OPENING'
         LIMIT 1`,
        [item_id, business_unit_id]
      );
      if (existingOpening) {
        throw new Error(`Opening stock already posted for item ${item_id} in business unit ${business_unit_id}`);
      }

      // Look up unit_id from item master
      const [[itemRow]] = await connection.query(
        `SELECT item_unit_id FROM item_details WHERE id = ?`,
        [item_id]
      );
      if (!itemRow) {
        throw new Error(`Item ${item_id} not found`);
      }
      const unit_id = itemRow.item_unit_id;

      // opening_stock_items (unchanged structure)
      await connection.query(
        `INSERT INTO opening_stock_items (opening_stock_id, item_id, qty)
         VALUES (?, ?, ?)`,
        [opening_stock_id, item_id, numericQty]
      );

      // inventory - source of truth
      await connection.query(
        `INSERT INTO inventory (business_unit_id, item_id, unit_id, quantity)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
        [business_unit_id, item_id, unit_id, numericQty]
      );

      // item_stock - immutable ledger insert
      await connection.query(
        `INSERT INTO item_stock (business_unit_id, item_id, type, qty, ref_type, ref_id)
         VALUES (?, ?, 'OPENING', ?, 'OPENING_STOCK', ?)`,
        [business_unit_id, item_id, numericQty, opening_stock_id]
      );
    }

    await connection.commit();
    return { opening_stock_id };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function getOpeningStockList({
  business_unit_id,
  item_id,
  category_id,
  stock_date,
  search,
  page = 1,
  limit = 20,
} = {}) {
  const offset = (Number(page) - 1) * Number(limit);
  const whereParts = [];
  const params = [];

  if (business_unit_id) {
    whereParts.push('os.business_unit_id = ?');
    params.push(business_unit_id);
  }
  if (stock_date) {
    whereParts.push('os.stock_date = ?');
    params.push(stock_date);
  }
  if (search) {
    whereParts.push('os.remarks LIKE ?');
    params.push(`%${search}%`);
  }
  if (item_id) {
    whereParts.push('EXISTS (SELECT 1 FROM opening_stock_items osi WHERE osi.opening_stock_id = os.id AND osi.item_id = ?)');
    params.push(item_id);
  }
  if (category_id) {
    whereParts.push(`EXISTS (
      SELECT 1 FROM opening_stock_items osi
      JOIN item_details i ON i.id = osi.item_id
      WHERE osi.opening_stock_id = os.id AND i.item_category_id = ?
    )`);
    params.push(category_id);
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT
        os.id, os.business_unit_id, os.stock_date, os.remarks, os.created_by, os.created_at,
        bu.name AS business_unit_name,
        u.full_name AS created_by_name,
        COALESCE(agg.total_items, 0) AS total_items,
        COALESCE(agg.total_quantity, 0) AS total_quantity,
        COALESCE(agg.total_cost_value, 0) AS total_cost_value
     FROM opening_stock os
     LEFT JOIN business_units bu ON bu.id = os.business_unit_id
     LEFT JOIN users u ON u.id = os.created_by
     LEFT JOIN (
        SELECT osi.opening_stock_id,
               COUNT(*) AS total_items,
               SUM(osi.qty) AS total_quantity,
               SUM(osi.qty * i.purchase_price) AS total_cost_value
        FROM opening_stock_items osi
        JOIN item_details i ON i.id = osi.item_id
        GROUP BY osi.opening_stock_id
     ) agg ON agg.opening_stock_id = os.id
     ${whereClause}
     ORDER BY os.stock_date DESC, os.id DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), offset]
  );

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM opening_stock os ${whereClause}`,
    params
  );

  return {
    rows,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.max(1, Math.ceil(total / Number(limit))),
    },
  };
}

async function deleteOpeningStock(opening_stock_id, reversed_by) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [lines] = await connection.query(
      `SELECT item_id, qty FROM opening_stock_items WHERE opening_stock_id = ?`,
      [opening_stock_id]
    );
    if (lines.length === 0) throw new Error('Opening stock not found or already reversed');

    const [[header]] = await connection.query(
      `SELECT business_unit_id FROM opening_stock WHERE id = ? FOR UPDATE`,
      [opening_stock_id]
    );
    if (!header) throw new Error('Opening stock header not found');

    for (const line of lines) {
      // Reverse inventory
      await connection.query(
        `UPDATE inventory SET quantity = quantity - ?
         WHERE business_unit_id = ? AND item_id = ?`,
        [line.qty, header.business_unit_id, line.item_id]
      );

      // Insert reversal ledger row — never delete/update prior rows
      await connection.query(
        `INSERT INTO item_stock (business_unit_id, item_id, type, qty, ref_type, ref_id)
         VALUES (?, ?, 'OPENING', ?, 'OPENING_STOCK_REVERSAL', ?)`,
        [header.business_unit_id, line.item_id, -line.qty, opening_stock_id]
      );
    }

    await connection.query(
      `UPDATE opening_stock SET remarks = CONCAT(COALESCE(remarks,''), ' [REVERSED]') WHERE id = ?`,
      [opening_stock_id]
    );

    await connection.commit();
    return true;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function getOpeningStockById(id) {
  const [[header]] = await pool.query(
    `SELECT os.id, os.business_unit_id, os.stock_date, os.remarks, os.created_by, os.created_at,
            bu.name AS business_unit_name,
            u.full_name AS created_by_name
     FROM opening_stock os
     LEFT JOIN business_units bu ON bu.id = os.business_unit_id
     LEFT JOIN users u ON u.id = os.created_by
     WHERE os.id = ?`,
    [id]
  );

  if (!header) return null;

  const [lineItems] = await pool.query(
    `SELECT osi.id, osi.item_id, osi.qty,
            i.item_name, i.label_barcode, i.item_category_id,
            i.item_unit_id,
            COALESCE(inv.quantity, 0) AS current_global_stock
     FROM opening_stock_items osi
     JOIN item_details i ON i.id = osi.item_id
     LEFT JOIN inventory inv
       ON inv.item_id = osi.item_id AND inv.business_unit_id = ?
     WHERE osi.opening_stock_id = ?`,
    [header.business_unit_id, id]
  );

  return { ...header, items: lineItems };
}

async function getItemStockByBranch(business_unit_id) {
  const [rows] = await pool.query(
    `SELECT item_id, quantity AS stock
     FROM inventory
     WHERE business_unit_id = ?`,
    [business_unit_id]
  );
  return rows;
}

module.exports = {
  createOpeningStock,
  getOpeningStockList,
  getOpeningStockById,
  deleteOpeningStock,
  getItemStockByBranch,
};
