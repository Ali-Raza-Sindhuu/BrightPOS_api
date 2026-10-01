const pool = require("../../config/db");
const TABLE = "shelve_locations";

const findAll = async ({ limit, offset, search }) => {
  const params = [];
  let where = "";
  if (search) {
    where = "WHERE shelf_name_code LIKE ?";
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

const findByCode = async (shelf_name_code, excludeId = null) => {
  let sql = `SELECT * FROM ${TABLE} WHERE shelf_name_code = ?`;
  const params = [shelf_name_code];
  if (excludeId) {
    sql += " AND id != ?";
    params.push(excludeId);
  }
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
};

const create = async ({ shelf_name_code, description = null }) => {
  const [result] = await pool.query(
    `INSERT INTO ${TABLE} (shelf_name_code, description) VALUES (?, ?)`,
    [shelf_name_code, description]
  );
  return findById(result.insertId);
};

const update = async (id, { shelf_name_code, description }) => {
  const fields = [];
  const params = [];
  if (shelf_name_code !== undefined) { fields.push("shelf_name_code = ?"); params.push(shelf_name_code); }
  if (description !== undefined) { fields.push("description = ?"); params.push(description); }
  if (fields.length === 0) return findById(id);
  params.push(id);
  await pool.query(`UPDATE ${TABLE} SET ${fields.join(", ")} WHERE id = ?`, params);
  return findById(id);
};

const remove = async (id) => {
  const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
  return result.affectedRows > 0;
};

const countItems = async (shelveId) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM item_details WHERE shelve_location_id = ?`,
    [shelveId]
  );
  return rows[0].total;
};

module.exports = { findAll, findById, findByCode, create, update, remove, countItems };
