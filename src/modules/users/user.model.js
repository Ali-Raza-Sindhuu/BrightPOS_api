const  pool  = require("../../config/db");

// identifier can be an email or a username - Login accepts either.
async function findByIdentifier(identifier) {
  const [rows] = await pool.query(
    `SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1`,
    [identifier, identifier]
  );
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query(`SELECT * FROM users WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

// Table renamed to access_groups per the access-control guide (migration 009).
async function findAll() {
  const [rows] = await pool.query(
    `SELECT u.*, g.name AS group_name
     FROM users u
     LEFT JOIN access_groups g ON g.id = u.group_id
     ORDER BY u.created_at DESC`
  );
  return rows;
}

// email is optional (see migration 008) — only filter on it when present,
// otherwise "email = NULL" would never match anything via `?` binding anyway,
// but being explicit avoids relying on that MySQL quirk.
async function findByEmailOrUsername(email, username, excludeId = null) {
  const conditions = ["username = ?"];
  const params = [username];

  if (email) {
    conditions.push("email = ?");
    params.push(email);
  }

  let sql = `SELECT id FROM users WHERE (${conditions.join(" OR ")})`;
  if (excludeId) {
    sql += ` AND id != ?`;
    params.push(excludeId);
  }

  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
}

async function create({ fullName, username, email, passwordHash, role = "user", groupId = null }) {
  const [result] = await pool.query(
    `INSERT INTO users (full_name, username, email, password_hash, role, group_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [fullName, username, email || null, passwordHash, role, groupId]
  );
  return findById(result.insertId);
}

// Plain-field update (no password). Use updatePasswordHash separately for
// password changes, same split the existing changePassword flow relies on.
async function update(id, { fullName, username, email, role, groupId, isActive }) {
  await pool.query(
    `UPDATE users
     SET full_name = ?, username = ?, email = ?, role = ?, group_id = ?, is_active = ?
     WHERE id = ?`,
    [fullName, username, email || null, role, groupId, isActive ? 1 : 0, id]
  );
  return findById(id);
}

async function updatePasswordHash(id, passwordHash) {
  await pool.query(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, id]);
}

// Self-service profile edit — deliberately narrower than update(): a user
// editing their own name/email must never be able to touch role/group_id/
// username through this path (that stays admin-only via user.service.js).
async function updateOwnProfile(id, { fullName, email }) {
  await pool.query(`UPDATE users SET full_name = ?, email = ? WHERE id = ?`, [
    fullName,
    email || null,
    id,
  ]);
  return findById(id);
}

async function touchLastLogin(id) {
  await pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [id]);
}

async function remove(id) {
  await pool.query(`DELETE FROM users WHERE id = ?`, [id]);
}

// Strips password_hash before sending a user object back to the client.
function toSafeJSON(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

module.exports = {
  findByIdentifier,
  findById,
  findAll,
  findByEmailOrUsername,
  create,
  update,
  updateOwnProfile,
  updatePasswordHash,
  touchLastLogin,
  remove,
  toSafeJSON,
};
