const test = require('node:test');
const assert = require('node:assert/strict');
const { minor, money, lineTotal } = require('../../src/utils/money');
const { date } = require('../../src/utils/validation');
const { allocateCredits, incrementalCredit } = require('../../src/utils/return-credit');
test('money compares decimal strings as cents and rejects invalid precision', () => {
  assert.equal(minor('20.00') + minor(10), 3000);
  for (const value of [NaN, Infinity, '', {}, '1e3', '0.001', true]) assert.throws(() => money(value));
  assert.throws(() => money(0, 'amount', { positive: true }));
  assert.equal(lineTotal('10.01', '1.50'), 15.02);
});
test('net return credits preserve the full discounted amount across partial returns', () => {
  const groups = allocateCredits([{ item_id: 1, ordered_qty: '3.00', gross_total: '1.00' }, { item_id: 2, ordered_qty: '1.00', gross_total: '1.00' }], '1.01');
  assert.equal(groups.get(1).credit + groups.get(2).credit, 101);
  const amounts = [0, 1, 2].map(qty => incrementalCredit(groups.get(1), qty, 1));
  assert.equal(Math.round(amounts.reduce((n, value) => n + value, 0) * 100), groups.get(1).credit);
});
test('report date validation rejects rolled-over dates', () => {
  assert.equal(date('2024-02-29'), '2024-02-29');
  assert.throws(() => date('2026-02-29'));
  assert.throws(() => date('2026-13-01'));
});
test('period boundaries cover the complete final day using UTC half-open ranges', () => {
  process.env.DB_HOST ||= '127.0.0.1';
  process.env.DB_USER ||= 'brightpos';
  process.env.DB_NAME ||= 'brightpos_test';
  process.env.JWT_SECRET ||= 'brightpos_test_secret_1234567890_abcdef';
  const { resolvePeriodRange } = require('../../src/modules/dashboard/dashboard.routes');
  const range = resolvePeriodRange('last_month', new Date('2026-10-01T00:30:00Z'));
  assert.equal(range.start.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(range.end.toISOString(), '2026-10-01T00:00:00.000Z');
});
test('upload detection rejects active markup despite a client image MIME label', () => {
  const { detectImage } = require('../../src/middleware/upload');
  assert.equal(detectImage(Buffer.from('<svg onload="alert(1)"></svg>')), null);
  assert.equal(detectImage(Buffer.from('<html>invalid image</html>')), null);
});
