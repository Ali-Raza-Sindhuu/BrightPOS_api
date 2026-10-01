const pool = require('../../config/db');

async function getBusinessUnit(conn, id) {
  const [rows] = await conn.query('SELECT id, is_active FROM business_units WHERE id = ?', [id]);
  return rows[0];
}

async function getItemsForUpdate(conn, itemIds) {
  if (!itemIds.length) return [];
  const [rows] = await conn.query(
    'SELECT id, item_name, item_unit_id FROM item_details WHERE id IN (?) FOR UPDATE',
    [itemIds]
  );
  return rows;
}

// item_stock row for a given item + branch, locked for update
async function getInventoryRow(conn, itemId, businessUnitId) {
  const [rows] = await conn.query(
    'SELECT id, quantity FROM inventory WHERE item_id = ? AND business_unit_id = ? FOR UPDATE',
    [itemId, businessUnitId]
  );
  return rows[0];
}

async function insertLedgerEntry(conn, { businessUnitId, itemId, type, qty, refType, refId }) {
  await conn.query(
    `INSERT INTO item_stock (business_unit_id, item_id, type, qty, ref_type, ref_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [businessUnitId, itemId, type, qty, refType, refId]
  );
}

// Upsert-style adjust: create the branch row if it doesn't exist yet
async function adjustInventory(conn, itemId, unitId, businessUnitId, deltaQty) {
  const row = await getInventoryRow(conn, itemId, businessUnitId);
  if (row) {
    await conn.query('UPDATE inventory SET quantity = quantity + ? WHERE id = ?', [deltaQty, row.id]);
  } else {
    await conn.query(
      'INSERT INTO inventory (item_id, unit_id, business_unit_id, quantity) VALUES (?, ?, ?, ?)',
      [itemId, unitId, businessUnitId, Math.max(deltaQty, 0)]
    );
  }
}

function searchWhere(search) {
  if (!search) return { clause: '', params: [] };
  return { clause: 'WHERE st.reference_no LIKE ?', params: [`%${search}%`] };
}
async function findAll({ limit, offset, search }) {
  const { clause, params } = searchWhere(search);
  const [rows] = await pool.query(
    `SELECT st.*, fu.name AS from_unit_name, tu.name AS to_unit_name,
       (SELECT COUNT(*) FROM stock_transfer_items sti WHERE sti.transfer_id = st.id) AS total_items
     FROM stock_transfers st
     LEFT JOIN business_units fu ON fu.id = st.from_unit_id
     LEFT JOIN business_units tu ON tu.id = st.to_unit_id
     ${clause}
     ORDER BY st.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

async function count({ search }) {
  const { clause, params } = searchWhere(search);
  const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM stock_transfers st ${clause}`, params);
  return rows[0].total;
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT st.*, fu.name AS from_unit_name, tu.name AS to_unit_name
     FROM stock_transfers st
     LEFT JOIN business_units fu ON fu.id = st.from_unit_id
     LEFT JOIN business_units tu ON tu.id = st.to_unit_id
     WHERE st.id = ?`,
    [id]
  );
  return rows[0];
}

async function findItemsByTransferId(transferId) {
  const [rows] = await pool.query(
    `SELECT sti.*, id_.item_name
     FROM stock_transfer_items sti
     LEFT JOIN item_details id_ ON id_.id = sti.item_id
     WHERE sti.transfer_id = ?`,
    [transferId]
  );
  return rows;
}

module.exports = {
  pool,
  getBusinessUnit,
  getItemsForUpdate,
  getInventoryRow,
  adjustInventory,
  findAll,
  count,
  findById,
  findItemsByTransferId,
  insertLedgerEntry
};
