const pool = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const paymentModel = require('./paymentModel');
const { getPagination, buildMeta } = require('../../utils/pagination');

const VALID_METHODS = ['Cash', 'Card', 'Bank Transfer', 'Cheque', 'Online'];

function round2(n) {
  return Math.round(n * 100) / 100;
}

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
      if (invoice.customer_id !== body.customer_id) {
        throw new ApiError(422, 'invoice_id does not belong to this customer_id');
      }
      if (invoice.status === 'paid') {
        throw new ApiError(400, 'This invoice is already fully paid');
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

      const newStatus = statusFor(round2(alreadyPaid + amount), invoice.payable);
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
    await paymentModel.adjustCustomerBalance(conn, body.customer_id, -amount);

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
  const payment = await paymentModel.findById(id);
  if (!payment) throw new ApiError(404, 'Payment not found');

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

    if (payment.invoice_id) {
      const invoice = await paymentModel.getInvoiceForUpdate(conn, payment.invoice_id);
      await paymentModel.deleteById(conn, id);

      if (invoice) {
        const remainingPaid = await paymentModel.sumPaymentsForInvoice(conn, payment.invoice_id);
        const newStatus = statusFor(round2(remainingPaid), invoice.payable);
        await paymentModel.updateInvoiceStatus(conn, payment.invoice_id, newStatus);
      }
    } else {
      await paymentModel.deleteById(conn, id);
      await paymentModel.adjustCustomerBalance(conn, payment.customer_id, payment.amount);
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
