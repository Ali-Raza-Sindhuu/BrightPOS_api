const pool = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const bookingModel = require('./bookingModel');
const { getPagination, buildMeta } = require('../../utils/pagination');

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function listBookings(query) {
  const { page, limit, offset } = getPagination(query);
  const search = query.search?.trim();
  const status = query.status;

  const [rows, total] = await Promise.all([
    bookingModel.findAll({ limit, offset, search, status }),
    bookingModel.count({ search, status }),
  ]);
  return { rows, meta: buildMeta({ page, limit, total }) };
}

async function getBooking(id) {
  const booking = await bookingModel.findById(id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  const items = await bookingModel.findItemsByBookingId(id);
  return { ...booking, items };
}

function validatePayloadShape(body) {
  if (!body.business_unit_id) throw new ApiError(422, 'business_unit_id is required');
  if (!body.booking_date) throw new ApiError(422, 'booking_date is required');
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new ApiError(422, 'At least one item is required');
  }
  for (const it of body.items) {
    if (!it.item_id) throw new ApiError(422, 'Each item requires an item_id');
    if (!Number.isFinite(it.qty) || it.qty <= 0) throw new ApiError(422, `Invalid qty for item_id ${it.item_id}`);
  }
}

// Booking creation is a reservation, like a purchase order — it does NOT
// move stock. Stock only moves when the booking is completed (see below),
// mirroring the Purchase -> Goods Receipt two-phase pattern.
async function createBooking(body) {
  validatePayloadShape(body);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (body.customer_id) {
      const customer = await bookingModel.getCustomerById(conn, body.customer_id);
      if (!customer) throw new ApiError(422, `customer_id ${body.customer_id} does not exist`);
    }
    const businessUnit = await bookingModel.getBusinessUnitById(conn, body.business_unit_id);
    if (!businessUnit) throw new ApiError(422, `business_unit_id ${body.business_unit_id} does not exist`);
    if (!businessUnit.is_active) throw new ApiError(422, 'This business unit is inactive');

    const itemIds = [...new Set(body.items.map((it) => it.item_id))];
    const dbItems = await bookingModel.getItemsForUpdate(conn, itemIds);
    const dbItemsById = new Map(dbItems.map((r) => [r.id, r]));
    const missing = itemIds.filter((id) => !dbItemsById.has(id));
    if (missing.length) throw new ApiError(422, `Invalid item_id(s): ${missing.join(', ')}`);

    // Validate stock availability at this business unit before reserving.
    // Aggregate requested qty per item first, in case the same item_id
    // appears on more than one line.
    const requestedByItem = new Map();
    for (const it of body.items) {
      requestedByItem.set(it.item_id, (requestedByItem.get(it.item_id) || 0) + it.qty);
    }
    const locationQty = await bookingModel.getInventoryQuantities(conn, itemIds, body.business_unit_id);
    const insufficientStock = [];
    for (const [itemId, requestedQty] of requestedByItem.entries()) {
      const dbItem = dbItemsById.get(itemId);
      const availableAtLocation = locationQty.get(itemId) || 0;
      if (availableAtLocation < requestedQty) {
        insufficientStock.push({
          item_id: itemId,
          item_name: dbItem?.item_name,
          business_unit_id: body.business_unit_id,
          available: availableAtLocation,
          requested: requestedQty,
        });
      }
    }
    if (insufficientStock.length) {
      throw new ApiError(409, 'Insufficient stock to create this booking', insufficientStock);
    }

    const lineItems = body.items.map((it) => {
      const dbItem = dbItemsById.get(it.item_id);
      if (!dbItem.is_enable) throw new ApiError(422, `Item "${dbItem.item_name}" (id ${it.item_id}) is disabled`);
      const unitPrice = it.unit_price !== undefined ? it.unit_price : dbItem.sale_price;
      const totalPrice = round2(unitPrice * it.qty);
      return { item_id: it.item_id, qty: it.qty, unit_price: unitPrice, total_price: totalPrice };
    });

    const subTotal = round2(lineItems.reduce((sum, li) => sum + li.total_price, 0));
    const discount = body.discount ? round2(body.discount) : 0;
    const payable = round2(subTotal - discount);
    if (payable < 0) throw new ApiError(422, 'discount cannot exceed sub_total');

    const bookingId = await bookingModel.insertHeader(conn, {
      customer_id: body.customer_id ?? null,
      business_unit_id: body.business_unit_id,
      booking_date: body.booking_date,
      booking_time: body.booking_time,
      sub_total: subTotal,
      discount,
      payable,
      payment_method: body.payment_method,
    });
    await bookingModel.insertItems(conn, bookingId, lineItems);

    const initialPayment = body.initial_payment ? round2(Number(body.initial_payment)) : 0;
    if (initialPayment > 0) {
      if (initialPayment > payable) {
        throw new ApiError(422, `initial_payment (${initialPayment}) cannot exceed payable (${payable})`);
      }
      if (!body.customer_id) {
        throw new ApiError(422, 'customer_id is required to record an initial payment');
      }
      await conn.query(
        `INSERT INTO booking_payments (customer_id, booking_id, amount, payment_method, payment_date, remarks)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [body.customer_id, bookingId, initialPayment, body.payment_method ?? 'cash', new Date(), 'Advance payment at booking']
      );
      const newStatus = initialPayment >= payable ? 'Paid' : 'Partial';
      await conn.query('UPDATE bookings SET paid = ?, to_be_paid = ?, payment_status = ? WHERE id = ?', [
        initialPayment,
        round2(payable - initialPayment),
        newStatus,
        bookingId,
      ]);
    }
    await conn.commit();
    return getBooking(bookingId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateBooking(id, body) {
  const booking = await bookingModel.findById(id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.booking_status !== 'Pending') {
    throw new ApiError(400, 'Only a Pending booking can be edited');
  }

  // Header-only edit — same rationale as sales: line items are locked so the
  // sub_total set at creation stays trustworthy.
  const discount = body.discount !== undefined ? round2(body.discount) : booking.discount;
  if (discount < 0) throw new ApiError(422, 'discount must be a non-negative number');
  const payable = round2(booking.sub_total - discount);
  if (payable < 0) throw new ApiError(422, 'discount cannot exceed sub_total');
  const toBePaid = round2(payable - booking.paid);
  if (toBePaid < 0) throw new ApiError(422, 'discount cannot reduce payable below what has already been paid');

  await bookingModel.updateHeader(id, {
    customer_id: body.customer_id !== undefined ? body.customer_id : booking.customer_id,
    booking_date: body.booking_date ?? booking.booking_date,
    booking_time: body.booking_time !== undefined ? body.booking_time : booking.booking_time,
    discount,
    payable,
    to_be_paid: toBePaid,
  });
  return getBooking(id);
}

// This is the step that actually moves stock — the booking's items leave
// inventory at its business_unit_id, same checks as a sale.
async function completeBooking(id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const booking = await bookingModel.findByIdForUpdate(conn, id);
    if (!booking) throw new ApiError(404, 'Booking not found');
    if (booking.booking_status !== 'Pending') {
      throw new ApiError(400, `Cannot complete a booking with status "${booking.booking_status}"`);
    }

    const items = await bookingModel.findItemsByBookingId(id);
    const itemIds = items.map((it) => it.item_id);
    const dbItems = await bookingModel.getItemsForUpdate(conn, itemIds);
    const dbItemsById = new Map(dbItems.map((r) => [r.id, r]));
    const locationQty = await bookingModel.getInventoryQuantities(conn, itemIds, booking.business_unit_id);

    const insufficientStock = [];
for (const item of items) {
  const availableAtLocation = locationQty.get(item.item_id) || 0;
  if (availableAtLocation < item.qty) {
    insufficientStock.push({
      item_id: item.item_id,
      business_unit_id: booking.business_unit_id,
      available: availableAtLocation,
      requested: item.qty,
    });
  }
}
if (insufficientStock.length) {
  throw new ApiError(409, 'Insufficient stock to complete this booking', insufficientStock);
}

for (const item of items) {
  const dbItem = dbItemsById.get(item.item_id);
  await bookingModel.adjustInventory(conn, item.item_id, dbItem.item_unit_id, booking.business_unit_id, -item.qty);
  await bookingModel.insertLedgerEntry(conn, {
    businessUnitId: booking.business_unit_id,
    itemId: item.item_id,
    type: 'SALE',
    qty: -item.qty,
    refType: 'BOOKING',
    refId: id,
  });
}

    await bookingModel.updateStatus(conn, id, 'Completed');
    await conn.commit();
    return getBooking(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Reject never moved stock, so it's a pure status flip.
async function rejectBooking(id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const booking = await bookingModel.findByIdForUpdate(conn, id);
    if (!booking) throw new ApiError(404, 'Booking not found');
    if (booking.booking_status !== 'Pending') {
      throw new ApiError(400, `Cannot reject a booking with status "${booking.booking_status}"`);
    }
    await bookingModel.updateStatus(conn, id, 'Rejected');
    await conn.commit();
    return getBooking(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function deleteBooking(id) {
  const booking = await bookingModel.findById(id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.booking_status !== 'Pending') {
    throw new ApiError(400, 'Only a Pending booking can be deleted — Completed/Rejected bookings are kept for record');
  }
  const paymentsCount = await bookingModel.countPayments(id);
  if (paymentsCount > 0) {
    throw new ApiError(409, 'Cannot delete: booking has payments recorded against it');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await bookingModel.deleteItems(conn, id);
    await bookingModel.deleteHeader(conn, id);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { listBookings, getBooking, createBooking, updateBooking, completeBooking, rejectBooking, deleteBooking };
