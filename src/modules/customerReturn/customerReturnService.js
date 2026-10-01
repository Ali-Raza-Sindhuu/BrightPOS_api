const pool = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const model = require('./customerReturnModel');
const { getPagination, buildMeta } = require('../../utils/pagination');

const VALID_SOURCE_TYPES = ['sale', 'booking'];
const VALID_STATUSES = ['requested', 'approved', 'items_received', 'refunded', 'completed', 'rejected'];
// Forward workflow, with rejection possible up until items are physically received.
const ALLOWED_TRANSITIONS = {
  requested: ['approved', 'rejected'],
  approved: ['items_received', 'rejected'],
  items_received: ['refunded'],
  refunded: ['completed'],
  completed: [],
  rejected: [],
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function list(query) {
  const { page, limit, offset } = getPagination(query);
  const search = query.search?.trim();
  const status = query.status;
  if (status && !VALID_STATUSES.includes(status)) {
    throw new ApiError(422, `status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const [rows, total] = await Promise.all([
    model.findAll({ limit, offset, search, status }),
    model.count({ search, status }),
  ]);
  return { rows, meta: buildMeta({ page, limit, total }) };
}

async function get(id) {
  const row = await model.findById(id);
  if (!row) throw new ApiError(404, 'Customer return not found');
  return row;
}

function validatePayload(body) {
  if (!VALID_SOURCE_TYPES.includes(body.source_type)) {
    throw new ApiError(422, `source_type must be one of: ${VALID_SOURCE_TYPES.join(', ')}`);
  }
  if (!body.source_id) throw new ApiError(422, 'source_id is required');
  if (!body.customer_id) throw new ApiError(422, 'customer_id is required');
  if (!Number.isFinite(body.original_subtotal) || body.original_subtotal < 0) {
    throw new ApiError(422, 'original_subtotal must be a non-negative number');
  }
  if (!Number.isFinite(body.original_total) || body.original_total < 0) {
    throw new ApiError(422, 'original_total must be a non-negative number');
  }
  if (!Number.isFinite(body.refund_amount) || body.refund_amount < 0) {
    throw new ApiError(422, 'refund_amount must be a non-negative number');
  }
}

async function create(body) {
  validatePayload(body);

  const customer = await model.getCustomerById(body.customer_id);
  if (!customer) throw new ApiError(422, `customer_id ${body.customer_id} does not exist`);

  let sourceNo;
  if (body.source_type === 'sale') {
    const invoice = await model.getSaleInvoiceById(body.source_id);
    if (!invoice) throw new ApiError(422, `source_id ${body.source_id} does not exist in sale_invoices`);
    sourceNo = invoice.receipt_no;
  } else {
    const booking = await model.getBookingById(body.source_id);
    if (!booking) throw new ApiError(422, `source_id ${body.source_id} does not exist in bookings`);
    sourceNo = `BK-${booking.id}`;
  }

  // Server computes the final refund unless explicitly overridden — the
  // schema has no formula defined, so this is the one used here:
  // refund_amount minus restocking_fee minus cancellation_fee.
  const restockingFee = round2(body.restocking_fee ?? 0);
  const cancellationFee = round2(body.cancellation_fee ?? 0);
  const finalRefund =
    body.final_refund !== undefined
      ? round2(body.final_refund)
      : round2(body.refund_amount - restockingFee - cancellationFee);
  if (finalRefund < 0) throw new ApiError(422, 'final_refund cannot be negative');

  const id = await model.create({
    ...body,
    source_no: sourceNo,
    customer_name: customer.customer_name,
    mobile: customer.mobile_number,
    restocking_fee: restockingFee,
    cancellation_fee: cancellationFee,
    final_refund: finalRefund,
  });

  await model.setReturnNo(id, `RET-${id}`);
  return get(id);
}

async function updateNotes(id, notes) {
  await get(id);
  await model.updateNotes(id, notes);
  return get(id);
}

async function transition(id, toStatus) {
  const ret = await get(id);
  const allowed = ALLOWED_TRANSITIONS[ret.status] || [];
  if (!allowed.includes(toStatus)) {
    throw new ApiError(400, `Cannot move a customer return from "${ret.status}" to "${toStatus}"`);
  }

  if (toStatus === 'refunded') {
    // Actually crediting the customer happens here, once — not on request/approval.
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await model.updateStatus(id, toStatus);
      await model.adjustCustomerBalance(conn, ret.customer_id, -ret.final_refund);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } else {
    await model.updateStatus(id, toStatus);
  }

  return get(id);
}

module.exports = { list, get, create, updateNotes, transition };