const ApiError = require('../../utils/api-error');
const { getPagination, buildMeta } = require('../../utils/pagination');
const repository = require('./expense-voucher.model');

async function list(query) {
  const { page, limit, offset } = getPagination(query);

  const search = query.search?.trim();

  const [rows, total] = await Promise.all([
    repository.findAll({ limit, offset, search }),
    repository.count({ search }),
  ]);

  return {
    rows,
    meta: buildMeta({ page, limit, total }),
  };
}

async function get(id) {
  const row = await repository.findById(id);

  if (!row) {
    throw new ApiError(404, 'Expense voucher not found');
  }

  return row;
}

async function create(body) {
  body = { ...body, amount: require('../../utils/money').money(body.amount, 'amount', { positive: true }) };
  if (!Number.isFinite(body.amount) || body.amount <= 0) {
    throw new ApiError(422, 'amount must be a positive number');
  }

  const conn = await repository.pool.getConnection();

  try {
    await conn.beginTransaction();

    const [[counter]] = await conn.query("SELECT next_value FROM sequence_counters WHERE name = 'expense_voucher' FOR UPDATE");
    if (!counter) throw new ApiError(500, 'Voucher counter not initialized');
    body.voucher_number = 'EV-' + String(counter.next_value).padStart(6, '0');
    await conn.query("UPDATE sequence_counters SET next_value = next_value + 1 WHERE name = 'expense_voucher'");
    let headName = null;

    if (body.head_id) {
      const head = await repository.getHeadById(conn, body.head_id);

      if (!head) {
        throw new ApiError(
          422,
          `head_id ${body.head_id} does not exist`
        );
      }

      headName = head.head;
    }

    const voucherDate = body.voucher_date ?? new Date();

    const voucherId = await repository.insertVoucher(conn, {
      ...body,
      voucher_date: voucherDate,
    });

    const previousBalance =
      await repository.getLastBalance(conn);

    const balance =
      Math.round(
        (Number(previousBalance) -
          Number(body.amount)) *
          100
      ) / 100;

    const now = new Date();

    await repository.insertDaybook(conn, {
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 8),
      reference_id: voucherId,
      description: headName
        ? `Expense: ${headName}`
        : 'Expense voucher',
      cash_out: body.amount,
      balance,
    });

    await conn.commit();

    return repository.findById(voucherId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function update(id, body) {
  const current = await get(id);
  require('../../utils/validation').rejectFields(body, ['amount', 'head_id', 'business_unit_id', 'voucher_date', 'status', 'voucher_number']);
  await repository.pool.query('UPDATE expense_vouchers SET details = ? WHERE id = ?', [body.details ?? current.details, id]);
  return get(id);
}

module.exports = {
  list,
  get,
  create,
  update,
};