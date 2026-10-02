const pool = require('../../config/db');
const ApiError = require('../../utils/api-error');
const paymentModel = require('./customer-payment.model');
const { getPagination, buildMeta } = require('../../utils/pagination');

const { money } = require('../../utils/money');
const { id: validId, rejectFields } = require('../../utils/validation');
const VALID_METHODS = ['Cash', 'Card', 'Bank Transfer', 'Cheque', 'Online'];

const round2 = require('../../utils/money').round2;

function statusFor(totalPaid, payable) {
  if (totalPaid >= payable) return 'paid';
  if (totalPaid > 0) return 'partially_paid';
  return 'unpaid';
}

async function listPayments(query) {
  const { page, limit, offset } = getPagination(query);
  const search = query.search?.trim();
  const customerId = query.customer_id ? Number(query.customer_id) : undefined;
  const invoiceId = query.invoice_id ? Number(query.invoice_id) : undefined;

  const [rows, total] = await Promise.all([
    paymentModel.findAll({ limit, offset, search, customerId, invoiceId }),
    paymentModel.count({ search, customerId, invoiceId }),
  ]);

  return { rows, meta: buildMeta({ page, limit, total }) };
}

async function getPayment(id) {
  const payment = await paymentModel.findById(id);
  if (!payment) throw new ApiError(404, 'Payment not found');
  return payment;
}

function validateCreatePayload(body) {
  if (!body.customer_id) throw new ApiError(422, 'customer_id is required');
  if (!Number.isFinite(body.amount) || body.amount <= 0) {
    throw new ApiError(422, 'amount must be a positive number');
  }
  if (body.payment_method && !VALID_METHODS.includes(body.payment_method)) {
    throw new ApiError(422, `payment_method must be one of: ${VALID_METHODS.join(', ')}`);
  }
}

async function createPayment(body) {
  body = { ...body, customer_id: validId(body.customer_id, 'customer_id'), amount: money(body.amount, 'amount', { positive: true }), invoice_id: body.invoice_id ? validId(body.invoice_id, 'invoice_id') : null };
  validateCreatePayload(body);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const customer = await paymentModel.getCustomerById(conn, body.customer_id);
    if (!customer) throw new ApiError(422, `customer_id ${body.customer_id} does not exist`);

    const amount = round2(body.amount);
    const paymentDate = body.payment_date ?? new Date();
    const paymentMethod = body.payment_method ?? 'Cash';

    if (body.invoice_id) {
      const invoice = await paymentModel.getInvoiceForUpdate(conn, body.invoice_id);
      if (!invoice) throw new ApiError(422, `invoice_id ${body.invoice_id} does not exist`);
      const [[counter]]=await conn.query('SELECT id FROM checkout_sessions WHERE invoice_id=?',[invoice.id]);
      if(counter)throw new ApiError(409,'Counter payments must use the checkout workflow');
      if (Number(invoice.customer_id) !== Number(body.customer_id)) {
        throw new ApiError(422, 'invoice_id does not belong to this customer_id');
      }

      const alreadyPaid = await paymentModel.sumPaymentsForInvoice(conn, body.invoice_id);
      const remaining = round2(invoice.payable - alreadyPaid);
      if (amount > remaining) {
        throw new ApiError(422, `amount exceeds remaining balance (${remaining})`);
      }

      const paymentId = await paymentModel.insertPayment(conn, {
        invoice_id: body.invoice_id,
        customer_id: body.customer_id,
        amount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        remarks: body.remarks,
      });

      const newStatus = statusFor(round2(Number(alreadyPaid) + amount), invoice.payable);
      await paymentModel.updateInvoiceStatus(conn, body.invoice_id, newStatus);

      await conn.commit();
      return getPayment(paymentId);
    }

    // No invoice_id — a general payment against the customer's running balance
    const paymentId = await paymentModel.insertPayment(conn, {
      invoice_id: null,
      customer_id: body.customer_id,
      amount,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      remarks: body.remarks,
    });


    await conn.commit();
    return getPayment(paymentId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Amount, invoice_id, and customer_id are immutable — changing them would
// require re-deriving invoice status / customer balance from scratch.
// Only administrative metadata can be corrected after the fact.
async function updatePayment(id, body) {
  rejectFields(body, ['amount', 'customer_id', 'invoice_id']);
  const payment = await paymentModel.findById(id);
  if (!payment) throw new ApiError(404, 'Payment not found');
  const [[counter]]=await pool.query('SELECT id FROM checkout_sessions WHERE invoice_id=?',[payment.invoice_id]);
  if(counter)throw new ApiError(409,'Posted counter payments are immutable');
  const [[refund]]=await pool.query('SELECT id FROM refund_notes WHERE invoice_id=?',[payment.invoice_id]);
  if(refund)throw new ApiError(409,'Refund-linked payment metadata is immutable');

  if (body.payment_method && !VALID_METHODS.includes(body.payment_method)) {
    throw new ApiError(422, `payment_method must be one of: ${VALID_METHODS.join(', ')}`);
  }

  await paymentModel.updateMeta(id, {
    payment_date: body.payment_date ?? payment.payment_date,
    payment_method: body.payment_method ?? payment.payment_method,
    remarks: body.remarks !== undefined ? body.remarks : payment.remarks,
  });

  return getPayment(id);
}

async function deletePayment(id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const payment = await paymentModel.getByIdForUpdate(conn, id);
    if (!payment) throw new ApiError(404, 'Payment not found');
    const [[counter]]=await conn.query('SELECT id FROM checkout_sessions WHERE invoice_id=?',[payment.invoice_id]);
    if(counter)throw new ApiError(409,'Posted counter payments are retained; use refund routing');

    if (payment.invoice_id) {
      const invoice = await paymentModel.getInvoiceForUpdate(conn, payment.invoice_id);
      const [[refund]]=await conn.query('SELECT id FROM refund_notes WHERE invoice_id=? FOR UPDATE',[payment.invoice_id]);
      if(refund)throw new ApiError(409,'Refund-linked payments are retained');
      await paymentModel.deleteById(conn, id);

      if (invoice) {
        const remainingPaid = await paymentModel.sumPaymentsForInvoice(conn, payment.invoice_id);
        const newStatus = statusFor(round2(remainingPaid), invoice.payable);
        await paymentModel.updateInvoiceStatus(conn, payment.invoice_id, newStatus);
      }
    } else {
      await paymentModel.deleteById(conn, id);

    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { listPayments, getPayment, createPayment, updatePayment, deletePayment };
