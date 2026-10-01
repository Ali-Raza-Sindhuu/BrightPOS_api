const pool = require('../../config/db');

function searchWhere(search) {
  if (!search) return { clause: '', params: [] };
  return { clause: 'WHERE id_.item_name LIKE ?', params: [`%${search}%`] };
}

async function getItemById(id) {
  const [rows] = await pool.query(
    `SELECT
       i.id, i.item_name, i.reorder_level,
       COALESCE(SUM(inv.quantity), 0) AS stock
     FROM item_details i
     LEFT JOIN inventory inv ON inv.item_id = i.id
     WHERE i.id = ?
     GROUP BY i.id`,
    [id]
  );
  return rows[0];
}

async function findAll({ limit, offset, search, status }) {
  const { clause, params } = searchWhere(search);
  const extra = [];
  if (status) {
    extra.push('r.status = ?');
    params.push(status);
  }
  const where = [clause.replace(/^WHERE /, '')].concat(extra).filter(Boolean);
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT r.*, id_.item_name
     FROM reorders r
     LEFT JOIN item_details id_ ON id_.id = r.item_id
     ${whereClause}
     ORDER BY r.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

async function count({ search, status }) {
  const { clause, params } = searchWhere(search);
  const extra = [];
  if (status) {
    extra.push('r.status = ?');
    params.push(status);
  }
  const where = [clause.replace(/^WHERE /, '')].concat(extra).filter(Boolean);
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM reorders r LEFT JOIN item_details id_ ON id_.id = r.item_id ${whereClause}`,
    params
  );
  return rows[0].total;
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT r.*, id_.item_name
     FROM reorders r
     LEFT JOIN item_details id_ ON id_.id = r.item_id
     WHERE r.id = ?`,
    [id]
  );
  return rows[0];
}

// Items at or below their reorder_level, with no open (Pending/Ordered) reorder yet
async function findLowStockWithoutOpenReorder() {
  const [rows] = await pool.query(
    `SELECT
       i.id AS item_id, i.item_name, i.reorder_level,
       COALESCE(SUM(inv.quantity), 0) AS stock
     FROM item_details i
     LEFT JOIN inventory inv ON inv.item_id = i.id
     WHERE i.is_enable = 1
       AND NOT EXISTS (
         SELECT 1 FROM reorders r WHERE r.item_id = i.id AND r.status IN ('Pending', 'Ordered')
       )
     GROUP BY i.id
     HAVING stock <= i.reorder_level`
  );
  return rows;
}

async function create(data) {
  const [result] = await pool.query(
    'INSERT INTO reorders (item_id, reorder_qty, status, notes) VALUES (?, ?, ?, ?)',
    [data.item_id, data.reorder_qty ?? 1, 'Pending', data.notes ?? null]
  );
  return result.insertId;
}

async function updateStatus(id, status, extra = {}) {
  const sets = ['status = ?'];
  const params = [status];
  if (extra.ordered_at !== undefined) {
    sets.push('ordered_at = ?');
    params.push(extra.ordered_at);
  }
  if (extra.received_at !== undefined) {
    sets.push('received_at = ?');
    params.push(extra.received_at);
  }
  params.push(id);
  await pool.query(`UPDATE reorders SET ${sets.join(', ')} WHERE id = ?`, params);
}

async function updateNotes(id, notes) {
  await pool.query('UPDATE reorders SET notes = ? WHERE id = ?', [notes, id]);
}

async function remove(id) {
  await pool.query('DELETE FROM reorders WHERE id = ?', [id]);
}

module.exports = {
  getItemById,
  findAll,
  count,
  findById,
  findLowStockWithoutOpenReorder,
  create,
  updateStatus,
  updateNotes,
  remove,
};