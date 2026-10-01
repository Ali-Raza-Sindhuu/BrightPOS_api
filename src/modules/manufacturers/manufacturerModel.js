const pool = require("../../config/db");
const TABLE = "manufacturers";

const findAll = async ({ limit, offset, search }) => {
  const params = [];
  let where = "";
  if (search) {
    where = "WHERE manufacturer_name LIKE ? OR manufacturer_id LIKE ?";
    params.push(`%${search}%`, `%${search}%`);
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

const findByCode = async (manufacturer_id, excludeId = null) => {
  let sql = `SELECT * FROM ${TABLE} WHERE manufacturer_id = ?`;
  const params = [manufacturer_id];
  if (excludeId) {
    sql += " AND id != ?";
    params.push(excludeId);
  }
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
};

const create = async (data) => {
  const {
    manufacturer_id,
    manufacturer_name,
    contact_person = null,
    phone = null,
    email = null,
    address = null,
    status = 1,
    mobile = null,
    designation = null,
    ntn = null,
    gst = null,
  } = data;

  const [result] = await pool.query(
    `INSERT INTO ${TABLE}
     (manufacturer_id, manufacturer_name, contact_person, phone, email, address, status, mobile, designation, ntn, gst)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [manufacturer_id, manufacturer_name, contact_person, phone, email, address, status, mobile, designation, ntn, gst]
  );
  return findById(result.insertId);
};

const ALLOWED_FIELDS = [
  "manufacturer_id",
  "manufacturer_name",
  "contact_person",
  "phone",
  "email",
  "address",
  "status",
  "mobile",
  "designation",
  "ntn",
  "gst",
];

const update = async (id, data) => {
  const fields = [];
  const params = [];
  for (const key of ALLOWED_FIELDS) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(data[key]);
    }
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

const countItems = async (manufacturerId) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM item_details WHERE manufacturer_id = ?`,
    [manufacturerId]
  );
  return rows[0].total;
};

module.exports = { findAll, findById, findByCode, create, update, remove, countItems };
