const { id: validId, quantity, date, rejectFields } = require('../../utils/validation');
const { money } = require('../../utils/money');
const { filters } = require('../../utils/validation');
const pool = require('../../config/db');
const ApiError = require('../../utils/api-error');
const saleModel = require('./sale.model');
const { getPagination, buildMeta } = require('../../utils/pagination');

// Single source of truth for invoice status, derived from real numbers
// instead of trusting a status column that some other flow (payment
// recording, returns) might forget to update.
function deriveStatus(payable, paid) {
  const p = Number(payable) || 0;
  const paidAmt = Number(paid) || 0;
  if (paidAmt >= p) return 'paid';
  if (paidAmt <= 0) return 'unpaid';
  return 'partially_paid';
}

function withDerivedStatus(row) {
  if (!row) return row;
  return { ...row, status: deriveStatus(row.net_payable ?? row.payable, row.paid) };
}

async function listSales(query) {
  const { page, limit, offset } = getPagination(query);
  const search = query.search?.trim();

  const [rows, total] = await Promise.all([
    saleModel.findAll({ ...filters(query), limit, offset, search }),
    saleModel.count({ ...filters(query), search }),
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
  if (body.booking_id) return convertBooking(validId(body.booking_id, 'booking_id'));
  body = normalizeSale(body);
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
      const totalPrice = require('../../utils/money').lineTotal(unitPrice, it.qty);
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
  const invoice = await getSale(id);
  rejectFields(body, ['items', 'customer_id', 'business_unit_id', 'discount', 'sub_total', 'payable', 'paid', 'status', 'booking_id']);
  await pool.query('UPDATE sale_invoices SET description = ? WHERE id = ?', [body.description ?? invoice.description, id]);
  return getSale(id);
}
async function deleteSale(id) {
  await getSale(id);
  throw new ApiError(409, 'Posted sales are retained; use a sale return instead of deleting the invoice');
}
function normalizeSale(body) {
  return { ...body, business_unit_id: validId(body.business_unit_id, 'business_unit_id'), customer_id: body.customer_id ? validId(body.customer_id, 'customer_id') : null, discount: money(body.discount ?? 0, 'discount'), items: Array.isArray(body.items) ? body.items.map(line => ({ ...line, item_id: validId(line.item_id, 'item_id'), qty: quantity(line.qty), ...(line.unit_price === undefined ? {} : { unit_price: money(line.unit_price, 'unit_price') }) })) : body.items };
}
async function convertBooking(bookingId) {
  const conn = await pool.getConnection();
  let invoiceId;
  try {
    await conn.beginTransaction();
    const [[booking]] = await conn.query('SELECT * FROM bookings WHERE id = ? FOR UPDATE', [bookingId]);
    if (!booking) throw new ApiError(404, 'Booking not found');
    const [[link]] = await conn.query('SELECT invoice_id FROM booking_invoice_links WHERE booking_id = ?', [bookingId]);
    if (link) { invoiceId = link.invoice_id; await conn.commit(); }
    else {
      if (!['Pending', 'Completed'].includes(booking.booking_status)) throw new ApiError(409, 'Rejected bookings cannot be converted');
      const [lines] = await conn.query('SELECT * FROM booking_items WHERE booking_id = ? ORDER BY item_id, id', [bookingId]);
      if (!lines.length) throw new ApiError(409, 'Booking has no items');
      const requested = new Map();
      for (const line of lines) requested.set(line.item_id, (requested.get(line.item_id) || 0) + Number(line.qty));
      const dbItems = await saleModel.getItemsForUpdate(conn, [...requested.keys()]);
      const byId = new Map(dbItems.map(item => [item.id, item]));
      if (booking.booking_status === 'Pending') {
        const quantities = await saleModel.getInventoryQuantities(conn, [...requested.keys()], booking.business_unit_id);
        for (const [itemId, qty] of requested) if (Number(quantities.get(itemId) || 0) < qty) throw new ApiError(409, 'Insufficient stock to convert booking');
      }
      invoiceId = await saleModel.insertInvoiceHeader(conn, { customer_id: booking.customer_id, business_unit_id: booking.business_unit_id, description: 'Converted booking ' + bookingId, sub_total: booking.sub_total, discount: booking.discount, payable: booking.payable, status: 'unpaid' });
      await saleModel.insertInvoiceItems(conn, invoiceId, lines);
      await saleModel.setReceiptNo(conn, invoiceId, 'INV-' + invoiceId);
      if (booking.booking_status === 'Pending') for (const [itemId, qty] of requested) {
        await saleModel.adjustInventory(conn, itemId, byId.get(itemId).item_unit_id, booking.business_unit_id, -qty);
        await saleModel.insertLedgerEntry(conn, { businessUnitId: booking.business_unit_id, itemId, type: 'SALE', qty: -qty, refType: 'SALE_INVOICE', refId: invoiceId });
      }
      const [payments] = await conn.query('SELECT * FROM booking_payments WHERE booking_id = ? ORDER BY id', [bookingId]);
      const paid = payments.reduce((sum, row) => sum + Number(row.amount), 0);
      if (paid > Number(booking.payable)) throw new ApiError(409, 'Booking advance exceeds invoice payable');
      for (const payment of payments) await saleModel.insertPayment(conn, { invoice_id: invoiceId, customer_id: booking.customer_id, amount: payment.amount, payment_date: payment.payment_date, payment_method: payment.payment_method, remarks: 'Allocated booking advance ' + payment.id });
      await conn.query('INSERT INTO booking_invoice_links (booking_id, invoice_id) VALUES (?, ?)', [bookingId, invoiceId]);
      await conn.query("UPDATE bookings SET booking_status = 'Completed' WHERE id = ?", [bookingId]);
      await conn.query('UPDATE sale_invoices SET status = ? WHERE id = ?', [deriveStatus(booking.payable, paid), invoiceId]);
      await conn.commit();
    }
  } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
  return getSale(invoiceId);
}

const getNextReceipt = async () => {
  return saleModel.getNextReceipt();
};
const round2 = require('../../utils/money').round2;

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
  return saleModel.getSummary(require('../../utils/validation').filters(filters));
}

module.exports = { listSales, getSale, createSale, updateSale, deleteSale, getNextReceipt, getSalesSummary, convertBooking };
