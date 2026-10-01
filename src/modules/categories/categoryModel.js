const pool = require("../../config/db");

const TABLE = "categories";

const findAll = async ({ limit, offset, search }) => {
  const params = [];
  let where = "";
  if (search) {
    where = "WHERE category_name LIKE ?";
    params.push(`%${search}%`);
  }

  const [rows] = await pool.query(
    `SELECT * FROM ${TABLE} ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM ${TABLE} ${where}`,
    params
  );

  return { rows, total: countRows[0].total };
};

const findById = async (id) => {
  const [rows] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ?`, [id]);
  return rows[0] || null;
};

const findByName = async (category_name, excludeId = null) => {
  let sql = `SELECT * FROM ${TABLE} WHERE category_name = ?`;
  const params = [category_name];
  if (excludeId) {
    sql += " AND id != ?";
    params.push(excludeId);
  }
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
};

const create = async ({ category_name, is_enable = 1 }) => {
  const [result] = await pool.query(
    `INSERT INTO ${TABLE} (category_name, is_enable) VALUES (?, ?)`,
    [category_name, is_enable]
  );
  return findById(result.insertId);
};

const update = async (id, { category_name, is_enable }) => {
  const fields = [];
  const params = [];

  if (category_name !== undefined) {
    fields.push("category_name = ?");
    params.push(category_name);
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

const countSubCategories = async (categoryId) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM sub_categories WHERE category_id = ?`,
    [categoryId]
  );
  return rows[0].total;
};

module.exports = {
  findAll,
  findById,
  findByName,
  create,
  update,
  remove,
  countSubCategories,
};
