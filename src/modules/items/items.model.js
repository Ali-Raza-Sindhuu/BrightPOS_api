const pool = require("../../config/db");
const TABLE = "item_details";

const buildListSelect = (hasBranchFilter) => {
  const stockJoin = hasBranchFilter
    ? `LEFT JOIN inventory ist ON ist.item_id = i.id AND ist.business_unit_id = ?`
    : `LEFT JOIN (
         SELECT item_id, SUM(quantity) AS quantity
         FROM inventory
         GROUP BY item_id
       ) ist ON ist.item_id = i.id`;

  return `
    SELECT
      i.*,
      c.category_name,
      sc.sub_category_name,
      m.manufacturer_name,
      s.supplier_name,
      sl.shelf_name_code,
      u.unit_name,
      t.type_name,
      ${hasBranchFilter ? "ist.business_unit_id," : ""}
      COALESCE(ist.quantity, 0) AS stock
    FROM ${TABLE} i
    LEFT JOIN categories c ON c.id = i.item_category_id
    LEFT JOIN sub_categories sc ON sc.id = i.item_subcategory_id
    LEFT JOIN manufacturers m ON m.id = i.manufacturer_id
    LEFT JOIN suppliers s ON s.id = i.supplier_id
    LEFT JOIN shelve_locations sl ON sl.id = i.shelve_location_id
    LEFT JOIN item_units u ON u.id = i.item_unit_id
    LEFT JOIN item_types t ON t.id = i.item_type_id
    ${stockJoin}
  `;
};

const findAll = async ({
  limit,
  offset,
  search,
  category_id,
  subcategory_id,
  is_enable,
  business_unit_id,
}) => {
  const where = [];
  const params = [];
  const hasBranchFilter = Boolean(business_unit_id);
  const joinParams = hasBranchFilter ? [business_unit_id] : [];

  if (search) {
    where.push("(i.item_name LIKE ? OR i.label_barcode LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category_id) {
    where.push("i.item_category_id = ?");
    params.push(category_id);
  }
  if (subcategory_id) {
    where.push("i.item_subcategory_id = ?");
    params.push(subcategory_id);
  }
  if (is_enable !== undefined) {
    where.push("i.is_enable = ?");
    params.push(is_enable);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `${buildListSelect(hasBranchFilter)} ${whereSql} ORDER BY i.id DESC LIMIT ? OFFSET ?`,
    [...joinParams, ...params, limit, offset]
  );

  const countJoin = hasBranchFilter
    ? `LEFT JOIN inventory ist ON ist.item_id = i.id AND ist.business_unit_id = ?`
    : "";
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM ${TABLE} i ${countJoin} ${whereSql}`,
    [...joinParams, ...params]
  );
  return { rows, total: countRows[0].total };
};

const findById = async (id, business_unit_id = null) => {
  const hasBranchFilter = Boolean(business_unit_id);
  const joinParams = hasBranchFilter ? [business_unit_id] : [];
  const sql = `${buildListSelect(hasBranchFilter)} WHERE i.id = ?`;
  const [rows] = await pool.query(sql, [...joinParams, id]);
  return rows[0] || null;
};

const findByBarcode = async (label_barcode, excludeId = null) => {
  if (!label_barcode) return null;
  let sql = `SELECT * FROM ${TABLE} WHERE label_barcode = ?`;
  const params = [label_barcode];
  if (excludeId) {
    sql += " AND id != ?";
    params.push(excludeId);
  }
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
};

const ALLOWED_FIELDS = [
  "item_name",
  "item_image_url",
  "label_barcode",
  "item_category_id",
  "manufacturer_id",
  "supplier_id",
  "shelve_location_id",
  "item_unit_id",
  "details",
  "is_enable",
  "purchase_price",
  "sale_price",
  "reorder_level",
  "per_unit",
  "item_subcategory_id",
  "item_type_id",
];

const create = async (data) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const cols = [];
    const placeholders = [];
    const values = [];
    for (const key of ALLOWED_FIELDS) {
      if (data[key] !== undefined) {
        cols.push(key);
        placeholders.push("?");
        values.push(data[key]);
      }
    }
    const [result] = await conn.query(
      `INSERT INTO ${TABLE} (${cols.join(", ")}) VALUES (${placeholders.join(", ")})`,
      values
    );
    const itemId = result.insertId;

    const openingQty = data.stock !== undefined ? Number(data.stock) : 0;

    if (openingQty > 0 && data.business_unit_id) {
      const [headerResult] = await conn.query(
        `INSERT INTO opening_stock (business_unit_id, stock_date, remarks, created_by)
         VALUES (?, CURDATE(), 'Auto-created from item registration', ?)`,
        [data.business_unit_id, data.created_by ?? null]
      );
      const openingStockId = headerResult.insertId;

      await conn.query(
        `INSERT INTO opening_stock_items (opening_stock_id, item_id, qty)
         VALUES (?, ?, ?)`,
        [openingStockId, itemId, openingQty]
      );

      await conn.query(
        `INSERT INTO inventory (business_unit_id, item_id, unit_id, quantity)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
        [data.business_unit_id, itemId, data.item_unit_id, openingQty]
      );

      await conn.query(
        `INSERT INTO item_stock (business_unit_id, item_id, type, qty, ref_type, ref_id)
         VALUES (?, ?, 'OPENING', ?, 'OPENING_STOCK', ?)`,
        [data.business_unit_id, itemId, openingQty, openingStockId]
      );
    }

    await conn.commit();
    return findById(itemId, data.business_unit_id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// Metadata-only — stock changes belong to Opening Stock / Purchase / Sale /
// Adjustment / Transfer, never a raw item-edit form.
const update = async (id, data) => {
  const fields = [];
  const params = [];
  for (const key of ALLOWED_FIELDS) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(data[key]);
    }
  }
  if (fields.length === 0) return findById(id, data.business_unit_id);
  params.push(id);
  await pool.query(`UPDATE ${TABLE} SET ${fields.join(", ")} WHERE id = ?`, params);
  return findById(id, data.business_unit_id);
};

const remove = async (id) => {
  const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
  return result.affectedRows > 0;
};

const findLowStock = async (business_unit_id) => {
  const hasBranchFilter = Boolean(business_unit_id);
  const params = hasBranchFilter ? [business_unit_id] : [];
  const [rows] = await pool.query(
    `SELECT i.id, i.item_name, i.reorder_level, COALESCE(SUM(inv.quantity), 0) AS stock
     FROM item_details i
     LEFT JOIN inventory inv ON inv.item_id = i.id ${hasBranchFilter ? "AND inv.business_unit_id = ?" : ""}
     WHERE i.is_enable = 1
     GROUP BY i.id
     HAVING stock <= i.reorder_level
     ORDER BY stock ASC`,
    params
  );
  return rows;
};

module.exports = {
  findAll,
  findById,
  findByBarcode,
  create,
  update,
  remove,
  findLowStock,
};