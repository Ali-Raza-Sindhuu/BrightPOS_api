const  pool  = require("../../config/db");

async function create({ userId, ipAddress, action = "LOGIN", userAgent }) {
  await pool.query(
    `INSERT INTO access_ip_logs (user_id, ip_address, action, user_agent) VALUES (?, ?, ?, ?)`,
    [userId || null, ipAddress, action, userAgent || null]
  );
}

async function findPage({ page = 1, limit = 20, search = "" }) {
  const offset = (page - 1) * limit;

  let where = "";
  let params = [];
  if (search) {
    where = "WHERE u.username LIKE ? OR l.ip_address LIKE ?";
    params = [`%${search}%`, `%${search}%`];
  }

  const [rows] = await pool.query(
    `SELECT l.*, u.username, u.full_name AS user_name
     FROM access_ip_logs l
     LEFT JOIN users u ON u.id = l.user_id
     ${where}
     ORDER BY l.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count FROM access_ip_logs l LEFT JOIN users u ON u.id = l.user_id ${where}`,
    params
  );

  return { rows, total: count };
}

module.exports = { create, findPage };
