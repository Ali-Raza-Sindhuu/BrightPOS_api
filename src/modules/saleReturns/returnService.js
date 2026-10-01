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
  if (!ret) throw new ApiError(404, 'Sale return not found');
  const items = await returnModel.findItemsByReturnId(id);
  return { ...ret, items };
}

function validatePayloadShape(body) {
  if (!body.sale_invoice_id) throw new ApiError(422, 'sale_invoice_id is required');
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new ApiError(422, 'At least one item is required');
  }
  for (const it of body.items) {
    if (!it.item_id) throw new ApiError(422, 'Each item requires an item_id');
    if (!Number.isFinite(it.qty) || it.qty <= 0) {
      throw new ApiError(422, `Invalid qty for item_id ${it.item_id}`);
    }
    if (it.price !== undefined && (!Number.isFinite(it.price) || it.price < 0)) {
      throw new ApiError(422, `Invalid price for item_id ${it.item_id}`);
    }
  }
}

async function createReturn(body) {
  validatePayloadShape(body);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const invoice = await returnModel.getInvoiceForUpdate(conn, body.sale_invoice_id);
    if (!invoice) throw new ApiError(422, `sale_invoice_id ${body.sale_invoice_id} does not exist`);

    const originalLines = await returnModel.getOriginalLinesByInvoice(conn, body.sale_invoice_id);
    const originalByItem = new Map(originalLines.map((r) => [r.item_id, r]));

    const alreadyReturned = await returnModel.getReturnedQtyByInvoice(conn, body.sale_invoice_id);
    const returnedByItem = new Map(alreadyReturned.map((r) => [r.item_id, r.returned_qty]));

    const requestedByItem = new Map();
    for (const it of body.items) {
      requestedByItem.set(it.item_id, (requestedByItem.get(it.item_id) || 0) + it.qty);
    }

    const overLimit = [];
    for (const [itemId, requestedQty] of requestedByItem.entries()) {
      const original = originalByItem.get(itemId);
      if (!original) throw new ApiError(422, `item_id ${itemId} was not part of this invoice`);
      const alreadyReturnedQty = returnedByItem.get(itemId) || 0;
      const remaining = original.ordered_qty - alreadyReturnedQty;
      if (requestedQty > remaining) {
        overLimit.push({
          item_id: itemId,
          ordered: original.ordered_qty,
          already_returned: alreadyReturnedQty,
          requested: requestedQty,
        });
      }
    }
    if (overLimit.length) {
      throw new ApiError(409, 'Requested return quantity exceeds what remains returnable', overLimit);
    }

    // NEEDED for unit_id — this was missing entirely
    const itemIds = [...requestedByItem.keys()];
    const dbItems = await returnModel.getItemsForUpdate(conn, itemIds);
    const dbItemsById = new Map(dbItems.map((r) => [r.id, r]));

    const lineItems = body.items.map((it) => {
      const original = originalByItem.get(it.item_id);
      const price = it.price !== undefined ? it.price : original.unit_price;
      const total = round2(price * it.qty);
      return { item_id: it.item_id, qty: it.qty, price, total };
    });
    const totalAmount = round2(lineItems.reduce((sum, li) => sum + li.total, 0));

    const returnId = await returnModel.insertReturnHeader(conn, {
      sale_invoice_id: body.sale_invoice_id,
      customer_id: invoice.customer_id,
      return_date: body.return_date ?? new Date(),
      total_amount: totalAmount,
      reason: body.reason,
    });
    await returnModel.insertReturnItems(conn, returnId, lineItems);

    // Single, correct stock-restore loop
    for (const [itemId, qty] of requestedByItem.entries()) {
      const dbItem = dbItemsById.get(itemId);
      if (dbItem) {
        await returnModel.adjustInventory(conn, itemId, dbItem.item_unit_id, invoice.business_unit_id, qty);
        await returnModel.insertLedgerEntry(conn, {
          businessUnitId: invoice.business_unit_id,
          itemId,
          type: 'SALES_RETURN',
          qty: qty,
          refType: 'SALES_RETURN',
          refId: returnId,
        });
      }
    }

    if (invoice.customer_id) {
      await returnModel.adjustCustomerBalance(conn, invoice.customer_id, -totalAmount);
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

async function updateReturn(id, body) {
  const ret = await returnModel.findById(id);
  if (!ret) throw new ApiError(404, 'Sale return not found');

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
    if (!ret) throw new ApiError(404, 'Sale return not found');

    const invoice = await returnModel.getInvoiceForUpdate(conn, ret.sale_invoice_id);

    const items = await returnModel.findItemsByReturnId(id);
    const itemIds = items.map((it) => it.item_id);
    const dbItems = await returnModel.getItemsForUpdate(conn, itemIds);
    const dbItemsById = new Map(dbItems.map((r) => [r.id, r]));

    for (const item of items) {
      const dbItem = dbItemsById.get(item.item_id);
      if (invoice && dbItem) {
        await returnModel.adjustInventory(conn, item.item_id, dbItem.item_unit_id, invoice.business_unit_id, -item.qty);
        await returnModel.insertLedgerEntry(conn, {
          businessUnitId: invoice.business_unit_id,
          itemId: item.item_id,
          type: 'SALES_RETURN',
          qty: -item.qty,
          refType: 'SALES_RETURN_REVERSAL',
          refId: id,
        });
      }
    }

    if (ret.customer_id) {
      await returnModel.adjustCustomerBalance(conn, ret.customer_id, ret.total_amount);
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
