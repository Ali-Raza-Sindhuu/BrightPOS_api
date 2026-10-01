const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const migrationsDir = path.resolve(__dirname, '../../database/migrations');
const trackingTable = '_schema_migrations';

// Ordinary SQL only; DELIMITER, stored routines and executable comments are
// intentionally excluded so each journal entry corresponds to one statement.
function splitSql(sql, separator = ';') {
  const parts = [];
  let part = '', quote = null, depth = 0;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i], next = sql[i + 1];
    if (quote) {
      part += char;
      if (char === '\\' && quote !== '`' && next !== undefined) part += sql[++i];
      else if (char === quote && next === quote) part += sql[++i];
      else if (char === quote) quote = null;
      continue;
    }
    if ((char === '-' && next === '-' && /\s/.test(sql[i + 2] || ' ')) || char === '#') {
      while (i < sql.length && sql[i] !== '\n') i += 1;
      part += '\n';
      continue;
    }
    if (char === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end < 0) throw new Error('Unterminated SQL comment');
      if (sql[i + 2] === '!') throw new Error('Executable SQL comments are not supported');
      i = end + 1;
      part += ' ';
      continue;
    }
    if (['\'', '"', '`'].includes(char)) quote = char;
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth < 0) throw new Error('Unbalanced SQL parentheses');
    if (char === separator && (separator === ';' || depth === 0)) {
      if (part.trim()) parts.push(part.trim());
      part = '';
    } else part += char;
  }
  if (quote || depth !== 0) throw new Error('Unterminated SQL quote or parentheses');
  if (part.trim()) parts.push(part.trim());
  return parts;
}

function loadMigrations(directory = migrationsDir) {
  const files = fs.readdirSync(directory).filter(name => name.endsWith('.sql')).sort();
  if (!files.length) throw new Error('No numbered migrations found');
  return files.map((filename, index) => {
    const match = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(filename);
    if (!match || Number(match[1]) !== index + 1) throw new Error(`Expected consecutive four-digit migration ${String(index + 1).padStart(4, '0')}; found ${filename}`);
    const contents = fs.readFileSync(path.join(directory, filename), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    const statements = splitSql(contents);
    if (statements.length !== 1 || /^DELIMITER\b/i.test(statements[0])) throw new Error(`${filename}: use exactly one SQL statement per migration`);
    return { version: Number(match[1]), filename, sql: statements[0], checksum: crypto.createHash('sha256').update(contents).digest('hex') };
  });
}

function validateHistory(migrations, rows) {
  rows.forEach((row, index) => {
    const expected = migrations[index];
    if (!expected || row.version !== expected.version || row.filename !== expected.filename) throw new Error(`Unknown or nonconsecutive migration history at ${row.filename}; no automatic legacy adoption`);
    if (row.checksum !== expected.checksum) throw new Error(`Checksum mismatch: ${row.filename}. Restore the applied file; add a new migration for changes.`);
    if (row.state !== 'applied') throw new Error(`Interrupted/failed migration: ${row.filename}. Inspect the database and follow the recovery guide before continuing.`);
  });
}

async function getHistory(conn) {
  const [tables] = await conn.query('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
  const names = tables.map(row => row.name);
  if (names.includes('_migrations')) throw new Error('Legacy _migrations history detected. Use a new empty database or a separately reviewed legacy upgrade.');
  if (!names.includes(trackingTable)) {
    if (names.length) throw new Error('Database is not empty and has no canonical migration history. Refusing to overwrite/adopt existing tables.');
    return { rows: [], initialized: false };
  }
  const [rows] = await conn.query(`SELECT version, filename, checksum, state FROM ${trackingTable} ORDER BY version`);
  if (!rows.length && names.some(name => name !== trackingTable)) throw new Error('Untracked tables found beside empty migration history');
  return { rows, initialized: true };
}

async function runMigrations(conn, migrations, { status = false, dryRun = false, log = console.log, lockTimeout = 10 } = {}) {
  let locked = false;
  const [[{ database }]] = await conn.query('SELECT DATABASE() AS `database`');
  const lockName = `brightpos:migrate:${crypto.createHash('sha256').update(database).digest('hex').slice(0, 32)}`;
  try {
    if (!status && !dryRun) {
      const [[{ acquired }]] = await conn.query('SELECT GET_LOCK(?, ?) AS acquired', [lockName, lockTimeout]);
      if (Number(acquired) !== 1) throw new Error('Another migration runner holds the database lock; no migrations executed');
      locked = true;
    }
    const history = await getHistory(conn);
    validateHistory(migrations, history.rows);
    const pending = migrations.slice(history.rows.length);
    log(`[migrate] ${history.rows.length} applied, ${pending.length} pending`);
    if (status || dryRun) {
      for (const migration of migrations) log(`  ${migration.version <= history.rows.length ? '[applied]' : '[pending]'} ${migration.filename}`);
      if (dryRun) log('[migrate] Dry run: no tables or history rows were changed.');
      return { applied: history.rows.length, executed: 0, pending: pending.length };
    }
    if (!history.initialized) {
      await conn.query(`CREATE TABLE ${trackingTable} (
        version INT UNSIGNED NOT NULL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        state ENUM('running','applied') NOT NULL,
        started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        applied_at TIMESTAMP NULL DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    }
    for (const migration of pending) {
      await conn.query(`INSERT INTO ${trackingTable} (version, filename, checksum, state) VALUES (?, ?, ?, 'running')`, [migration.version, migration.filename, migration.checksum]);
      try {
        await conn.query(migration.sql);
        await conn.query(`UPDATE ${trackingTable} SET state = 'applied', applied_at = CURRENT_TIMESTAMP WHERE version = ?`, [migration.version]);
      } catch (error) {
        throw new Error(`${migration.filename} failed (${error.code || 'error'}). Its history remains running; MySQL DDL may already be committed. Inspect/recover before rerunning.`, { cause: error });
      }
      log(`  [applied] ${migration.filename}`);
    }
    return { applied: migrations.length, executed: pending.length, pending: 0 };
  } finally {
    if (locked) await conn.query('SELECT RELEASE_LOCK(?)', [lockName]);
  }
}

module.exports = { migrationsDir, trackingTable, splitSql, loadMigrations, validateHistory, getHistory, runMigrations };
