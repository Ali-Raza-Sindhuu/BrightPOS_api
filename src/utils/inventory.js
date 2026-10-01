const ApiError = require('./api-error');
const { quantity } = require('./validation');

async function adjustInventory(conn, itemId, unitId, businessUnitId, delta) {
  if (!unitId) throw new ApiError(422, 'Item requires a valid inventory unit before posting stock');
  quantity(Math.abs(Number(delta)), 'stock movement');
  // Locking the item master serializes even a missing inventory row, including
  // receipts, sales and reversals. All writers use this same lock order.
  const [[item]] = await conn.query('SELECT id FROM item_details WHERE id = ? FOR UPDATE', [itemId]);
  if (!item) throw new ApiError(422, 'Item not found');
  const [[row]] = await conn.query('SELECT id, quantity FROM inventory WHERE item_id = ? AND unit_id = ? AND business_unit_id = ? FOR UPDATE', [itemId, unitId, businessUnitId]);
  if (Number(row?.quantity || 0) + Number(delta) < -0.000001) throw new ApiError(409, 'Insufficient stock to post or reverse this movement');
  if (row) await conn.query('UPDATE inventory SET quantity = quantity + ? WHERE id = ?', [delta, row.id]);
  else await conn.query('INSERT INTO inventory (item_id, unit_id, business_unit_id, quantity) VALUES (?, ?, ?, ?)', [itemId, unitId, businessUnitId, delta]);
}
module.exports = { adjustInventory };
