const ApiError = require('../../utils/ApiError');
const { getPagination, buildMeta } = require('../../utils/pagination');
const repository = require('./daybookModel');

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

  const cashIn = data.cash_in ?? 0;
  const cashOut = data.cash_out ?? 0;

  if (cashIn < 0 || cashOut < 0) {
    throw new ApiError(
      422,
      'cash_in and cash_out must be non-negative'
    );
  }

  const previousBalance =
    await repository.getLastBalance();

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
  });

  return repository.findById(id);
}

module.exports = {
  list,
  get,
  create,
};