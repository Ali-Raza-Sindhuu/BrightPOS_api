const test = require('node:test');
const assert = require('node:assert/strict');
const { getPagination, buildMeta } = require('../src/utils/pagination');

test('pagination rejects invalid values and caps large pages', () => {
  assert.deepEqual(getPagination({ page: '-4', limit: '1000' }), {
    page: 1,
    limit: 100,
    offset: 0,
  });
  assert.deepEqual(getPagination({ page: '3', limit: '25' }), {
    page: 3,
    limit: 25,
    offset: 50,
  });
});

test('pagination metadata supports the existing positional and object forms', () => {
  const expected = { page: 2, limit: 10, total: 21, totalPages: 3 };
  assert.deepEqual(buildMeta(2, 10, 21), expected);
  assert.deepEqual(buildMeta({ page: 2, limit: 10, total: 21 }), expected);
});
