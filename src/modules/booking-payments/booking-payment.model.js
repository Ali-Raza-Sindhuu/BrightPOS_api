const pool = require('../../config/db');

async function getBookingForUpdate(conn, id) {
  const [rows] = await conn.query(
    'SELECT id, customer_id, payable, paid, booking_status, payment_status FROM bookings WHERE id = ? FOR UPDATE',
    [id]
  );
  if (rows[0]) {
    await require('../../utils/counter-booking').assertLegacyBooking(conn,id);
    const [[link]] = await conn.query('SELECT invoice_id FROM booking_invoice_links WHERE booking_id = ?', [id]);
    if (link) throw new (require('../../utils/api-error'))(409, 'Booking converted; use invoice payments');
  }
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

async function sumPaymentsForBooking(conn, bookingId) {
  const [rows] = await conn.query(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM booking_payments WHERE booking_id = ?',
    [bookingId]
  );
  return Number(rows[0].total);
}

module.exports = {
  pool,
  getBookingForUpdate,
  findAll,
  count,
  findById,
  sumPaymentsForBooking
};
