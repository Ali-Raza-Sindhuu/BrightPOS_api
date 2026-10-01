const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_HOST ||= '127.0.0.1';
process.env.DB_USER ||= 'brightpos_test';
process.env.DB_NAME ||= 'brightpos_test';
process.env.JWT_SECRET ||= 'brightpos_test_secret_change_me_123456';
process.env.NODE_ENV = 'test';

const pool = require('../../src/config/db');
const app = require('../../src/app');

async function withServer(fn) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
}

test('health endpoint reports an available database without exposing runtime config', async () => {
  const originalQuery = pool.query;
  pool.query = async () => [[{ ready: 1 }], []];
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/health`);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.success, true);
      assert.equal(body.message, 'OK');
      assert.ok(Number.isInteger(body.uptime));
      assert.equal(Object.hasOwn(body, 'env'), false);
    });
  } finally {
    pool.query = originalQuery;
  }
});

test('health endpoint returns 503 when MySQL is unavailable', async () => {
  const originalQuery = pool.query;
  pool.query = async () => { throw new Error('offline'); };
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/health`);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { success: false, message: 'Database unavailable' });
    });
  } finally {
    pool.query = originalQuery;
  }
});

test('unknown API routes return a structured 404', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/not-a-route`);
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Route not found/);
  });
});

test('sales API rejects unauthenticated requests before database access', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/sales`);
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Authorization/);
  });
});

test('local frontend origin receives credentialed CORS headers', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  });
});
