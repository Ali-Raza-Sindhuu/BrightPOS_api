const pool = require("../../config/db");

const TABLE = "sub_categories";

const findAll = async ({ limit, offset, search, category_id }) => {
  const where = [];
  const params = [];

  if (search) {
    where.push("sc.sub_category_name LIKE ?");
    params.push(`%${search}%`);
  }
  if (category_id) {
    where.push("sc.category_id = ?");
    params.push(category_id);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `SELECT sc.*, c.category_name
     FROM ${TABLE} sc
     LEFT JOIN categories c ON c.id = sc.category_id
     ${whereSql}
     ORDER BY sc.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM ${TABLE} sc ${whereSql}`,
    params
  );

  return { rows, total: countRows[0].total };
};

const findById = async (id) => {
  const [rows] = await pool.query(
    `SELECT sc.*, c.category_name
     FROM ${TABLE} sc
     LEFT JOIN categories c ON c.id = sc.category_id
     WHERE sc.id = ?`,
    [id]
  );
  return rows[0] || null;
};

const findByNameInCategory = async (sub_category_name, category_id, excludeId = null) => {
  let sql = `SELECT * FROM ${TABLE} WHERE sub_category_name = ? AND category_id = ?`;
  const params = [sub_category_name, category_id];
  if (excludeId) {
    sql += " AND id != ?";
    params.push(excludeId);
  }
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
};

const create = async ({ category_id, sub_category_name, is_enable = 1 }) => {
  const [result] = await pool.query(
    `INSERT INTO ${TABLE} (category_id, sub_category_name, is_enable) VALUES (?, ?, ?)`,
    [category_id, sub_category_name, is_enable]
  );
  return findById(result.insertId);
};

const update = async (id, { category_id, sub_category_name, is_enable }) => {
  const fields = [];
  const params = [];

  if (category_id !== undefined) {
    fields.push("category_id = ?");
    params.push(category_id);
  }
  if (sub_category_name !== undefined) {
    fields.push("sub_category_name = ?");
    params.push(sub_category_name);
  }
  if (is_enable !== undefined) {
    fields.push("is_enable = ?");
    params.push(is_enable);
  }
  if (fields.length === 0) return findById(id);

  params.push(id);
  await pool.query(`UPDATE ${TABLE} SET ${fields.join(", ")} WHERE id = ?`, params);
  return findById(id);
};

const remove = async (id) => {
  const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
  return result.affectedRows > 0;
};

const countItems = async (subCategoryId) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM item_details WHERE item_subcategory_id = ?`,
    [subCategoryId]
  );
  return rows[0].total;
};

module.exports = {
  findAll,
  findById,
  findByNameInCategory,
  create,
  update,
  remove,
  countItems,
};
