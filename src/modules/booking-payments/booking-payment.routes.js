const express = require('express');
const pool = require('../../config/db');
const ApiError = require('../../utils/api-error');
const catchAsync = require('../../utils/catch-async');
const sendResponse = require('../../utils/send-response');
const { getPagination, buildMeta } = require('../../utils/pagination');

const VALID_METHODS = ['cash','JazzCash','EasyPaisa', 'card', 'bank_transfer', 'mobile_wallet', 'cheque'];

function round2(n) {
  return Math.round(n * 100) / 100;
}

function statusFor(paid, payable) {
  if (paid >= payable) return 'Paid';
  if (paid > 0) return 'Partial';
  return 'Unpaid';
}

async function getBookingForUpdate(conn, id) {
  const [rows] = await conn.query(
    'SELECT id, customer_id, payable, paid, booking_status, payment_status FROM bookings WHERE id = ? FOR UPDATE',
    [id]
  );
  return rows[0];
}

function searchWhere(search) {
  if (!search) return { clause: '', params: [] };
  return { clause: 'WHERE c.customer_name LIKE ?', params: [`%${search}%`] };
}

async function findAll({ limit, offset, search, bookingId }) {
  const { clause, params } = searchWhere(search);
  const extra = [];
  if (bookingId) {
    extra.push('bp.booking_id = ?');
    params.push(bookingId);
  }
  const where = [clause.replace(/^WHERE /, '')].concat(extra).filter(Boolean);
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT bp.*, c.customer_name
     FROM booking_payments bp
     JOIN customers c ON c.id = bp.customer_id
     ${whereClause}
     ORDER BY bp.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

async function count({ search, bookingId }) {
  const { clause, params } = searchWhere(search);
  const extra = [];
  if (bookingId) {
    extra.push('bp.booking_id = ?');
    params.push(bookingId);
  }
  const where = [clause.replace(/^WHERE /, '')].concat(extra).filter(Boolean);
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM booking_payments bp JOIN customers c ON c.id = bp.customer_id ${whereClause}`,
    params
  );
  return rows[0].total;
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT bp.*, c.customer_name FROM booking_payments bp JOIN customers c ON c.id = bp.customer_id WHERE bp.id = ?`,
    [id]
  );
  return rows[0];
}

async function list(query) {
  const { page, limit, offset } = getPagination(query);
  const search = query.search?.trim();
  const bookingId = query.booking_id ? Number(query.booking_id) : undefined;
  const [rows, total] = await Promise.all([
    findAll({ limit, offset, search, bookingId }),
    count({ search, bookingId }),
  ]);
  return { rows, meta: buildMeta({ page, limit, total }) };
}

async function get(id) {
  const row = await findById(id);
  if (!row) throw new ApiError(404, 'Booking payment not found');
  return row;
}

async function create(body) {
  if (!body.booking_id) throw new ApiError(422, 'booking_id is required');
  if (!Number.isFinite(body.amount) || body.amount <= 0) throw new ApiError(422, 'amount must be a positive number');
  if (body.payment_method && !VALID_METHODS.includes(body.payment_method)) {
    throw new ApiError(422, `payment_method must be one of: ${VALID_METHODS.join(', ')}`);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const booking = await getBookingForUpdate(conn, body.booking_id);
    if (!booking) throw new ApiError(422, `booking_id ${body.booking_id} does not exist`);
    if (booking.booking_status === 'Rejected') throw new ApiError(400, 'Cannot pay against a rejected booking');
    if (booking.payment_status === 'Paid') throw new ApiError(400, 'This booking is already fully paid');

    const amount = round2(body.amount);
    const remaining = round2(booking.payable - booking.paid);
    if (amount > remaining) throw new ApiError(422, `amount exceeds remaining balance (${remaining})`);

    const customerId = body.customer_id ?? booking.customer_id;
    if (!customerId) throw new ApiError(422, 'customer_id is required (booking has no customer on file)');

    const [result] = await conn.query(
      `INSERT INTO booking_payments (customer_id, booking_id, amount, payment_method, payment_date, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [customerId, body.booking_id, amount, body.payment_method ?? 'cash', body.payment_date ?? new Date(), body.remarks ?? null]
    );
    const paymentId = result.insertId;

    const newPaid = round2(booking.paid + amount);
    const newToBePaid = round2(booking.payable - newPaid);
    const newStatus = statusFor(newPaid, booking.payable);
    await conn.query('UPDATE bookings SET paid = ?, to_be_paid = ?, payment_status = ? WHERE id = ?', [
      newPaid,
      newToBePaid,
      newStatus,
      body.booking_id,
    ]);

    await conn.commit();
    return findById(paymentId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function update(id, body) {
  const payment = await get(id);
  if (body.payment_method && !VALID_METHODS.includes(body.payment_method)) {
    throw new ApiError(422, `payment_method must be one of: ${VALID_METHODS.join(', ')}`);
  }
  await pool.query('UPDATE booking_payments SET payment_date = ?, payment_method = ?, remarks = ? WHERE id = ?', [
    body.payment_date ?? payment.payment_date,
    body.payment_method ?? payment.payment_method,
    body.remarks !== undefined ? body.remarks : payment.remarks,
    id,
  ]);
  return findById(id);
}

async function remove(id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM booking_payments WHERE id = ? FOR UPDATE', [id]);
    const payment = rows[0];
    if (!payment) throw new ApiError(404, 'Booking payment not found');

    const booking = await getBookingForUpdate(conn, payment.booking_id);
    await conn.query('DELETE FROM booking_payments WHERE id = ?', [id]);

    if (booking) {
      const newPaid = round2(booking.paid - payment.amount);
      const newToBePaid = round2(booking.payable - newPaid);
      const newStatus = statusFor(newPaid, booking.payable);
      await conn.query('UPDATE bookings SET paid = ?, to_be_paid = ?, payment_status = ? WHERE id = ?', [
        newPaid,
        newToBePaid,
        newStatus,
        payment.booking_id,
      ]);
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

const controller = {
  list: catchAsync(async (req, res) => {
    const { rows, meta } = await list(req.query);
    sendResponse(res, 200, 'Booking payments fetched successfully', rows, meta);
  }),
  getOne: catchAsync(async (req, res) => {
    sendResponse(res, 200, 'Booking payment fetched successfully', await get(req.params.id));
  }),
  create: catchAsync(async (req, res) => {
    sendResponse(res, 201, 'Booking payment recorded successfully', await create(req.body));
  }),
  update: catchAsync(async (req, res) => {
    sendResponse(res, 200, 'Booking payment updated successfully', await update(req.params.id, req.body));
  }),
  remove: catchAsync(async (req, res) => {
    await remove(req.params.id);
    sendResponse(res, 200, 'Booking payment deleted successfully', null);
  }),
};

const router = express.Router();
router.param('id', (req, res, next, value) => { try { req.params.id = require('../../utils/validation').id(value, 'id'); next(); } catch (error) { next(error); } });

const protectResource = require('../../middleware/protect-resource');
router.use(...protectResource('BOOKINGS'));
router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
