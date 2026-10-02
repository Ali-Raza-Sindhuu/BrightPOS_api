const ApiError = require('../../utils/api-error');
const { getPagination, buildMeta } = require('../../utils/pagination');
const repository = require('./booking-payment.model');

const { pool, getBookingForUpdate, findAll, count, findById, sumPaymentsForBooking } = repository;

const VALID_METHODS = [
  'cash',
  'card',
  'bank_transfer',
  'mobile_wallet',
  'cheque',
];

const round2 = require('../../utils/money').round2;

function statusFor(paid, payable) {
  if (paid >= payable) return 'Paid';
  if (paid > 0) return 'Partial';
  return 'Unpaid';
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
  body={...body,booking_id:require('../../utils/validation').id(body.booking_id,'booking_id'),amount:require('../../utils/money').money(body.amount,'amount',{positive:true})};
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

 
   const amount = round2(body.amount);
const remaining = round2(Number(booking.payable) - Number(await sumPaymentsForBooking(conn, body.booking_id)));
if (amount > remaining) throw new ApiError(422, `amount exceeds remaining balance (${remaining})`);

const customerId = body.customer_id ?? booking.customer_id;
if (Number(customerId) !== Number(booking.customer_id)) throw new ApiError(422, 'Payment customer must match booking customer');
if (!customerId) throw new ApiError(422, 'customer_id is required (booking has no customer on file)');

const [result] = await conn.query(
  `INSERT INTO booking_payments (customer_id, booking_id, amount, payment_method, payment_date, remarks)
   VALUES (?, ?, ?, ?, ?, ?)`,
  [customerId, body.booking_id, amount, body.payment_method ?? 'cash', body.payment_date || new Date(), body.remarks ?? null]
);
const paymentId = result.insertId;

const actualPaid = await sumPaymentsForBooking(conn, body.booking_id);
const newToBePaid = round2(Number(booking.payable) - actualPaid);
const newStatus = statusFor(actualPaid, Number(booking.payable));
await conn.query('UPDATE bookings SET paid = ?, to_be_paid = ?, payment_status = ? WHERE id = ?', [
  actualPaid,
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
  require('../../utils/validation').rejectFields(body, ['amount', 'booking_id', 'customer_id']);
  const payment = await get(id);
  if (body.payment_method && !VALID_METHODS.includes(body.payment_method)) {
    throw new ApiError(422, `payment_method must be one of: ${VALID_METHODS.join(', ')}`);
  }
  const conn=await pool.getConnection();
  try {
    await conn.beginTransaction();await getBookingForUpdate(conn,payment.booking_id);
    const [[current]]=await conn.query('SELECT * FROM booking_payments WHERE id=? FOR UPDATE',[id]);if(!current)throw new ApiError(404,'Booking payment not found');
    await conn.query('UPDATE booking_payments SET payment_date = ?, payment_method = ?, remarks = ? WHERE id = ?',[
      body.payment_date ?? current.payment_date,body.payment_method ?? current.payment_method,body.remarks !== undefined ? body.remarks : current.remarks,id,
    ]);
    await conn.commit();
  }catch(error){await conn.rollback();throw error;}finally{conn.release();}
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
  const actualPaid = await sumPaymentsForBooking(conn, payment.booking_id);
  const newToBePaid = round2(Number(booking.payable) - actualPaid);
  const newStatus = statusFor(actualPaid, Number(booking.payable));
  await conn.query('UPDATE bookings SET paid = ?, to_be_paid = ?, payment_status = ? WHERE id = ?', [
    actualPaid,
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

module.exports = {
  list,
  get,
  create,
  update,
  remove,
};
