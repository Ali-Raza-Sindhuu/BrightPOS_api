const ApiError = require('../../utils/api-error');
const { getPagination, buildMeta } = require('../../utils/pagination');
const repository = require('./stock-transfer.model');

const {
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
} = repository;

async function list(query) {
  const { page, limit, offset } = getPagination(query);
  const search = query.search?.trim();
  const [rows, total] = await Promise.all([findAll({ limit, offset, search }), count({ search })]);
  return { rows, meta: buildMeta({ page, limit, total }) };
}

async function get(id) {
  const row = await findById(id);
  if (!row) throw new ApiError(404, 'Stock transfer not found');
  const items = await findItemsByTransferId(id);
  return { ...row, items };
}

function validatePayload(body) {
  if (!body.from_unit_id) throw new ApiError(422, 'from_unit_id is required');
  if (!body.to_unit_id) throw new ApiError(422, 'to_unit_id is required');
  if (body.from_unit_id === body.to_unit_id) throw new ApiError(422, 'from_unit_id and to_unit_id must differ');
  if (!body.transfer_date) throw new ApiError(422, 'transfer_date is required');
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new ApiError(422, 'At least one item is required');
  }
  for (const it of body.items) {
    if (!it.item_id) throw new ApiError(422, 'Each item requires an item_id');
    if (!Number.isFinite(it.quantity) || it.quantity <= 0) {
      throw new ApiError(422, `Invalid quantity for item_id ${it.item_id}`);
    }
  }
}

async function create(body) {
  validatePayload(body);

  const conn = await pool.getConnection();
  let transferId;
  try {
    await conn.beginTransaction();

    const fromUnit = await getBusinessUnit(conn, body.from_unit_id);
    if (!fromUnit) throw new ApiError(422, `from_unit_id ${body.from_unit_id} does not exist`);
    const toUnit = await getBusinessUnit(conn, body.to_unit_id);
    if (!toUnit) throw new ApiError(422, `to_unit_id ${body.to_unit_id} does not exist`);
    if (!fromUnit.is_active || !toUnit.is_active) {
      throw new ApiError(422, 'Both business units must be active');
    }

    const requestedByItem = new Map();
    for (const it of body.items) {
      requestedByItem.set(it.item_id, (requestedByItem.get(it.item_id) || 0) + it.quantity);
    }
    const itemIds = [...requestedByItem.keys()];
    const dbItems = await getItemsForUpdate(conn, itemIds);
    const dbItemsById = new Map(dbItems.map((r) => [r.id, r]));
    const missing = itemIds.filter((id) => !dbItemsById.has(id));
    if (missing.length) throw new ApiError(422, `Invalid item_id(s): ${missing.join(', ')}`);

    const insufficient = [];
    for (const [itemId, qty] of requestedByItem.entries()) {
      const dbItem = dbItemsById.get(itemId);
      const row = await getInventoryRow(conn, itemId, body.from_unit_id);
      const available = row ? Number(row.quantity) : 0;
      if (available < qty) {
        insufficient.push({ item_id: itemId, item_name: dbItem.item_name, available, requested: qty });
      }
    }
    if (insufficient.length) {
      throw new ApiError(409, 'Insufficient stock at from_unit_id for one or more items', insufficient);
    }

    const [result] = await conn.query(
      `INSERT INTO stock_transfers (from_unit_id, to_unit_id, transfer_date, reference_no, status)
       VALUES (?, ?, ?, ?, 'POSTED')`,
      [body.from_unit_id, body.to_unit_id, body.transfer_date, body.reference_no ?? null]
    );
    transferId = result.insertId;

    const values = body.items.map((it) => [transferId, it.item_id, it.quantity]);
    await conn.query('INSERT INTO stock_transfer_items (transfer_id, item_id, quantity) VALUES ?', [values]);

    for (const [itemId, qty] of requestedByItem.entries()) {
      const dbItem = dbItemsById.get(itemId);

      await adjustInventory(conn, itemId, dbItem.item_unit_id, body.from_unit_id, -qty);
      await insertLedgerEntry(conn, {
        businessUnitId: body.from_unit_id,
        itemId,
        type: 'TRANSFER_OUT',
        qty: -qty,
        refType: 'STOCK_TRANSFER',
        refId: transferId,
      });

      await adjustInventory(conn, itemId, dbItem.item_unit_id, body.to_unit_id, qty);
      await insertLedgerEntry(conn, {
        businessUnitId: body.to_unit_id,
        itemId,
        type: 'TRANSFER_IN',
        qty: qty,
        refType: 'STOCK_TRANSFER',
        refId: transferId,
      });
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // Connection is released — safe to query independently now
  return get(transferId);
}

async function remove(id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM stock_transfers WHERE id = ? FOR UPDATE', [id]);
    const transfer = rows[0];
    if (!transfer) throw new ApiError(404, 'Stock transfer not found');
    if (transfer.status !== 'POSTED') {
      throw new ApiError(400, `Cannot reverse a transfer with status "${transfer.status}"`);
    }

    const items = await findItemsByTransferId(id, conn);
    const itemIds = items.map((it) => it.item_id);
    const dbItems = await getItemsForUpdate(conn, itemIds);
    const dbItemsById = new Map(dbItems.map((r) => [r.id, r]));

    for (const item of items) {
      const dbItem = dbItemsById.get(item.item_id);
      const qty = Number(item.quantity);

      // Reverse: add back to source, remove from destination
      await adjustInventory(conn, item.item_id, dbItem.item_unit_id, transfer.from_unit_id, qty);
      await insertLedgerEntry(conn, {
        businessUnitId: transfer.from_unit_id,
        itemId: item.item_id,
        type: 'TRANSFER_OUT',
        qty: qty,
        refType: 'STOCK_TRANSFER_REVERSAL',
        refId: id,
      });

      await adjustInventory(conn, item.item_id, dbItem.item_unit_id, transfer.to_unit_id, -qty);
      await insertLedgerEntry(conn, {
        businessUnitId: transfer.to_unit_id,
        itemId: item.item_id,
        type: 'TRANSFER_IN',
        qty: -qty,
        refType: 'STOCK_TRANSFER_REVERSAL',
        refId: id,
      });
    }

    await conn.query("UPDATE stock_transfers SET status = 'CANCELLED' WHERE id = ?", [id]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  list,
  get,
  create,
  remove,
};
