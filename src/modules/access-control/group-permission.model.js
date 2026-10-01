const pool  = require("../../config/db");

async function findByGroup(groupId) {
  const [rows] = await pool.query(
    `SELECT p.id AS permission_id, p.permission_key, p.module, gp.effect
     FROM group_permissions gp
     JOIN permissions p ON p.id = gp.permission_id JOIN access_groups g ON g.id = gp.group_id AND g.is_active = 1
     WHERE gp.group_id = ?`,
    [groupId]
  );
  return rows;
}

// All ALLOW permission_keys for a group — this is what a logged-in user's
// `permissions` array is built from. DENY rows are excluded here since
// there's no explicit-deny consumer yet (see guide's "nice-to-haves").
async function findAllowedKeysForGroup(groupId) {
  const [rows] = await pool.query(
    `SELECT p.permission_key
     FROM group_permissions gp
     JOIN permissions p ON p.id = gp.permission_id
     WHERE gp.group_id = ? AND gp.effect = 'ALLOW'`,
    [groupId]
  );
  return rows.map((r) => r.permission_key);
}

// Replaces a group's full permission set in one transaction — the UI always
// submits complete desired state (checklist / drag-and-drop tree), not diffs.
async function replaceForGroup(groupId, permissions) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`DELETE FROM group_permissions WHERE group_id = ?`, [groupId]);
    if (permissions.length) {
      const values = permissions.map((p) => [groupId, p.permissionId, p.effect || "ALLOW"]);
      await conn.query(
        `INSERT INTO group_permissions (group_id, permission_id, effect) VALUES ?`,
        [values]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { findByGroup, findAllowedKeysForGroup, replaceForGroup };
