const pool  = require("../../config/db");

async function findAll() {
  const [rows] = await pool.query(`SELECT * FROM permissions ORDER BY permission_key ASC`);
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query(`SELECT * FROM permissions WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

async function findByKey(permissionKey) {
  const [rows] = await pool.query(`SELECT * FROM permissions WHERE permission_key = ? LIMIT 1`, [
    permissionKey,
  ]);
  return rows[0] || null;
}

async function create({ permissionKey, module, description }) {
  const [result] = await pool.query(
    `INSERT INTO permissions (permission_key, module, description) VALUES (?, ?, ?)`,
    [permissionKey, module, description || null]
  );
  return findById(result.insertId);
}

// Idempotent insert used by the seed script — safe to re-run any time the
// frontend's permission catalog (e.g. SIDEBAR_CATALOG) gains a new key.
async function createIfMissing({ permissionKey, module, description }) {
  await pool.query(
    `INSERT IGNORE INTO permissions (permission_key, module, description) VALUES (?, ?, ?)`,
    [permissionKey, module, description || null]
  );
  return findByKey(permissionKey);
}

module.exports = { findAll, findById, findByKey, create, createIfMissing };
