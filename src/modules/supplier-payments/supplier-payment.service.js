const pool = require('../../config/db');
const ApiError = require('../../utils/api-error');
const paymentModel = require('./supplier-payment.model');
const { getPagination, buildMeta } = require('../../utils/pagination');

const { money } = require('../../utils/money');
const { id: validId, rejectFields } = require('../../utils/validation');

const round2 = require('../../utils/money').round2;

// purchases.payment_status enum is ('paid','partial','unpaid') — note this
// differs from sale_invoices.status ('paid','unpaid','partially_paid').
function statusFor(totalPaid, payable) {
  if (totalPaid >= payable) return 'paid';
  if (totalPaid > 0) return 'partial';
  return 'unpaid';
}

async function listPayments(query) {
  const { page, limit, offset } = getPagination(query);
  const search = query.search?.trim();
  const supplierId = query.supplier_id ? Number(query.supplier_id) : undefined;
  const purchaseId = query.purchase_id ? Number(query.purchase_id) : undefined;

  const [rows, total] = await Promise.all([
    paymentModel.findAll({ limit, offset, search, supplierId, purchaseId }),
    paymentModel.count({ search, supplierId, purchaseId }),
  ]);

  return { rows, meta: buildMeta({ page, limit, total }) };
}

async function getPayment(id) {
  const payment = await paymentModel.findById(id);
  if (!payment) throw new ApiError(404, 'Payment not found');
  return payment;
}

function validateCreatePayload(body) {
  if (!body.supplier_id) throw new ApiError(422, 'supplier_id is required');
  if (!Number.isFinite(body.amount) || body.amount <= 0) {
    throw new ApiError(422, 'amount must be a positive number');
  }
}

async function createPayment(body) {
  body = { ...body, supplier_id: validId(body.supplier_id, 'supplier_id'), amount: money(body.amount, 'amount', { positive: true }), purchase_id: body.purchase_id ? validId(body.purchase_id, 'purchase_id') : null };
  validateCreatePayload(body);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const supplier = await paymentModel.getSupplierById(conn, body.supplier_id);
    if (!supplier) throw new ApiError(422, `supplier_id ${body.supplier_id} does not exist`);

    const amount = round2(body.amount);
    const paymentDate = body.payment_date ?? new Date();
    const paymentMethod = body.payment_method ?? 'Cash';

    if (body.purchase_id) {
      const purchase = await paymentModel.getPurchaseForUpdate(conn, body.purchase_id);
      if (!purchase) throw new ApiError(422, `purchase_id ${body.purchase_id} does not exist`);
      if (Number(purchase.supplier_id) !== Number(body.supplier_id)) {
        throw new ApiError(422, 'purchase_id does not belong to this supplier_id');
      }

      const alreadyPaid = await paymentModel.sumPaymentsForPurchase(conn, body.purchase_id);
      const remaining = round2(purchase.payable - alreadyPaid);
      if (amount > remaining) {
        throw new ApiError(422, `amount exceeds remaining balance (${remaining})`);
      }

      const paymentId = await paymentModel.insertPayment(conn, {
        supplier_id: body.supplier_id,
        purchase_id: body.purchase_id,
        amount,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        note: body.note,
      });

      const newStatus = statusFor(round2(Number(alreadyPaid) + amount), purchase.payable);
      await paymentModel.updatePurchaseStatus(conn, body.purchase_id, newStatus);

      await conn.commit();
      return getPayment(paymentId);
    }

    // No purchase_id — a general/advance payment to the supplier. Note there's
    // no suppliers.balance-type column in this schema (unlike customers), so
    // this is recorded for the ledger only and doesn't adjust anything else.
    const paymentId = await paymentModel.insertPayment(conn, {
      supplier_id: body.supplier_id,
      purchase_id: null,
      amount,
      payment_method: paymentMethod,
      payment_date: paymentDate,
      note: body.note,
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

// amount, purchase_id, and supplier_id are immutable — same rationale as
// customer payments: changing them would require re-deriving payment_status.
async function updatePayment(id, body) {
  rejectFields(body, ['amount', 'supplier_id', 'purchase_id']);
  const payment = await paymentModel.findById(id);
  if (!payment) throw new ApiError(404, 'Payment not found');

  await paymentModel.updateMeta(id, {
    payment_date: body.payment_date ?? payment.payment_date,
    payment_method: body.payment_method ?? payment.payment_method,
    note: body.note !== undefined ? body.note : payment.note,
  });

  return getPayment(id);
}

async function deletePayment(id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const payment = await paymentModel.getByIdForUpdate(conn, id);
    if (!payment) throw new ApiError(404, 'Payment not found');

    if (payment.purchase_id) {
      const purchase = await paymentModel.getPurchaseForUpdate(conn, payment.purchase_id);
      await paymentModel.deleteById(conn, id);

      if (purchase) {
        const remainingPaid = await paymentModel.sumPaymentsForPurchase(conn, payment.purchase_id);
        const newStatus = statusFor(round2(remainingPaid), purchase.payable);
        await paymentModel.updatePurchaseStatus(conn, payment.purchase_id, newStatus);
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
