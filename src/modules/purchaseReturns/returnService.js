const pool = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const returnModel = require('./returnModel');
const { getPagination, buildMeta } = require('../../utils/pagination');

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function listReturns(query) {
  const { page, limit, offset } = getPagination(query);
  const search = query.search?.trim();

  const [rows, total] = await Promise.all([
    returnModel.findAll({ limit, offset, search }),
    returnModel.count({ search }),
  ]);

  return { rows, meta: buildMeta({ page, limit, total }) };
}

async function getReturn(id) {
  const ret = await returnModel.findById(id);
  if (!ret) throw new ApiError(404, 'Purchase return not found');
  const items = await returnModel.findItemsByReturnId(id);
  return { ...ret, items };
}

function validatePayloadShape(body) {
  if (!body.purchase_id) throw new ApiError(422, 'purchase_id is required');
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new ApiError(422, 'At least one item is required');
  }
  for (const it of body.items) {
    if (!it.item_id) throw new ApiError(422, 'Each item requires an item_id');
    if (!Number.isFinite(it.qty) || it.qty <= 0) {
      throw new ApiError(422, `Invalid qty for item_id ${it.item_id}`);
    }
    if (it.purchase_price !== undefined && (!Number.isFinite(it.purchase_price) || it.purchase_price < 0)) {
      throw new ApiError(422, `Invalid purchase_price for item_id ${it.item_id}`);
    }
  }
}

async function createReturn(body) {
  validatePayloadShape(body);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const purchase = await returnModel.getPurchaseForUpdate(conn, body.purchase_id);
    if (!purchase) throw new ApiError(422, `purchase_id ${body.purchase_id} does not exist`);
    if (purchase.order_status !== 'received') {
      throw new ApiError(400, 'Only a received purchase can be returned — stock has not moved yet');
    }

    const originalLines = await returnModel.getOriginalLinesByPurchase(conn, body.purchase_id);
    const originalByItem = new Map(originalLines.map((r) => [r.item_id, r]));

    const alreadyReturned = await returnModel.getReturnedQtyByPurchase(conn, body.purchase_id);
    const returnedByItem = new Map(alreadyReturned.map((r) => [r.item_id, r.returned_qty]));

    const requestedByItem = new Map();
    for (const it of body.items) {
      requestedByItem.set(it.item_id, (requestedByItem.get(it.item_id) || 0) + it.qty);
    }

    const itemIds = [...requestedByItem.keys()];
    const dbItems = await returnModel.getItemsForUpdate(conn, itemIds);
    const dbItemsById = new Map(dbItems.map((r) => [r.id, r]));

    // Validation — MUST run before any writes: caps against returnable qty
    // and confirms stock actually exists to send back.
    const problems = [];
    const locationQty = await returnModel.getInventoryQuantities(conn, itemIds, purchase.business_unit_id);
    for (const [itemId, requestedQty] of requestedByItem.entries()) {
      const original = originalByItem.get(itemId);
      if (!original) throw new ApiError(422, `item_id ${itemId} was not part of this purchase`);

      const alreadyReturnedQty = returnedByItem.get(itemId) || 0;
      const remainingReturnable = original.ordered_qty - alreadyReturnedQty;
      if (requestedQty > remainingReturnable) {
        problems.push({
          item_id: itemId,
          type: 'exceeds_returnable',
          ordered: original.ordered_qty,
          already_returned: alreadyReturnedQty,
          requested: requestedQty,
        });
        continue;
      }

      const availableAtLocation = locationQty.get(itemId) || 0;
      if (availableAtLocation < requestedQty) {
        const dbItem = dbItemsById.get(itemId);
        problems.push({
          item_id: itemId,
          type: 'insufficient_stock',
          business_unit_id: purchase.business_unit_id,
          item_name: dbItem?.item_name,
          available: availableAtLocation,
          requested: requestedQty,
        });
      }
    }
    if (problems.length) {
      throw new ApiError(409, 'Cannot process this return', problems);
    }

    const lineItems = body.items.map((it) => {
      const original = originalByItem.get(it.item_id);
      const purchasePrice = it.purchase_price !== undefined ? it.purchase_price : original.purchase_price;
      const total = round2(purchasePrice * it.qty);
      return { item_id: it.item_id, qty: it.qty, purchase_price: purchasePrice, total };
    });
    const totalAmount = round2(lineItems.reduce((sum, li) => sum + li.total, 0));

    // Header + items MUST be created before returnId is referenced anywhere
    const returnId = await returnModel.insertReturnHeader(conn, {
      purchase_id: body.purchase_id,
      supplier_id: purchase.supplier_id,
      return_date: body.return_date ?? new Date(),
      total_amount: totalAmount,
      reason: body.reason,
    });
    await returnModel.insertReturnItems(conn, returnId, lineItems);

    // Stock movement — now safe, returnId exists
    for (const [itemId, qty] of requestedByItem.entries()) {
      const dbItem = dbItemsById.get(itemId);
      if (dbItem) {
        await returnModel.adjustInventory(conn, itemId, dbItem.item_unit_id, purchase.business_unit_id, -qty);
        await returnModel.insertLedgerEntry(conn, {
          businessUnitId: purchase.business_unit_id,
          itemId,
          type: 'PURCHASE_RETURN',
          qty: -qty,
          refType: 'PURCHASE_RETURN',
          refId: returnId,
        });
      }
    }

    await conn.commit();
    return getReturn(returnId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Header-only edit — line items are locked after creation since stock has
// already moved, same rationale as sales/sale-returns.
async function updateReturn(id, body) {
  const ret = await returnModel.findById(id);
  if (!ret) throw new ApiError(404, 'Purchase return not found');

  await returnModel.updateMeta(id, {
    return_date: body.return_date ?? ret.return_date,
    reason: body.reason !== undefined ? body.reason : ret.reason,
  });

  return getReturn(id);
}

async function deleteReturn(id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const ret = await returnModel.getByIdForUpdate(conn, id);
    if (!ret) throw new ApiError(404, 'Purchase return not found');

    const purchase = await returnModel.getPurchaseForUpdate(conn, ret.purchase_id);

    const items = await returnModel.findItemsByReturnId(id);
    const itemIds = items.map((it) => it.item_id);
    const dbItems = await returnModel.getItemsForUpdate(conn, itemIds);
    const dbItemsById = new Map(dbItems.map((r) => [r.id, r]));

    for (const item of items) {
  const dbItem = dbItemsById.get(item.item_id);
  if (dbItem && purchase) {
    await returnModel.adjustInventory(conn, item.item_id, dbItem.item_unit_id, purchase.business_unit_id, item.qty);
    await returnModel.insertLedgerEntry(conn, {
      businessUnitId: purchase.business_unit_id,
      itemId: item.item_id,
      type: 'PURCHASE_RETURN',
      qty: item.qty, // positive — reversing a return adds stock back
      refType: 'PURCHASE_RETURN_REVERSAL',
      refId: id,
    });
  }
}

    await returnModel.deleteReturnItems(conn, id);
    await returnModel.deleteReturnHeader(conn, id);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { listReturns, getReturn, createReturn, updateReturn, deleteReturn };
