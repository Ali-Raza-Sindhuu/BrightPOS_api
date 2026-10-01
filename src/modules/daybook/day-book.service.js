const ApiError = require('../../utils/api-error');
const { getPagination, buildMeta } = require('../../utils/pagination');
const repository = require('./day-book.model');

const REFERENCE_TYPES = [
  'sale',
  'purchase',
  'booking_payment',
  'expense',
  'refund',
  'opening_balance',
  'closing_balance',
];

async function list(query) {
  const { page, limit, offset } = getPagination(query);

  const search = query.search?.trim();

  const [rows, total] = await Promise.all([
    repository.findAll({
      limit,
      offset,
      search,
      from: query.from,
      to: query.to,
    }),
    repository.count({
      search,
      from: query.from,
      to: query.to,
    }),
  ]);

  return {
    rows,
    meta: buildMeta({
      page,
      limit,
      total,
    }),
  };
}

async function get(id) {
  const row = await repository.findById(id);

  if (!row) {
    throw new ApiError(404, 'Daybook entry not found');
  }

  return row;
}

async function create(data) {
  if (!data.description?.trim()) {
    throw new ApiError(422, 'description is required');
  }

  if (
    data.reference_type &&
    !REFERENCE_TYPES.includes(data.reference_type)
  ) {
    throw new ApiError(
      422,
      `reference_type must be one of: ${REFERENCE_TYPES.join(', ')}`
    );
  }

  const cashIn = require('../../utils/money').money(data.cash_in ?? 0, 'cash_in');
  const cashOut = require('../../utils/money').money(data.cash_out ?? 0, 'cash_out');

  if (cashIn < 0 || cashOut < 0) {
    throw new ApiError(
      422,
      'cash_in and cash_out must be non-negative'
    );
  }

  const pool = require('../../config/db');
  const conn = await pool.getConnection();
  try {
  await conn.beginTransaction();
  // Share the existing voucher-counter lock with expense posting so even the
  // first cash entry has a stable lock before reading its running balance.
  await conn.query("SELECT next_value FROM sequence_counters WHERE name = 'expense_voucher' FOR UPDATE");
  const previousBalance = await repository.getLastBalance(conn);

  const balance =
    Math.round(
      (Number(previousBalance) +
        Number(cashIn) -
        Number(cashOut)) *
        100
    ) / 100;

  const now = new Date();

  const id = await repository.insertEntry({
    date: data.date ?? now.toISOString().slice(0, 10),
    time: data.time ?? now.toTimeString().slice(0, 8),
    reference_type: data.reference_type,
    reference_id: data.reference_id,
    description: data.description,
    cash_out: cashOut,
    cash_in: cashIn,
    balance,
    payment_method: data.payment_method,
    created_by: data.created_by,
  }, conn);
  await conn.commit();
  return repository.findById(id);
  } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
}

module.exports = {
  list,
  get,
  create,
};