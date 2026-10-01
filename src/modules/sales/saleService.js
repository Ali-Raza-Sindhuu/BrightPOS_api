const pool = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const saleModel = require('./saleModel');
const { getPagination, buildMeta } = require('../../utils/pagination');

// Single source of truth for invoice status, derived from real numbers
// instead of trusting a status column that some other flow (payment
// recording, returns) might forget to update.
function deriveStatus(payable, paid) {
  const p = Number(payable) || 0;
  const paidAmt = Number(paid) || 0;
  if (paidAmt <= 0) return 'unpaid';
  if (paidAmt >= p) return 'paid';
  return 'partially_paid';
}

function withDerivedStatus(row) {
  if (!row) return row;
  return { ...row, status: deriveStatus(row.payable, row.paid) };
}

async function listSales(query) {
  const { page, limit, offset } = getPagination(query);
  const search = query.search?.trim();

  const [rows, total] = await Promise.all([
    saleModel.findAll({ limit, offset, search }),
    saleModel.count({ search }),
  ]);

  return { rows: rows.map(withDerivedStatus), meta: buildMeta(page, limit, total) }; // ← positional, not an object
}

async function getSale(id) {
  const invoice = await saleModel.findById(id);
  if (!invoice) throw new ApiError(404, 'Sale invoice not found');
  const items = await saleModel.findItemsByInvoiceId(id);
  return { ...withDerivedStatus(invoice), items };
}

function validatePayloadShape(body) {
  if (!body.business_unit_id) throw new ApiError(422, 'business_unit_id is required');
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new ApiError(422, 'At least one item is required');
  }
  for (const it of body.items) {
    if (!it.item_id) throw new ApiError(422, 'Each item requires an item_id');
    if (!Number.isFinite(it.qty) || it.qty <= 0) {
      throw new ApiError(422, `Invalid qty for item_id ${it.item_id}`);
    }
    if (it.unit_price !== undefined && (!Number.isFinite(it.unit_price) || it.unit_price < 0)) {
      throw new ApiError(422, `Invalid unit_price for item_id ${it.item_id}`);
    }
  }
  if (body.discount !== undefined && (!Number.isFinite(body.discount) || body.discount < 0)) {
    throw new ApiError(422, 'discount must be a non-negative number');
  }
}

async function createSale(body) {
  validatePayloadShape(body);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (body.customer_id) {
      const customer = await saleModel.getCustomerById(conn, body.customer_id);
      if (!customer) throw new ApiError(422, `customer_id ${body.customer_id} does not exist`);
    }

    const businessUnit = await saleModel.getBusinessUnitById(conn, body.business_unit_id);
    if (!businessUnit) throw new ApiError(422, `business_unit_id ${body.business_unit_id} does not exist`);
    if (!Number(businessUnit.is_active)) throw new ApiError(422, 'This business unit is inactive');

    const requestedQtyByItem = new Map();
    for (const it of body.items) {
      requestedQtyByItem.set(it.item_id, (requestedQtyByItem.get(it.item_id) || 0) + it.qty);
    }

    const itemIds = [...requestedQtyByItem.keys()];
    const dbItems = await saleModel.getItemsForUpdate(conn, itemIds);
    const dbItemsById = new Map(dbItems.map((r) => [r.id, r]));

    const missing = itemIds.filter((id) => !dbItemsById.has(id));
    if (missing.length) {
      throw new ApiError(422, `Invalid item_id(s): ${missing.join(', ')}`);
    }

    // Stock availability check — validates against inventory only
    const insufficientStock = [];
    const locationQty = await saleModel.getInventoryQuantities(conn, itemIds, body.business_unit_id);
    for (const [itemId, requestedQty] of requestedQtyByItem.entries()) {
      const dbItem = dbItemsById.get(itemId);
      if (!dbItem.is_enable) {
        throw new ApiError(422, `Item "${dbItem.item_name}" (id ${itemId}) is disabled`);
      }
      const availableAtLocation = locationQty.get(itemId) || 0;
      if (availableAtLocation < requestedQty) {
        insufficientStock.push({
          item_id: itemId,
          item_name: dbItem.item_name,
          business_unit_id: body.business_unit_id,
          available: availableAtLocation,
          requested: requestedQty,
        });
      }
    }
    if (insufficientStock.length) {
      throw new ApiError(409, 'Insufficient stock for one or more items', insufficientStock);
    }

    // Server computes the math
    const lineItems = body.items.map((it) => {
      const dbItem = dbItemsById.get(it.item_id);
      const unitPrice = it.unit_price !== undefined ? it.unit_price : dbItem.sale_price;
      const totalPrice = round2(unitPrice * it.qty);
      return { item_id: it.item_id, qty: it.qty, unit_price: unitPrice, total_price: totalPrice };
    });

    const subTotal = round2(lineItems.reduce((sum, li) => sum + li.total_price, 0));
    const discount = body.discount ? round2(body.discount) : 0;
    const payable = round2(subTotal - discount);
    if (payable < 0) throw new ApiError(422, 'discount cannot exceed sub_total');

    // Create invoice FIRST so invoiceId exists before we reference it
    const invoiceId = await saleModel.insertInvoiceHeader(conn, {
      customer_id: body.customer_id ?? null,
      business_unit_id: body.business_unit_id,
      description: body.description,
      discount,
      sub_total: subTotal,
      payable,
      status: 'unpaid',
    });

    await saleModel.insertInvoiceItems(conn, invoiceId, lineItems);

    // Single, correct stock-movement loop — runs once, after invoiceId exists
    for (const [itemId, requestedQty] of requestedQtyByItem.entries()) {
      const dbItem = dbItemsById.get(itemId);
      await saleModel.adjustInventory(conn, itemId, dbItem.item_unit_id, body.business_unit_id, -requestedQty);
      await saleModel.insertLedgerEntry(conn, {
        businessUnitId: body.business_unit_id,
        itemId,
        type: 'SALE',
        qty: -requestedQty,
        refType: 'SALE_INVOICE',
        refId: invoiceId,
      });
    }

    const receiptNo = `INV-${invoiceId}`;
    await saleModel.setReceiptNo(conn, invoiceId, receiptNo);

    const requestedPayment = body.given_amount == null || body.given_amount === ''
      ? 0
      : Number(body.given_amount);
    if (!Number.isFinite(requestedPayment) || requestedPayment < 0) {
      throw new ApiError(422, 'given_amount must be a non-negative number');
    }
    const initialPayment = round2(requestedPayment);
    if (initialPayment > 0) {
      await saleModel.insertPayment(conn, {
        invoice_id: invoiceId,
        customer_id: body.customer_id ?? null,
        amount: Math.min(initialPayment, payable),
        payment_date: new Date(),
        payment_method: body.payment_method || 'Cash',
      });
    }

    await conn.commit();
    return getSale(invoiceId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}


async function updateSale(id, body) {
  const invoice = await saleModel.findById(id);
  if (!invoice) throw new ApiError(404, 'Sale invoice not found');

  const currentStatus = deriveStatus(invoice.payable, invoice.paid);
  if (currentStatus === 'paid') {
    throw new ApiError(400, 'Cannot edit an invoice that has already been paid in full');
  }
  const paymentsCount = await saleModel.countPayments(id);
  if (paymentsCount > 0) {
    throw new ApiError(400, 'Cannot edit an invoice that already has payments recorded against it');
  }

  // Header-only edit: line items are locked after creation since stock has
  // already moved. To change items, delete this invoice and re-create it.
  if (body.customer_id) {
    const customer = await saleModel.getCustomerById(pool, body.customer_id);
    if (!customer) throw new ApiError(422, `customer_id ${body.customer_id} does not exist`);
  }

  const discount = body.discount !== undefined ? round2(body.discount) : invoice.discount;
  if (discount < 0) throw new ApiError(422, 'discount must be a non-negative number');

  const payable = round2(invoice.sub_total - discount);
  if (payable < 0) throw new ApiError(422, 'discount cannot exceed sub_total');

  await saleModel.updateHeader(id, {
    customer_id: body.customer_id !== undefined ? body.customer_id : invoice.customer_id,
    description: body.description !== undefined ? body.description : invoice.description,
    discount,
    sub_total: invoice.sub_total,
    payable,
    status: 'unpaid', // stored column kept only for backward-compat reads; real reads use deriveStatus()
  });

  return getSale(id);
}

async function deleteSale(id) {
  const invoice = await saleModel.findById(id);
  if (!invoice) throw new ApiError(404, 'Sale invoice not found');

  const currentStatus = deriveStatus(invoice.payable, invoice.paid);
  if (currentStatus === 'paid') {
    throw new ApiError(400, 'Cannot delete an invoice that has already been paid in full');
  }
  const [paymentsCount, returnsCount] = await Promise.all([
    saleModel.countPayments(id),
    saleModel.countReturns(id),
  ]);
  if (paymentsCount > 0) {
    throw new ApiError(409, 'Cannot delete: invoice has payments recorded against it');
  }
  if (returnsCount > 0) {
    throw new ApiError(409, 'Cannot delete: invoice has returns recorded against it');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const items = await saleModel.findItemsByInvoiceId(id);
for (const item of items) {
  const [dbItems] = await saleModel.getItemsForUpdate(conn, [item.item_id]);
  const dbItem = dbItems[0];
  if (dbItem) {
    await saleModel.adjustInventory(conn, item.item_id, dbItem.item_unit_id, invoice.business_unit_id, item.qty);
    await saleModel.insertLedgerEntry(conn, {
      businessUnitId: invoice.business_unit_id,
      itemId: item.item_id,
      type: 'SALE',
      qty: item.qty, // positive — reversing a sale adds stock back
      refType: 'SALE_INVOICE_REVERSAL',
      refId: id,
    });
  }
}
    await saleModel.deleteInvoiceItems(conn, id);
    await saleModel.deleteInvoiceHeader(conn, id);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

const getNextReceipt = async () => {
  return saleModel.getNextReceipt();
};
function round2(n) {
  return Math.round(n * 100) / 100;
}

async function getSalesSummary(query) {
  const filters = {
    search: query.search?.trim(),
    customer_id: query.customer_id,
    item_id: query.item_id,
    category_id: query.category_id,
    status: query.status,
    from_date: query.from_date,
    to_date: query.to_date,
  };
  return saleModel.getSummary(filters);
}

module.exports = { listSales, getSale, createSale, updateSale, deleteSale, getNextReceipt, getSalesSummary };
