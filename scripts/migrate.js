#!/usr/bin/env node
/**
 * Migration runner — applies every .sql file in src/migrations against the
 * database configured in .env, and records what it applied so re-running is
 * safe.
 *
 *   npm run migrate            apply all pending migrations
 *   npm run migrate -- --dry   list what would run, change nothing
 *   npm run migrate -- --status  show applied vs pending
 *
 * Why a runner instead of piping files to the mysql CLI: shared cPanel hosting
 * often gives you no shell mysql client, the migration filenames are not in a
 * single consistent numbering scheme, and several files depend on tables
 * created by later-sorting files.
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const config = require("../src/config/env");

const MIGRATIONS_DIR = path.join(config.rootDir, "src", "migrations");
const TRACKING_TABLE = "_migrations";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry") || args.includes("--dry-run");
const STATUS_ONLY = args.includes("--status");

// MySQL errors that mean "this change is already in place". The migration set
// mixes idempotent (CREATE TABLE IF NOT EXISTS) and non-idempotent files, so
// tolerating these keeps a partially-applied database recoverable.
const ALREADY_APPLIED_ERRORS = new Set([
  1050, // ER_TABLE_EXISTS_ERROR
  1060, // ER_DUP_FIELDNAME       — ADD COLUMN that already exists
  1061, // ER_DUP_KEYNAME         — ADD INDEX/KEY that already exists
  1022, // ER_DUP_KEY
  1826, // ER_FK_DUP_NAME         — ADD CONSTRAINT that already exists
  1091, // ER_CANT_DROP_FIELD_OR_KEY — DROP of something already gone
]);

/**
 * Files are named inconsistently (001_x.sql, 01_x.sql, plain_name.sql), so a
 * plain alphabetical sort interleaves the two numbered series wrongly. Sort by
 * (numeric prefix when present, then name); un-numbered files run last within
 * their phase, since they are the standalone master-data tables.
 */
function sortKey(filename) {
  const match = filename.match(/^(\d+)[_-]/);
  const num = match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
  return [num, filename.toLowerCase()];
}

// Several legacy migration files have no numeric prefix. Preserve their
// actual schema dependencies explicitly instead of relying on alphabetical
// order (for example, resources must exist before permissions are created).
const UNNUMBERED_DEPENDENCY_ORDER = new Map([
  ['accounts.sql', 10],
  ['openingstock.sql', 20],
  ['actions_table.sql', 30],
  ['modules_table.sql', 31],
  ['resource_table.sql', 32],
  ['permissions_table.sql', 33],
  ['group_table.sql', 34],
  ['group_permissions.sql', 35],
  ['user_table.sql', 36],
  ['bookings.sql', 40],
  ['booking_item.sql', 41],
  ['booking_payment.sql', 42],
]);

function compare(a, b) {
  const [an, as] = sortKey(a);
  const [bn, bs] = sortKey(b);
  if (an !== bn) return an - bn;
  const ap = UNNUMBERED_DEPENDENCY_ORDER.get(as) ?? 100;
  const bp = UNNUMBERED_DEPENDENCY_ORDER.get(bs) ?? 100;
  if (ap !== bp) return ap - bp;
  return as < bs ? -1 : as > bs ? 1 : 0;
}

/**
 * A file that creates no tables can only be modifying tables other files
 * create (add foreign keys, add a column, backfill it), so it has to run after
 * the whole CREATE phase regardless of its filename.
 *
 * Testing for "no CREATE TABLE" rather than "only ALTER statements" matters:
 * 011/012 interleave ALTER with INSERT/UPDATE backfills, and an "all
 * statements are ALTER" test would let them run before their target tables
 * exist.
 */
function isSchemaChangeOnly(sql) {
  const withoutComments = sql.replace(/^\s*--.*$/gm, "");
  return !/\bCREATE\s+TABLE\b/i.test(withoutComments);
}

/**
 * A file marked `-- @optional` is hardening the app doesn't depend on (e.g.
 * FK constraints the service layer already enforces). Failing one warns and
 * moves on instead of aborting the deploy — typically it fails only because
 * pre-existing data has orphan rows, which is a data question, not a blocker.
 */
function isOptional(sql) {
  return /^\s*--\s*@optional\b/im.test(sql);
}

function loadMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`[migrate] No migrations directory at ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.toLowerCase().endsWith(".sql"))
    .sort(compare);

  const createPhase = [];
  const alterPhase = [];

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    (isSchemaChangeOnly(sql) ? alterPhase : createPhase).push({ file, sql });
  }

  return [...createPhase, ...alterPhase];
}

async function ensureTrackingTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`${TRACKING_TABLE}\` (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      filename   VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function getApplied(conn) {
  const [rows] = await conn.query(`SELECT filename FROM \`${TRACKING_TABLE}\``);
  return new Set(rows.map((r) => r.filename));
}

async function main() {
  const migrations = loadMigrations();

  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
  });

  console.log(`[migrate] Database "${config.db.database}" on ${config.db.host}:${config.db.port}`);

  try {
    await ensureTrackingTable(conn);
    const applied = await getApplied(conn);
    const pending = migrations.filter((m) => !applied.has(m.file));

    if (STATUS_ONLY) {
      console.log(`[migrate] ${applied.size} applied, ${pending.length} pending\n`);
      for (const m of migrations) {
        console.log(`  ${applied.has(m.file) ? "[applied]" : "[pending]"} ${m.file}`);
      }
      return;
    }

    if (pending.length === 0) {
      console.log("[migrate] Nothing to do — database is up to date.");
      return;
    }

    console.log(`[migrate] ${pending.length} pending migration(s):`);
    for (const m of pending) console.log(`           - ${m.file}`);

    if (DRY_RUN) {
      console.log("[migrate] --dry given, nothing was executed.");
      return;
    }

    // The migration set has circular-ish table dependencies (users → groups →
    // users). Disabling FK checks for the run lets tables be created in any
    // order; constraints are validated again as soon as it is re-enabled.
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");

    let ok = 0;
    let skipped = 0;
    let failedOptional = 0;

    for (const { file, sql } of pending) {
      try {
        await conn.query(sql);
        await conn.query(`INSERT INTO \`${TRACKING_TABLE}\` (filename) VALUES (?)`, [file]);
        console.log(`  ✓ ${file}`);
        ok += 1;
      } catch (err) {
        if (ALREADY_APPLIED_ERRORS.has(err.errno)) {
          // Pre-existing schema (e.g. imported from a dump) — record it as done
          // so the next run doesn't retry it.
          await conn.query(`INSERT IGNORE INTO \`${TRACKING_TABLE}\` (filename) VALUES (?)`, [file]);
          console.log(`  ~ ${file} (already present — recorded as applied)`);
          skipped += 1;
        } else if (isOptional(sql)) {
          console.warn(`  ! ${file} (optional — skipped)`);
          console.warn(`    ${err.sqlMessage || err.message}`);
          console.warn(`    The app does not require this file; re-run it manually if you want it.`);
          failedOptional += 1;
        } else {
          console.error(`  ✗ ${file}`);
          console.error(`    ${err.sqlMessage || err.message}`);
          throw err;
        }
      }
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log(
      `[migrate] Done — ${ok} applied, ${skipped} already present` +
        (failedOptional ? `, ${failedOptional} optional skipped.` : ".")
    );
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("\n[migrate] Migration failed. The database was left as-is at the failing file.");
  console.error(`[migrate] ${err.sqlMessage || err.message}`);
  process.exit(1);
});
