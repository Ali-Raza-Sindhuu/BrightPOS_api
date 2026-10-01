const test = require('node:test');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const crypto = require('node:crypto');

process.env.POS_ENV_FILE ||= '.env.docker';
const { getDatabaseOptions } = require('../../src/config/database');
const { loadMigrations, runMigrations } = require('../../scripts/lib/migrations');
const { validateSchema, schemaContract } = require('../../scripts/lib/schema');
const migrations = loadMigrations();
const log = () => {};
const names = ['brightpos_migration_test', 'brightpos_migration_failure', 'brightpos_migration_history'];
let conn, failure, history;

async function clearTestSchema(connection) {
  const [[{ database }]] = await connection.query('SELECT DATABASE() AS `database`');
  assert.ok(names.includes(database), `Refusing cleanup of ${database}`);
  const [tables] = await connection.query('SHOW TABLES');
  const remaining = new Set(tables.map(row => Object.values(row)[0]));
  const [keys] = await connection.query('SELECT TABLE_NAME, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL');
  while (remaining.size) {
    const leaves = [...remaining].filter(name => !keys.some(key => key.REFERENCED_TABLE_NAME === name && remaining.has(key.TABLE_NAME)));
    assert.ok(leaves.length, 'Unexpected circular schema dependency; foreign-key checks stay enabled');
    for (const name of leaves) {
      assert.match(name, /^\w+$/);
      await connection.query(`DROP TABLE \`${name}\``);
      remaining.delete(name);
    }
  }
}

test.before(async () => {
  const options = getDatabaseOptions();
  assert.ok(['127.0.0.1', 'localhost'].includes(options.host) && options.port === 3307 && options.user === 'brightpos' && !options.ssl,
    'Database tests only operate on the local Docker service at localhost:3307 with the brightpos test user');
  [conn, failure, history] = await Promise.all(names.map(database => mysql.createConnection({ ...options, database })));
  for (const connection of [conn, failure, history]) await clearTestSchema(connection);
});
test.after(async () => {
  // Retain disposable schemas for inspection; next test run cleans only these
  // explicitly named databases. brightpos_local is never changed by tests.
  await Promise.all([conn, failure, history].filter(Boolean).map(connection => connection.end()));
});

test('dry-run/status do not create tables or migration history', async () => {
  for (const options of [{ dryRun: true }, { status: true }]) {
    const result = await runMigrations(conn, migrations, { ...options, log });
    assert.equal(result.executed, 0);
    assert.equal(result.pending, migrations.length);
    assert.equal((await conn.query('SHOW TABLES'))[0].length, 0);
  }
});

test('fresh database applies ordered baseline with strict SQL and FK checks enabled', async () => {
  const [[runtime]] = await conn.query('SELECT @@SESSION.sql_mode AS mode, @@SESSION.foreign_key_checks AS checks');
  assert.match(runtime.mode, /STRICT_TRANS_TABLES/);
  assert.match(runtime.mode, /ONLY_FULL_GROUP_BY/);
  assert.equal(Number(runtime.checks), 1);
  const result = await runMigrations(conn, migrations, { log });
  assert.equal(result.executed, migrations.length);
  assert.equal(result.pending, 0);
  const report = await validateSchema(conn, migrations);
  assert.equal(report.tables, schemaContract(migrations).length);
  assert.ok(report.foreignKeys > 50);
});

test('repeat migration is a no-op and preserves bootstrap rows', async () => {
  assert.equal((await runMigrations(conn, migrations, { log })).executed, 0);
  const [[settings]] = await conn.query('SELECT COUNT(*) AS n FROM access_control_settings');
  const [[units]] = await conn.query('SELECT COUNT(*) AS n FROM business_units');
  assert.equal(Number(settings.n), 1);
  assert.equal(Number(units.n), 1);
});

test('schema supports catalog, branch inventory, repeated signed movements and decimal quantities', async () => {
  await conn.query("INSERT INTO item_units (unit_name) VALUES ('Piece')");
  await conn.query("INSERT INTO categories (category_name) VALUES ('Retail')");
  await conn.query("INSERT INTO sub_categories (category_id, sub_category_name) VALUES (1, 'General')");
  await conn.query("INSERT INTO item_types (type_name) VALUES ('Stocked')");
  await conn.query("INSERT INTO manufacturers (manufacturer_id, manufacturer_name) VALUES ('M1', 'Fixture Manufacturer')");
  await conn.query("INSERT INTO shelve_locations (shelf_name_code) VALUES ('A1')");
  await conn.query("INSERT INTO suppliers (supplier_name, opening_balance) VALUES ('Fixture Supplier', 50.00)");
  await conn.query("INSERT INTO customers (customer_name, previous_balance) VALUES ('Fixture Customer', 20.00)");
  await conn.query("INSERT INTO item_details (item_name, label_barcode, item_category_id, item_subcategory_id, item_type_id, manufacturer_id, supplier_id, shelve_location_id, item_unit_id, sale_price) VALUES ('Fixture Item', '123456', 1, 1, 1, 1, 1, 1, 1, 10.00)");
  await conn.query("INSERT INTO business_units (name, code, type) VALUES ('Fixture Shop', 'SHOP', 'Shop')");
  await conn.query('INSERT INTO inventory (item_id, unit_id, business_unit_id, quantity) VALUES (1, 1, 1, 10.50), (1, 1, 2, 2.25)');
  await conn.query("INSERT INTO item_stock (business_unit_id, item_id, type, qty, ref_type, ref_id) VALUES (1, 1, 'OPENING', 10.50, 'OPENING_STOCK', 1), (1, 1, 'SALE', -1.25, 'SALE_INVOICE', 1), (1, 1, 'SALE', -2.00, 'SALE_INVOICE', 2)");
  const [[row]] = await conn.query('SELECT COUNT(*) AS n, SUM(qty) AS qty FROM item_stock');
  assert.equal(Number(row.n), 3);
  assert.equal(row.qty, '7.25');
  await assert.rejects(conn.query('INSERT INTO inventory (item_id, unit_id, business_unit_id) VALUES (1, 1, 1)'), { code: 'ER_DUP_ENTRY' });
  await assert.rejects(conn.query('UPDATE inventory SET quantity = -1 WHERE business_unit_id = 1'), { code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
  await assert.rejects(conn.query('INSERT INTO inventory (item_id, unit_id, business_unit_id) VALUES (9999, 1, 1)'), { code: 'ER_NO_REFERENCED_ROW_2' });
});

test('receipt schema accepts partial receipts and complete line details', async () => {
  await conn.query('INSERT INTO purchases (supplier_id, business_unit_id, sub_total, payable, paid) VALUES (1, 1, 100.00, 100.00, 20.00)');
  await conn.query('INSERT INTO purchase_items (purchase_id, item_id, qty, purchase_price, sale_price, total) VALUES (1, 1, 10.50, 5.00, 10.00, 52.50)');
  await conn.query("INSERT INTO goods_receipts (purchase_id, business_unit_id, grn_no, grn_date, status) VALUES (1, 1, 'GRN-1', CURRENT_DATE, 'partial')");
  await conn.query("INSERT INTO goods_receipt_items (grn_id, purchase_item_id, item_id, purchase_price, sale_price, received_qty, accepted_qty, rejected_qty, condition_note) VALUES (1, 1, 1, 5.00, 10.00, 4.25, 4.00, 0.25, 'Fixture receipt')");
  const [[row]] = await conn.query('SELECT accepted_qty, rejected_qty, purchase_item_id FROM goods_receipt_items');
  assert.equal(row.accepted_qty, '4.00');
  assert.equal(row.purchase_item_id, 1);
});

test('sale/return/payment and booking schemas support current insert shapes', async () => {
  await conn.query("INSERT INTO sale_invoices (business_unit_id, customer_id, receipt_no, sub_total, payable) VALUES (1, NULL, 'INV-1', 15.00, 15.00)");
  await conn.query('INSERT INTO sale_invoice_items (invoice_id, item_id, qty, unit_price, total_price) VALUES (1, 1, 1.50, 10.00, 15.00)');
  await conn.query("INSERT INTO customer_payments (invoice_id, customer_id, amount, payment_date) VALUES (1, NULL, 15.00, NOW())");
  await conn.query('INSERT INTO sale_returns (sale_invoice_id, customer_id, return_date, total_amount) VALUES (1, NULL, NOW(), 5.00)');
  await conn.query('INSERT INTO sale_return_items (sale_return_id, item_id, qty, price, total) VALUES (1, 1, 0.50, 10.00, 5.00)');
  await conn.query('INSERT INTO supplier_payments (supplier_id, purchase_id, amount) VALUES (1, 1, 20.00)');
  await conn.query('INSERT INTO purchase_returns (purchase_id, supplier_id, return_date, total_amount) VALUES (1, 1, CURRENT_DATE, 5.00)');
  await conn.query('INSERT INTO purchase_return_items (purchase_return_id, item_id, qty, purchase_price, total) VALUES (1, 1, 1.00, 5.00, 5.00)');
  await conn.query('INSERT INTO bookings (business_unit_id, customer_id, booking_date, sub_total, payable) VALUES (1, 1, CURRENT_DATE, 15.00, 15.00)');
  await conn.query('INSERT INTO booking_items (booking_id, item_id, qty, unit_price, total_price) VALUES (1, 1, 1.50, 10.00, 15.00)');
  await conn.query("INSERT INTO booking_payments (booking_id, customer_id, amount, payment_date) VALUES (1, 1, 5.00, NOW())");
  const [[row]] = await conn.query('SELECT booking_status, business_unit_id FROM bookings');
  assert.equal(row.booking_status, 'Pending');
  assert.equal(row.business_unit_id, 1);
});

test('security, expiry, stock and expense schemas support repository fields', async () => {
  await conn.query("INSERT INTO access_groups (code, name) VALUES ('ADMIN', 'Administrator')");
  await conn.query("INSERT INTO users (full_name, username, email, password_hash, group_id) VALUES ('Fixture User', 'fixture', NULL, 'test-hash', 1)");
  await conn.query("INSERT INTO permissions (permission_key, module) VALUES ('ACCESS.SALES.READ', 'Sales')");
  await conn.query('INSERT INTO group_permissions (group_id, permission_id) VALUES (1, 1)');
  await conn.query("INSERT INTO actions (name, code) VALUES ('Read', 'READ')");
  await conn.query("INSERT INTO modules (name, code) VALUES ('Sales', 'SALES')");
  await conn.query("INSERT INTO resources (module_id, name, code) VALUES (1, 'Invoices', 'INVOICES')");
  await conn.query("INSERT INTO access_ip_logs (user_id, ip_address) VALUES (1, '127.0.0.1')");
  await conn.query("INSERT INTO expiry_tags (item_id, expiry_date, manufacturer_date, description, receipt_no, item_code, purchase_price, sale_price) VALUES (1, '2027-01-01', '2026-01-01', 'Fixture', 'GRN-1', 'SKU1', 5, 10)");
  await conn.query("INSERT INTO customer_returns (source_type, source_id, customer_id, original_subtotal, original_total, refund_amount, final_refund) VALUES ('sale', 1, 1, 15, 15, 5, 5)");
  await conn.query('INSERT INTO opening_stock (business_unit_id, stock_date, created_by) VALUES (1, CURRENT_DATE, 1)');
  await conn.query('INSERT INTO opening_stock_items (opening_stock_id, item_id, qty) VALUES (1, 1, 0.50)');
  await conn.query('INSERT INTO reorders (item_id, reorder_qty) VALUES (1, 1.50)');
  await conn.query('INSERT INTO stock_snapshots (closing_date) VALUES (CURRENT_DATE)');
  await conn.query('INSERT INTO stock_snapshot_items (snapshot_id, item_id, calc_closing) VALUES (1, 1, 7.25)');
  await conn.query('INSERT INTO stock_transfers (from_unit_id, to_unit_id, transfer_date) VALUES (1, 2, CURRENT_DATE)');
  await conn.query('INSERT INTO stock_transfer_items (transfer_id, item_id, quantity) VALUES (1, 1, 0.50)');
  await conn.query("INSERT INTO expense_heads (head, expense_code) VALUES ('Rent', 'EH-1')");
  // Current voucher API provides only these four fields: nullable advanced
  // metadata is deliberate until the subsequent application phase supplies it.
  await conn.query("INSERT INTO expense_vouchers (head_id, amount, details, voucher_date) VALUES (1, 100.00, 'Fixture rent', CURRENT_DATE)");
  await conn.query("INSERT INTO daybook (date, time, description, cash_out, created_by) VALUES (CURRENT_DATE, CURRENT_TIME, 'Fixture expense', 100.00, 1)");
  assert.ok((await validateSchema(conn)).tables > 40);
});

test('foreign keys reject orphan references and retain referenced master data', async () => {
  await assert.rejects(conn.query('DELETE FROM item_units WHERE id = 1'), { code: 'ER_ROW_IS_REFERENCED_2' });
  await assert.rejects(conn.query('INSERT INTO goods_receipt_items (grn_id, purchase_item_id, item_id) VALUES (1, 99999, 1)'), { code: 'ER_NO_REFERENCED_ROW_2' });
  await assert.rejects(conn.query('INSERT INTO booking_payments (booking_id, customer_id, amount) VALUES (99999, 1, 1)'), { code: 'ER_NO_REFERENCED_ROW_2' });
  await assert.rejects(conn.query('INSERT INTO stock_transfers (from_unit_id, to_unit_id, transfer_date) VALUES (1, 1, CURRENT_DATE)'), { code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
});

test('transaction rollback and child cascade work with enforced FKs', async () => {
  await conn.beginTransaction();
  await conn.query('UPDATE inventory SET quantity = quantity + 5 WHERE business_unit_id = 1');
  await conn.rollback();
  const [[row]] = await conn.query('SELECT quantity FROM inventory WHERE business_unit_id = 1');
  assert.equal(row.quantity, '10.50');
  await conn.query('DELETE FROM stock_transfers WHERE id = 1');
  assert.equal(Number((await conn.query('SELECT COUNT(*) AS n FROM stock_transfer_items'))[0][0].n), 0);
});

test('schema drift is detected rather than trusting migration history', async () => {
  await conn.query('ALTER TABLE expiry_tags DROP INDEX idx_expiry_tags_date');
  await assert.rejects(validateSchema(conn), /idx_expiry_tags_date/);
  await conn.query('ALTER TABLE expiry_tags ADD KEY idx_expiry_tags_date (expiry_date)');
  await conn.query('ALTER TABLE suppliers MODIFY opening_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00');
  await assert.rejects(validateSchema(conn), /suppliers.opening_balance/);
  await conn.query('ALTER TABLE suppliers MODIFY opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00');
  await validateSchema(conn);
});

test('changed checksum and nonconsecutive migration history are rejected', async () => {
  const changed = migrations.map(migration => ({ ...migration }));
  changed[0].checksum = '0'.repeat(64);
  await assert.rejects(runMigrations(conn, changed, { log }), /Checksum mismatch/);
  await conn.query("INSERT INTO _schema_migrations (version, filename, checksum, state) VALUES (999, '0999_unknown.sql', ?, 'applied')", ['0'.repeat(64)]);
  await assert.rejects(runMigrations(conn, migrations, { log }), /Unknown or nonconsecutive/);
  await conn.query('DELETE FROM _schema_migrations WHERE version = 999');
});

test('concurrent runner lock prevents interleaved schema changes', async () => {
  const options = getDatabaseOptions();
  const other = await mysql.createConnection({ ...options, database: names[0] });
  const key = `brightpos:migrate:${crypto.createHash('sha256').update(names[0]).digest('hex').slice(0, 32)}`;
  try {
    await conn.query('SELECT GET_LOCK(?, 0)', [key]);
    await assert.rejects(runMigrations(other, migrations, { log, lockTimeout: 0 }), /holds the database lock/);
  } finally { await conn.query('SELECT RELEASE_LOCK(?)', [key]); await other.end(); }
});

test('failed migration stays running and is never silently marked applied', async () => {
  const broken = [...migrations, { version: 55, filename: '0055_invalid.sql', sql: 'ALTER TABLE missing_table ADD bad_column INT', checksum: 'a'.repeat(64) }];
  await assert.rejects(runMigrations(failure, broken, { log }), /0055_invalid.sql failed/);
  const [[row]] = await failure.query('SELECT state FROM _schema_migrations WHERE version = 55');
  assert.equal(row.state, 'running');
  await assert.rejects(runMigrations(failure, broken, { log }), /Interrupted\/failed/);
});

test('legacy and nonempty untracked databases are refused without modification', async () => {
  await history.query('CREATE TABLE old_business_data (id INT PRIMARY KEY)');
  await history.query('INSERT INTO old_business_data VALUES (7)');
  await assert.rejects(runMigrations(history, migrations, { log }), /not empty/);
  await history.query('CREATE TABLE _migrations (filename VARCHAR(255))');
  await assert.rejects(runMigrations(history, migrations, { log }), /Legacy/);
  assert.equal((await history.query('SELECT id FROM old_business_data'))[0][0].id, 7);
  assert.equal((await history.query('SHOW TABLES'))[0].length, 2);
});
