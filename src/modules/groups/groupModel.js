const  pool  = require("../../config/db");

// Renamed from `groups` to `access_groups` per the access-control guide
// (migration 009). No longer a MySQL reserved word, so no backtick-quoting
// is needed here (unlike the old `groups` table name).

async function findAll() {
  const [rows] = await pool.query(
    `SELECT g.*,
            (SELECT COUNT(*) FROM users u WHERE u.group_id = g.id) AS member_count
     FROM access_groups g
     ORDER BY g.name ASC`
  );
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query(`SELECT * FROM access_groups WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

async function findByName(name, excludeId = null) {
  const params = [name];
  let sql = `SELECT id FROM access_groups WHERE name = ?`;
  if (excludeId) {
    sql += ` AND id != ?`;
    params.push(excludeId);
  }
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
}

async function findByCode(code, excludeId = null) {
  const params = [code];
  let sql = `SELECT id FROM access_groups WHERE code = ?`;
  if (excludeId) {
    sql += ` AND id != ?`;
    params.push(excludeId);
  }
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
}

async function create({ code, name, description }) {
  const [result] = await pool.query(
    `INSERT INTO access_groups (code, name, description, is_active) VALUES (?, ?, ?, 1)`,
    [code, name, description || null]
  );
  return findById(result.insertId);
}

async function update(id, { code, name, description, isActive }) {
  await pool.query(
    `UPDATE access_groups SET code = ?, name = ?, description = ?, is_active = ? WHERE id = ?`,
    [code, name, description || null, isActive ? 1 : 0, id]
  );
  return findById(id);
}

async function remove(id) {
  await pool.query(`DELETE FROM access_groups WHERE id = ?`, [id]);
}

async function countMembers(id) {
  const [rows] = await pool.query(`SELECT COUNT(*) AS count FROM users WHERE group_id = ?`, [id]);
  return rows[0].count;
}

async function findMemberIds(id) {
  const [rows] = await pool.query(`SELECT id FROM users WHERE group_id = ?`, [id]);
  return rows.map((r) => r.id);
}

async function replaceMembers(groupId, userIds) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (userIds.length) {
      const placeholders = userIds.map(() => "?").join(",");
      await conn.query(
        `UPDATE users SET group_id = NULL WHERE group_id = ? AND id NOT IN (${placeholders})`,
        [groupId, ...userIds]
      );
      await conn.query(`UPDATE users SET group_id = ? WHERE id IN (${placeholders})`, [
        groupId,
        ...userIds,
      ]);
    } else {
      await conn.query(`UPDATE users SET group_id = NULL WHERE group_id = ?`, [groupId]);
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  findAll,
  findById,
  findByName,
  findByCode,
  create,
  update,
  remove,
  countMembers,
  findMemberIds,
  replaceMembers,
};
