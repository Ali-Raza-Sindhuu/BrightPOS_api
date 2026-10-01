const pool = require("../../config/db");
const TABLE = "item_units";

const findAll = async ({ limit, offset, search }) => {
  const params = [];
  let where = "";
  if (search) {
    where = "WHERE unit_name LIKE ?";
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

const findByName = async (unit_name, excludeId = null) => {
  let sql = `SELECT * FROM ${TABLE} WHERE unit_name = ?`;
  const params = [unit_name];
  if (excludeId) {
    sql += " AND id != ?";
    params.push(excludeId);
  }
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
};

const create = async ({ unit_name, description = null }) => {
  const [result] = await pool.query(
    `INSERT INTO ${TABLE} (unit_name, description) VALUES (?, ?)`,
    [unit_name, description]
  );
  return findById(result.insertId);
};

const update = async (id, { unit_name, description }) => {
  const fields = [];
  const params = [];
  if (unit_name !== undefined) { fields.push("unit_name = ?"); params.push(unit_name); }
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

const countUsage = async (unitId) => {
  const [rows] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM item_details WHERE item_unit_id = ?) +
       (SELECT COUNT(*) FROM inventory WHERE unit_id = ?) AS total`,
    [unitId, unitId]
  );
  return rows[0].total;
};

module.exports = { findAll, findById, findByName, create, update, remove, countUsage };
