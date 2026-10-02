const test = require('node:test');
const assert = require('node:assert/strict');
require('../helpers/local-database.cjs').configureLocalDatabase();
const mysql = require('mysql2/promise');
const { getDatabaseOptions } = require('../../src/config/database');
const { loadMigrations, runMigrations } = require('../../scripts/lib/migrations');
const { validateSchema } = require('../../scripts/lib/schema');
const pool = require('../../src/config/db');
const purchases = require('../../src/modules/purchases/purchase.service');
const receipts = require('../../src/modules/goods-receipts/goods-receipt.service');
const sales = require('../../src/modules/sales/sale.service');
const payments = require('../../src/modules/customer-payments/customer-payment.service');
const supplierPayments = require('../../src/modules/supplier-payments/supplier-payment.service');
const returns = require('../../src/modules/sale-returns/sale-return.service');
const purchaseReturns = require('../../src/modules/purchase-returns/purchase-return.service');
const bookings = require('../../src/modules/bookings/booking.service');
const transfers = require('../../src/modules/stock-transfers/stock-transfer.service');
const openings = require('../../src/modules/opening-stock/opening-stock.service');
const snapshots = require('../../src/modules/stock-snapshots/stock-snapshot.service');
const customers = require('../../src/modules/customers/customer.service');
const vouchers = require('../../src/modules/expense-vouchers/expense-voucher.service');
let conn, server;
let purchase, invoice;
const stock = async (item = 1, location = 1) => Number((await conn.query('SELECT COALESCE(SUM(quantity),0) AS n FROM inventory WHERE item_id = ? AND business_unit_id = ?', [item, location]))[0][0].n);
const rejected = (promise, status) => assert.rejects(promise, error => error.statusCode === status);

test.before(async () => {
  const options = getDatabaseOptions();
  assert.ok(['127.0.0.1', 'localhost'].includes(options.host) && !options.ssl && options.database === 'brightpos_migration_test', 'Refusing to clear a database other than the dedicated local Docker test schema');
  conn = await mysql.createConnection(options);
  const [tables] = await conn.query('SHOW TABLES');
  const remaining = new Set(tables.map(row => Object.values(row)[0]));
  const [keys] = await conn.query('SELECT TABLE_NAME, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL');
  while (remaining.size) {
    const leaves = [...remaining].filter(name => !keys.some(key => key.REFERENCED_TABLE_NAME === name && remaining.has(key.TABLE_NAME)));
    assert.ok(leaves.length);
    for (const name of leaves) { assert.match(name, /^\w+$/); await conn.query(`DROP TABLE \`${name}\``); remaining.delete(name); }
  }
  await runMigrations(conn, loadMigrations(), { log: () => {} });
  await conn.query("INSERT INTO business_units (name,code,type) VALUES ('Shop','SHOP','SHOP')");
  await conn.query("INSERT INTO item_units (unit_name) VALUES ('Each')");
  await conn.query("INSERT INTO suppliers (supplier_name) VALUES ('Supplier')");
  await conn.query("INSERT INTO customers (customer_name,previous_balance) VALUES ('Customer',0), ('Other',0)");
  await conn.query("INSERT INTO item_details (item_name,item_unit_id,purchase_price,sale_price) VALUES ('Item',1,5,10), ('Booking Item',1,5,10), ('Opening Item',1,5,10)");
  await openings.createOpeningStock({ business_unit_id: 1, stock_date: '2026-10-01', items: [{ item_id: 1, qty: 100 }, { item_id: 2, qty: 20 }, { item_id: 3, qty: 5 }] });
});
test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (conn) await conn.end();
  await pool.end();
});

test('purchase creation/detail work under strict SQL and server totals reject invalid inputs', async () => {
  purchase = await purchases.create({ supplier_id: 1, business_unit_id: 1, invoice_no: 'TEST-PO', paid: 20, items: [{ item_id: 1, qty: 10, purchase_price: 5 }] });
  assert.equal(Number(purchase.payable), 50);
  assert.equal(Number(purchase.paid), 20);
  assert.match(purchase.item_names, /Item/);
  await rejected(purchases.update(purchase.id, { paid: 30 }), 422);
  await rejected(purchases.create({ supplier_id: 1, business_unit_id: 1, discount_amount: 99, items: [{ item_id: 1, qty: 1, purchase_price: 5 }] }), 422);
  await rejected(purchases.create({ supplier_id: 1, business_unit_id: 1, items: [{ item_id: 1, qty: 'NaN', purchase_price: 5 }] }), 422);
});
test('supplier payment decimal sums synchronize stored purchase totals and reversal', async () => {
  const p = await supplierPayments.createPayment({ supplier_id: 1, purchase_id: purchase.id, amount: 30 });
  const fresh = await purchases.getOne(purchase.id);
  assert.equal(fresh.payment_status, 'paid');
  assert.equal(Number(fresh.paid), 50);
  await rejected(supplierPayments.createPayment({ supplier_id: 1, purchase_id: purchase.id, amount: 1 }), 422);
  await supplierPayments.deletePayment(p.id);
  assert.equal(Number((await purchases.getOne(purchase.id)).paid), 20);
});
test('two partial receipts preserve ordered quantities and block structural purchase edits/deletion', async () => {
  const [[grn]] = await conn.query('SELECT id FROM goods_receipts WHERE purchase_id = ?', [purchase.id]);
  const line = purchase.items[0];
  await receipts.receiveGrn(grn.id, { items: [{ purchase_item_id: line.id, received_qty: 4 }] });
  await rejected(purchases.update(purchase.id, { business_unit_id: 2 }), 409);
  await rejected(purchases.remove(purchase.id), 409);
  const complete = await receipts.receiveGrn(grn.id, { items: [{ purchase_item_id: line.id, received_qty: 6 }] });
  assert.equal(Number(complete.total_ordered_qty), 10);
  assert.equal(Number(complete.total_received_qty), 10);
  assert.equal(Number(complete.total_outstanding_qty), 0);
  assert.equal(await stock(), 110);
});
test('receipt rejects foreign/duplicate lines and does not move stock', async () => {
  const po = await purchases.create({ supplier_id: 1, business_unit_id: 1, items: [{ item_id: 1, qty: 1, purchase_price: 5 }] });
  const [[grn]] = await conn.query('SELECT id FROM goods_receipts WHERE purchase_id = ?', [po.id]);
  await rejected(receipts.receiveGrn(grn.id, { items: [{ purchase_item_id: purchase.items[0].id, received_qty: 1 }] }), 422);
  await rejected(receipts.receiveGrn(grn.id, { items: [{ purchase_item_id: po.items[0].id, received_qty: 1 }, { purchase_item_id: po.items[0].id, received_qty: 1 }] }), 422);
  assert.equal(await stock(), 110);
});
test('fractional sale and incremental decimal payments reach paid exactly once', async () => {
  invoice = await sales.createSale({ business_unit_id: 1, customer_id: 1, given_amount: 20, items: [{ item_id: 1, qty: 1.5, unit_price: 20 }] });
  assert.equal(Number(invoice.payable), 30);
  await payments.createPayment({ customer_id: 1, invoice_id: invoice.id, amount: 10 });
  assert.equal((await sales.getSale(invoice.id)).status, 'paid');
  await rejected(payments.createPayment({ customer_id: 1, invoice_id: invoice.id, amount: 0.01 }), 422);
  assert.equal(await stock(), 108.5);
});
test('customer general payments preserve opening and summary agrees with ledger', async () => {
  const payment = await payments.createPayment({ customer_id: 1, amount: 10 });
  const customer = await customers.getCustomer(1);
  assert.equal(Number(customer.previous_balance), 0);
  assert.equal(Number(customer.current_balance), -10);
  const ledger = await require('../../src/modules/customer-ledger/customer-ledger.routes').getCustomerLedgerData(1);
  assert.equal(ledger.closingBalance, -10);
  await payments.deletePayment(payment.id);
  assert.equal(Number((await customers.getCustomer(1)).current_balance), 0);
  await rejected(customers.updateCustomer(1, { customer_name: 'Customer', previous_balance: 100 }), 409);
});
test('discounted duplicate-line returns allocate original net credit and reject deletion', async () => {
  const sale = await sales.createSale({ business_unit_id: 1, customer_id: 1, discount: 10, items: [{ item_id: 1, qty: 1, unit_price: 10 }, { item_id: 1, qty: 1, unit_price: 20 }] });
  const first = await returns.createReturn({ sale_invoice_id: sale.id, items: [{ item_id: 1, qty: 1, price: 9999 }] });
  const second = await returns.createReturn({ sale_invoice_id: sale.id, items: [{ item_id: 1, qty: 1 }] });
  assert.equal(Number(first.total_amount) + Number(second.total_amount), 20);
  assert.equal(Number((await customers.getCustomer(1)).current_balance), 0);
  assert.equal((await sales.getSale(sale.id)).status, 'paid');
  await rejected(returns.createReturn({ sale_invoice_id: sale.id, items: [{ item_id: 1, qty: 0.01 }] }), 409);
  await rejected(returns.deleteReturn(first.id), 409);
});
test('concurrent sales cannot oversell and failed sale rolls back header/ledger', async () => {
  const before = await stock(3);
  const results = await Promise.allSettled([1, 2].map(() => sales.createSale({ business_unit_id: 1, items: [{ item_id: 3, qty: 4, unit_price: 5 }] })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected' && r.reason.statusCode === 409).length, 1);
  assert.equal(await stock(3), before - 4);
});
test('booking completion aggregates duplicate lines after stock availability changes', async () => {
  const booking = await bookings.createBooking({ business_unit_id: 1, customer_id: 1, booking_date: '2026-10-01', items: [{ item_id: 2, qty: 6 }, { item_id: 2, qty: 6 }] });
  await sales.createSale({ business_unit_id: 1, items: [{ item_id: 2, qty: 10 }] });
  await rejected(bookings.completeBooking(booking.id), 409);
  assert.equal((await bookings.getBooking(booking.id)).booking_status, 'Pending');
  assert.equal(await stock(2), 10);
});
test('booking conversion carries advances once, charges once and is idempotent', async () => {
  const booking = await bookings.createBooking({ business_unit_id: 1, customer_id: 1, booking_date: '2026-10-01', initial_payment: 5, items: [{ item_id: 2, qty: 2 }] });
  const before = await stock(2);
  const beforeBalance = Number((await customers.getCustomer(1)).current_balance);
  const sale = await sales.convertBooking(booking.id);
  const repeat = await sales.convertBooking(booking.id);
  assert.equal(sale.id, repeat.id);
  assert.equal(Number(sale.paid), 5);
  assert.equal(await stock(2), before - 2);
  assert.equal(Number((await customers.getCustomer(1)).current_balance), beforeBalance);
  const [[payment]] = await conn.query('SELECT id FROM booking_payments WHERE booking_id = ?', [booking.id]);
  await rejected(require('../../src/modules/booking-payments/booking-payment.service').remove(payment.id), 409);
});
test('completed booking conversion does not deduct stock a second time', async () => {
  const booking = await bookings.createBooking({ business_unit_id: 1, customer_id: 1, booking_date: '2026-10-01', items: [{ item_id: 2, qty: 1 }] });
  await bookings.completeBooking(booking.id);
  const before = await stock(2);
  await sales.convertBooking(booking.id);
  assert.equal(await stock(2), before);
});
test('transfer reversal is guarded, retained and cannot be repeated', async () => {
  const transfer = await transfers.create({ from_unit_id: 1, to_unit_id: 2, transfer_date: '2026-10-01', items: [{ item_id: 1, quantity: 3 }] });
  const sale = await sales.createSale({ business_unit_id: 2, items: [{ item_id: 1, qty: 2 }] });
  await rejected(transfers.remove(transfer.id), 409);
  assert.equal((await transfers.get(transfer.id)).status, 'POSTED');
  await returns.createReturn({ sale_invoice_id: sale.id, items: [{ item_id: 1, qty: 2 }] });
  await transfers.remove(transfer.id);
  assert.equal((await transfers.get(transfer.id)).status, 'CANCELLED');
  await rejected(transfers.remove(transfer.id), 400);
});
test('opening-stock reversal refuses consumed stock and repeats', async () => {
  await rejected(openings.deleteOpeningStock(1), 409);
  const [newItem] = await conn.query("INSERT INTO item_details (item_name,item_unit_id) VALUES ('Reversal',1)");
  const opening = await openings.createOpeningStock({ business_unit_id: 1, stock_date: '2026-10-01', items: [{ item_id: newItem.insertId, qty: 5 }] });
  await openings.deleteOpeningStock(opening.opening_stock_id);
  await rejected(openings.deleteOpeningStock(opening.opening_stock_id), 409);
  assert.equal(await stock(newItem.insertId), 0);
});
test('historical snapshot sums movements including partial receipts, bookings, returns and transfers', async () => {
  const closing = new Date().toISOString().slice(0, 10);
  const snapshot = await snapshots.create({ closing_date: closing });
  for (const item of snapshot.items) {
    const [[ledger]] = await conn.query('SELECT COALESCE(SUM(qty),0) AS n FROM item_stock WHERE item_id = ?', [item.item_id]);
    assert.equal(Number(item.calc_closing), Number(ledger.n));
    const [[inventory]] = await conn.query('SELECT COALESCE(SUM(quantity),0) AS n FROM inventory WHERE item_id = ?', [item.item_id]);
    assert.equal(Number(item.calc_closing), Number(inventory.n));
  }
});
test('expense posting numbers vouchers and forbids changing posted cash amounts', async () => {
  const voucher = await vouchers.create({ amount: 2.5 });
  assert.match(voucher.voucher_number, /^EV-\d+$/);
  assert.equal(voucher.status, 'posted');
  await rejected(vouchers.update(voucher.id, { amount: 100 }), 422);
});
test('cash daybook counts payments once and excludes invoice charges and credit-only returns', async () => {
  const result = await require('../../src/modules/daybook/day-book.routes').getDaybook('2020-01-01', '2099-12-31');
  const [[paid]] = await conn.query("SELECT COALESCE(SUM(amount),0) AS n FROM customer_payments WHERE LOWER(payment_method) = 'cash'");
  const [[advances]] = await conn.query("SELECT COALESCE(SUM(amount),0) AS n FROM booking_payments WHERE LOWER(payment_method) = 'cash' AND NOT EXISTS (SELECT 1 FROM booking_invoice_links WHERE booking_id = booking_payments.booking_id)");
  assert.equal(result.totalCashIn, Number(paid.n) + Number(advances.n));
  assert.ok(result.entries.every(row => !['Sale', 'Purchase', 'Sales Return', 'Purchase Return'].includes(row.module)));
});
test('purchase return credits use original net values and keep posted records', async () => {
  const ret = await purchaseReturns.createReturn({ purchase_id: purchase.id, items: [{ item_id: 1, qty: 1, purchase_price: 999 }] });
  assert.equal(Number(ret.total_amount), 5);
  await rejected(purchaseReturns.deleteReturn(ret.id), 409);
});
test('payment search keeps its customer scope and invoice filters reach row/count queries', async () => {
  await payments.createPayment({ customer_id: 2, amount: 1 });
  const list = await payments.listPayments({ search: 'Customer', customer_id: 2 });
  assert.equal(list.rows.length, 0);
  const salesList = await sales.listSales({ customer_id: 1 });
  assert.ok(salesList.rows.every(row => row.customer_id === 1));
  assert.equal(salesList.meta.total, salesList.rows.length);
});
test('status filtering, metadata edits and immutable supplier opening balances remain consistent', async () => {
  const list = await sales.listSales({ status: 'paid' });
  assert.ok(list.rows.every(row => row.status === 'paid'));
  assert.equal(Number(list.meta.total), list.rows.length);
  const summary = await sales.getSalesSummary({ status: 'paid' });
  assert.equal(Number(summary.invoice_count), list.rows.length);
  await customers.updateCustomer(2, { customer_name: 'Other updated' });
  assert.equal((await customers.getCustomer(2)).customer_name, 'Other updated');
  await rejected(require('../../src/modules/suppliers/supplier.service').update(1, { opening_balance: 100 }), 409);
});
test('persistent login throttling blocks repeated attempts', async () => {
  const { consumeLoginAttempt } = require('../../src/middleware/login-limit');
  for (let i = 0; i < 10; i++) await consumeLoginAttempt('test-ip', 'test-user');
  await rejected(consumeLoginAttempt('test-ip', 'test-user'), 429);
});
test('HTTP auth rejects old tokens after password changes and routes load', async () => {
  const { hashPassword } = require('../../src/utils/password');
  const hash = await hashPassword('test-password-123');
  await conn.query("INSERT INTO users (full_name,username,password_hash,role) VALUES ('Tester','backendtester',?,'user')", [hash]);
  const auth = require('../../src/modules/auth/auth.service');
  const login = await auth.login('backendtester', 'test-password-123');
  const app = require('../../src/app');
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/auth/me`;
  assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${login.token}` } })).status, 200);
  await auth.changePassword(login.user.id, 'test-password-123', 'different-password-123');
  assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${login.token}` } })).status, 401);
});
test('read-only group permission cannot change rights or enumerate users', async () => {
  const [created] = await conn.query("INSERT INTO access_groups (code,name) VALUES ('READ_ONLY','Read only')");
  const [permission] = await conn.query("INSERT INTO permissions (permission_key,module) VALUES ('ACCESS.GROUPS.READ','GROUPS')");
  await conn.query("INSERT INTO group_permissions (group_id,permission_id,effect) VALUES (?,?,'ALLOW')", [created.insertId, permission.insertId]);
  await conn.query("UPDATE users SET group_id = ? WHERE username = 'backendtester'", [created.insertId]);
  const login = await require('../../src/modules/auth/auth.service').login('backendtester', 'different-password-123');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const headers = { Authorization: `Bearer ${login.token}`, 'Content-Type': 'application/json' };
  assert.equal((await fetch(base + '/access-control/groups', { headers })).status, 200);
  assert.equal((await fetch(base + '/access-control/groups/' + created.insertId + '/permissions', { method: 'PUT', headers, body: JSON.stringify({ permissions: [] }) })).status, 403);
  assert.equal((await fetch(base + '/users', { headers })).status, 403);
  await conn.query('UPDATE access_groups SET is_active = 0 WHERE id = ?', [created.insertId]);
  assert.equal((await fetch(base + '/access-control/groups', { headers })).status, 403);
  await conn.query('UPDATE access_groups SET is_active = 1 WHERE id = ?', [created.insertId]);
  for (const action of ['READ', 'CREATE', 'DELETE']) {
    const [right] = await conn.query('INSERT INTO permissions (permission_key,module) VALUES (?,?)', ['ACCESS.OPENING_STOCK.' + action, 'OPENING_STOCK']);
    await conn.query("INSERT INTO group_permissions (group_id,permission_id,effect) VALUES (?,?,'ALLOW')", [created.insertId, right.insertId]);
  }
  const before = await stock();
  assert.equal((await fetch(base + '/opening-stocks/1', { method: 'DELETE', headers })).status, 409);
  assert.equal(await stock(), before);
  assert.equal((await fetch(base + '/opening-stocks/bad-id', { headers })).status, 422);
  assert.equal((await fetch(base + '/opening-stocks', { method: 'POST', headers, body: JSON.stringify({ business_unit_id: 1, stock_date: '2026-10-01', items: [{ item_id: 1, qty: -1 }] }) })).status, 422);
});
test('final schema remains verified after backend workflows', async () => {
  await validateSchema(conn, loadMigrations());
});
