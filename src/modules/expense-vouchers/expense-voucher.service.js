
const pool = require('../../config/db');
const ApiError = require('../../utils/api-error');


const { getPagination, buildMeta } = require('../../utils/pagination');
const { nextSequenceNumber } = require('../expense-reports/sequence.service');

// Matches daybook.payment_method exactly -- "Online Transfer" from the
// spec maps to 'card' in the UI dropdown label, per your call, rather than
// introducing a 5th value the daybook doesn't understand.
const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'cheque'];
const STATUSES = ['draft', 'posted', 'cancelled'];

// ---- lookups used for validation -------------------------------------

async function getHead(conn, id) {
  const [rows] = await conn.query('SELECT id, head, status FROM expense_heads WHERE id = ?', [id]);
  return rows[0];
}

async function getBusinessUnit(conn, id) {
  const [rows] = await conn.query(
    'SELECT id, name AS business_name, is_active FROM business_units WHERE id = ?',
    [id]
  );
  return rows[0];
}

// ---- daybook posting ---------------------------------------------------

// Locks the last daybook row for the duration of the transaction so two
// concurrent postings can't both read the same previous balance. This is
// the fix for the race condition in the original code: without FOR UPDATE,
// transaction A and B can both SELECT balance=1000, both compute their own
// "1000 - amount", and whichever commits last wins -- the other's cash-out
// is silently missing from the running balance even though both vouchers
// exist. FOR UPDATE serializes daybook writers against each other.
async function postToDaybook(conn, { voucherId, headName, amount, paymentMethod }) {
  await conn.query("SELECT next_value FROM sequence_counters WHERE name='expense_voucher' FOR UPDATE");
  if(paymentMethod!=='cash')return;
  const [rows] = await conn.query('SELECT balance FROM daybook ORDER BY id DESC LIMIT 1 FOR UPDATE');
  const previousBalance = rows.length ? rows[0].balance : 0;
  const money=require('../../utils/money');
  const balance=require('../../utils/exact').decimal(BigInt(money.minor(previousBalance))-BigInt(money.minor(amount)));
  const now = new Date();

  await conn.query(
    `INSERT INTO daybook (date, time, reference_type, reference_id, description, cash_out, cash_in, balance, payment_method)
     VALUES (?, ?, 'expense', ?, ?, ?, 0, ?, ?)`,
    [
      now.toISOString().slice(0, 10),
      now.toTimeString().slice(0, 8),
      voucherId,
      headName ? `Expense: ${headName}` : 'Expense voucher',
      amount,
      balance,
      paymentMethod, // was hardcoded to 'cash' before -- now reflects the voucher's real payment method
    ]
  );
}

// ---- validation ----------------------------------------------------

function assertAmount(amount) {
  require('../../utils/money').money(amount,'amount',{positive:true});
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(422, 'amount must be a positive number');
  }
  // Reject sub-cent precision instead of silently truncating it.
}

async function validateVoucherRefs(conn, { headId, businessUnitId, paymentMethod, status }) {
  if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
    throw new ApiError(422, `payment_method must be one of: ${PAYMENT_METHODS.join(', ')}`);
  }
  if (status && !STATUSES.includes(status)) {
    throw new ApiError(422, `status must be one of: ${STATUSES.join(', ')}`);
  }

  const head = headId ? await getHead(conn, headId) : {head:'Expense'};
  if (!head) throw new ApiError(422, `head_id ${headId} does not exist`);
  if (head.status && head.status !== 'active') throw new ApiError(422, `Expense head "${head.head}" is inactive`);

  const bu = await getBusinessUnit(conn, businessUnitId);
  if (!bu) throw new ApiError(422, `business_unit_id ${businessUnitId} does not exist`);
  if (!bu.is_active) throw new ApiError(422, `Business unit "${bu.business_name}" is inactive`);

  return { head, bu };
}

// ---- reads --------------------------------------------------------

function buildFilters(query) {
  const clauses = [];
  const params = [];
  if (query.business_unit_id) {
    clauses.push('ev.business_unit_id = ?');
    params.push(query.business_unit_id);
  }
  if (query.head_id) {
    clauses.push('ev.head_id = ?');
    params.push(query.head_id);
  }
  if (query.payment_method) {
    clauses.push('ev.payment_method = ?');
    params.push(query.payment_method);
  }
  if (query.status) {
    clauses.push('ev.status = ?');
    params.push(query.status);
  }
  if (query.from) {
    clauses.push('ev.voucher_date >= ?');
    params.push(query.from);
  }
  if (query.to) {
    clauses.push('ev.voucher_date <= ?');
    params.push(query.to);
  }
  if (query.search) {
    clauses.push('(eh.head LIKE ? OR ev.paid_to LIKE ? OR ev.voucher_number LIKE ?)');
    params.push(`%${query.search}%`, `%${query.search}%`, `%${query.search}%`);
  }
  const clause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { clause, params };
}

async function findAll({ limit, offset, filters }) {
  const { clause, params } = buildFilters(filters);
  const [rows] = await pool.query(
    `SELECT ev.*, eh.head
     FROM expense_vouchers ev
     LEFT JOIN expense_heads eh ON eh.id = ev.head_id
     ${clause}
     ORDER BY ev.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

async function count({ filters }) {
  const { clause, params } = buildFilters(filters);
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM expense_vouchers ev LEFT JOIN expense_heads eh ON eh.id = ev.head_id ${clause}`,
    params
  );
  return rows[0].total;
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT ev.*, eh.head FROM expense_vouchers ev LEFT JOIN expense_heads eh ON eh.id = ev.head_id WHERE ev.id = ?`,
    [id]
  );
  return rows[0];
}

async function list(query) {
  const { page, limit, offset } = getPagination(query);
  const filters = { ...query, search: query.search?.trim() };
  const [rows, total] = await Promise.all([findAll({ limit, offset, filters }), count({ filters })]);
  return { rows, meta: buildMeta({ page, limit, total }) };
}

async function get(id) {
  const row = await findById(id);
  if (!row) throw new ApiError(404, 'Expense voucher not found');
  return row;
}

// ---- writes ---------------------------------------------------------

// Existing callers default to posted; explicitly selected drafts never
// touch the daybook -- that's what makes
// "draft vouchers must never affect reports" true by construction rather
// than by a report-side filter someone could forget to apply.
async function create(body, userId) {
  body={...body,business_unit_id:body.business_unit_id || 1,head_id:body.head_id || null,amount:require('../../utils/money').money(body.amount,'amount',{positive:true})};
  userId=userId || body.created_by || null;
  assertAmount(Number(body.amount));
  const status = body.status ?? 'posted';
  if (status === 'cancelled') throw new ApiError(422, 'Cannot create a voucher directly as cancelled');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (body.idempotency_key) {
      const [existing] = await conn.query(
        'SELECT id FROM expense_vouchers WHERE idempotency_key = ?',
        [body.idempotency_key]
      );
      if (existing.length) {
        await conn.rollback();
        return findById(existing[0].id); // same request retried -- return the original, don't duplicate
      }
    }

    const { head } = await validateVoucherRefs(conn, {
      headId: body.head_id,
      businessUnitId: body.business_unit_id,
      paymentMethod: body.payment_method,
      status,
    });

    const voucherNumber = await nextSequenceNumber(conn, 'expense_voucher', { prefix: 'EV-', pad: 6 });
    const voucherDate = body.voucher_date ?? new Date();
    const postedAt = status === 'posted' ? new Date() : null;

    const [result] = await conn.query(
      `INSERT INTO expense_vouchers
        (voucher_number, business_unit_id, head_id, amount, details, voucher_date,
         payment_method, paid_to, reference_number, status, created_by, posted_at, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        voucherNumber,
        body.business_unit_id,
        body.head_id,
        body.amount,
        body.details ?? null,
        voucherDate,
        body.payment_method ?? 'cash',
        body.paid_to ?? null,
        body.reference_number ?? null,
        status,
        userId ?? null,
        postedAt,
        body.idempotency_key ?? null,
      ]
    );
    const voucherId = result.insertId;

    if (status === 'posted') {
      await postToDaybook(conn, {
        voucherId,
        headName: head.head,
        amount: body.amount,
        paymentMethod: body.payment_method ?? 'cash',
      });
    }

    await conn.commit();
    return findById(voucherId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Only draft vouchers can be edited. A posted voucher has already affected
// the daybook and possibly a report someone has already looked at; editing
// it in place would silently change history. Correcting a posted voucher
// should go through cancel + a new voucher, not a PUT.
async function update(id, body) {
  const existing = await get(id);
  if (existing.status !== 'draft') {
    require('../../utils/validation').rejectFields(body,['amount','head_id','business_unit_id','voucher_date','payment_method','status','voucher_number','paid_to','reference_number']);
    await pool.query('UPDATE expense_vouchers SET details=? WHERE id=?',[body.details ?? existing.details,id]);
    return get(id);
  }
  if (body.amount !== undefined) assertAmount(Number(body.amount));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[locked]]=await conn.query('SELECT * FROM expense_vouchers WHERE id=? FOR UPDATE',[id]);
    if(!locked||locked.status!=='draft')throw new ApiError(409,'Voucher is no longer draft');
    await validateVoucherRefs(conn, {
      headId: body.head_id ?? locked.head_id,
      businessUnitId: body.business_unit_id ?? locked.business_unit_id,
      paymentMethod: body.payment_method ?? locked.payment_method,
    });

    const fields = ['head_id', 'business_unit_id', 'amount', 'details', 'voucher_date', 'payment_method', 'paid_to', 'reference_number'];
    const cols = fields.filter((f) => body[f] !== undefined);
    if (cols.length) {
      const setClause = cols.map((c) => `${c} = ?`).join(', ');
      await conn.query(`UPDATE expense_vouchers SET ${setClause} WHERE id = ?`, [...cols.map((c) => body[c]), id]);
    }

    await conn.commit();
    return findById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// The only transition that touches the daybook. Posting is the moment a
// draft becomes a real financial fact.
async function post(id) {
  const existing = await get(id);
  if (existing.status !== 'draft') {
    throw new ApiError(409, `Cannot post a ${existing.status} voucher -- only draft vouchers can be posted`);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[locked]]=await conn.query('SELECT * FROM expense_vouchers WHERE id=? FOR UPDATE',[id]);
    if(!locked||locked.status!=='draft')throw new ApiError(409,'Voucher already posted or cancelled');
    const head = await getHead(conn, locked.head_id);

    await postToDaybook(conn, {
      voucherId: id,
      headName: head?.head,
      amount: locked.amount,
      paymentMethod: locked.payment_method,
    });
    await conn.query('UPDATE expense_vouchers SET status = ?, posted_at = ? WHERE id = ?', ['posted', new Date(), id]);

    await conn.commit();
    return findById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Cancelling is only allowed pre-posting. A posted voucher has already
// created a daybook entry; cancelling it would need a reversing daybook
// entry to keep the ledger honest, which is out of scope for this
// (draft/posted/cancelled) workflow -- reverse a posted voucher with an
// offsetting new voucher instead, same as the daybook module's own
// append-only convention.
async function cancel(id) {
  const existing = await get(id);
  if (existing.status !== 'draft') {
    throw new ApiError(409, `Cannot cancel a ${existing.status} voucher -- only draft vouchers can be cancelled`);
  }
  const [result]=await pool.query("UPDATE expense_vouchers SET status='cancelled' WHERE id=? AND status='draft'",[id]);
  if(result.affectedRows!==1)throw new ApiError(409,'Voucher already posted or cancelled');
  return findById(id);
}

// No hard delete: a voucher is a financial document. Draft/cancelled
// vouchers are removed by cancelling; posted vouchers are permanent.


module.exports = { list, get, create, update, post, cancel };
