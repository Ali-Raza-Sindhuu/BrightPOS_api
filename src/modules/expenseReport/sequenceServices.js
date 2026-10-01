/**
 * Generates gapless-ish, zero-padded sequence numbers (EXP-000001, ...)
 * safely under concurrent requests.
 *
 * MUST be called with a connection that is already inside an open
 * transaction (conn.beginTransaction() already called by the caller).
 * The SELECT ... FOR UPDATE takes a row lock on the counter row, so a
 * second concurrent transaction calling this blocks until the first
 * commits or rolls back -- that's what makes this safe. Without
 * FOR UPDATE, two transactions can both read next_value=5, both insert
 * a voucher numbered EXP-000005, and you get a duplicate (or, worse,
 * a silently skipped/racing UPDATE that loses one of the increments).
 *
 * @param {import('mysql2/promise').PoolConnection} conn - connection with an open transaction
 * @param {string} name - counter name, e.g. 'expense_voucher'
 * @param {{ prefix?: string, pad?: number }} opts
 * @returns {Promise<string>} e.g. "EXP-000042"
 */
async function nextSequenceNumber(conn, name, { prefix = '', pad = 6 } = {}) {
  const [rows] = await conn.query(
    'SELECT next_value FROM sequence_counters WHERE name = ? FOR UPDATE',
    [name]
  );

  if (!rows.length) {
    // Counter row must be seeded by migration. Fail loudly rather than
    // silently starting a second, disconnected sequence at 1.
    throw new Error(`sequence_counters has no row for "${name}" -- run the accounts migration`);
  }

  const value = rows[0].next_value;
  await conn.query('UPDATE sequence_counters SET next_value = next_value + 1 WHERE name = ?', [name]);

  return `${prefix}${String(value).padStart(pad, '0')}`;
}

module.exports = { nextSequenceNumber };