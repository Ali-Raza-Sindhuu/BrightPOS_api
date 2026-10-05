const test = require('node:test');
const assert = require('node:assert/strict');
const { splitSql, loadMigrations, validateHistory } = require('../../scripts/lib/migrations');
const { schemaContract } = require('../../scripts/lib/schema');
const { getDatabaseOptions } = require('../../src/config/database');

test('SQL parser preserves quoted separators and ignores comments', () => {
  assert.deepEqual(splitSql("-- ignored ;\nSELECT 'a;b', 'it''s', `x;y`; /* ; */ SELECT 2;"), ["SELECT 'a;b', 'it''s', `x;y`", 'SELECT 2']);
  assert.deepEqual(splitSql('a DECIMAL(15,2), b ENUM(\'x,y\',\'z\')', ','), ['a DECIMAL(15,2)', "b ENUM('x,y','z')"]);
  assert.throws(() => splitSql("SELECT 'unfinished"), /Unterminated/);
  assert.throws(() => splitSql('/*! SELECT 1 */'), /Executable/);
});

test('baseline is consecutive and contains each expected table once', () => {
  const migrations = loadMigrations();
  const tables = schemaContract(migrations);
  assert.equal(migrations.length, 150);
  assert.equal(tables.length, 88);
  assert.equal(new Set(tables.map(table => table.name)).size, 88);
  const baseline = schemaContract(migrations.slice(0, 55));
  assert.equal(baseline.length, 52);
  assert.equal(baseline.reduce((n, table) => n + table.foreignKeys.length, 0), 68);
  const first = migrations[0];
  const row = { ...first, state: 'applied' };
  assert.doesNotThrow(() => validateHistory(migrations, [row]));
  assert.throws(() => validateHistory(migrations, [{ ...row, checksum: 'modified' }]), /Checksum/);
  assert.throws(() => validateHistory(migrations, [{ ...row, state: 'running' }]), /Interrupted/);
  assert.throws(() => validateHistory(migrations, [{ ...row, version: 2 }]), /nonconsecutive/);
});

test('schema contract applies ALTER definitions and rejects unsupported changes', () => {
  const base = { filename: 'base.sql', sql: 'CREATE TABLE example (id INT NOT NULL, PRIMARY KEY (id)) ENGINE=InnoDB' };
  const altered = schemaContract([base, { filename: 'alter.sql', sql: 'ALTER TABLE example ADD COLUMN amount BIGINT UNSIGNED NULL, ADD KEY idx_amount (amount), MODIFY COLUMN id BIGINT NOT NULL' }]);
  assert.equal(altered[0].columns[0].type, 'bigint');
  assert.equal(altered[0].columns[1].name, 'amount');
  assert.equal(altered[0].indexes[1].name, 'idx_amount');
  const dropped = schemaContract([base, { filename: 'alter.sql', sql: 'ALTER TABLE example ADD COLUMN amount INT NULL, DROP COLUMN amount' }]);
  assert.equal(dropped[0].columns.length, 1);
  assert.throws(() => schemaContract([base, { filename: 'bad.sql', sql: 'ALTER TABLE example RENAME COLUMN id TO other_id' }]), /Unsupported ALTER/);
});

test('database options enforce TLS identity verification and reject conflicting configuration', () => {
  const names = ['DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PASSWORD', 'DB_PORT', 'DB_SSL', 'DB_SSL_CA', 'DB_SSL_CA_FILE', 'DB_CONNECT_TIMEOUT_MS'];
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    Object.assign(process.env, { DB_HOST: 'example.aivencloud.com', DB_USER: 'avnadmin', DB_NAME: 'defaultdb', DB_PASSWORD: ' with spaces ', DB_SSL: 'true', DB_SSL_CA: 'certificate\\ntext' });
    const options = getDatabaseOptions();
    assert.equal(options.ssl.rejectUnauthorized, true);
    assert.equal(options.ssl.verifyIdentity, true);
    assert.equal(options.ssl.ca, 'certificate\ntext');
    assert.equal(options.multipleStatements, false);
    assert.equal(options.password, ' with spaces ');
    process.env.DB_SSL_CA_FILE = 'certs/aiven-ca.pem';
    assert.throws(getDatabaseOptions, /not both/);
    delete process.env.DB_SSL_CA_FILE;
    process.env.DB_SSL = 'false';
    assert.throws(getDatabaseOptions, /requires DB_SSL/);
    delete process.env.DB_SSL_CA;
    process.env.DB_PORT = '65536';
    assert.throws(getDatabaseOptions, /DB_PORT/);
  } finally {
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
});
