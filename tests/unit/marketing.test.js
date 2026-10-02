const test = require('node:test');
const assert = require('node:assert/strict');
process.env.DB_HOST ||= '127.0.0.1';
process.env.DB_USER ||= 'test';
process.env.DB_NAME ||= 'test';
process.env.JWT_SECRET ||= 'test_secret_at_least_32_characters_long';
const { validate } = require('../../src/modules/marketing/marketing.service');

test('marketing input rejects invalid types, excessive lengths and missing consent', () => {
  const valid = { name: 'Shop Owner', email: 'Owner@Example.com', consent: true };
  assert.equal(validate(valid).email, 'owner@example.com');
  for (const invalid of [{ consent: false }, { email: 'invalid' }, { email: {} }, { name: ['owner'] }, { kind: 'admin' }, { message: 'x'.repeat(3001) }]) {
    assert.throws(() => validate({ ...valid, ...invalid }), error => error.statusCode === 400);
  }
  assert.equal(validate({ kind: 'newsletter', email: 'owner@example.com', consent: true }).name, null);
  assert.throws(() => validate({ kind: 'trial', email: 'owner@example.com', consent: true }), error => error.statusCode === 400);
});
