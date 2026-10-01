const pool = require("../../config/db");
const TABLE = "item_types";

const findAll = async ({ limit, offset, search }) => {
  const params = [];
  let where = "";
  if (search) {
    where = "WHERE type_name LIKE ?";
    params.push(`%${search}%`);
  }
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLE} ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM ${TABLE} ${where}`, params);
  return { rows, total: countRows[0].total };
};

const findById = async (id) => {
  const [rows] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ?`, [id]);
  return rows[0] || null;
};

const findByName = async (type_name, excludeId = null) => {
  let sql = `SELECT * FROM ${TABLE} WHERE type_name = ?`;
  const params = [type_name];
  if (excludeId) {
    sql += " AND id != ?";
    params.push(excludeId);
  }
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
};

const create = async ({ type_name, description = null, is_enable = 1 }) => {
  const [result] = await pool.query(
    `INSERT INTO ${TABLE} (type_name, description, is_enable) VALUES (?, ?, ?)`,
    [type_name, description, is_enable]
  );
  return findById(result.insertId);
};

const update = async (id, { type_name, description, is_enable }) => {
  const fields = [];
  const params = [];
  if (type_name !== undefined) { fields.push("type_name = ?"); params.push(type_name); }
  if (description !== undefined) { fields.push("description = ?"); params.push(description); }
  if (is_enable !== undefined) { fields.push("is_enable = ?"); params.push(is_enable); }
  if (fields.length === 0) return findById(id);
  params.push(id);
  await pool.query(`UPDATE ${TABLE} SET ${fields.join(", ")} WHERE id = ?`, params);
  return findById(id);
};

const remove = async (id) => {
  const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
  return result.affectedRows > 0;
};

const countItems = async (itemTypeId) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM item_details WHERE item_type_id = ?`,
    [itemTypeId]
  );
  return rows[0].total;
};

module.exports = { findAll, findById, findByName, create, update, remove, countItems };
