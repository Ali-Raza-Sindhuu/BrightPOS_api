#!/usr/bin/env node
/**
 * Deployment preflight — run this on the server right after `npm install` and
 * before starting the app:
 *
 *   npm run check
 *
 * It verifies, in order, the things that actually break a cPanel deploy:
 * .env present, required values set, MySQL reachable, schema migrated, an
 * admin user exists, and the uploads directory is writable.
 */

const fs = require("fs");
const path = require("path");

const results = [];
function pass(label, detail = "") { results.push({ ok: true, label, detail }); }
function fail(label, detail = "") { results.push({ ok: false, label, detail }); }
function warn(label, detail = "") { results.push({ ok: null, label, detail }); }

async function main() {
  // config/env.js exits with its own message if a required var is missing.
  const config = require("../src/config/env");

  const envPath = path.join(config.rootDir, ".env");
  if (fs.existsSync(envPath)) pass(".env file found", envPath);
  else warn(".env file not found", "reading variables from the process environment instead");

  pass("Required variables set", "DB_HOST, DB_USER, DB_NAME, JWT_SECRET");

  if (config.jwt.secret.length < 32) {
    warn("JWT_SECRET is short", `${config.jwt.secret.length} chars — use at least 32 for production`);
  } else {
    pass("JWT_SECRET length", `${config.jwt.secret.length} chars`);
  }

  if (config.isProduction && config.corsOrigins.length === 0) {
    warn("CORS_ORIGIN not set", "the API will accept requests from any origin");
  } else if (config.corsOrigins.length) {
    pass("CORS allowed origins", config.corsOrigins.join(", "));
  } else {
    warn("CORS_ORIGIN not set", "fine for local development");
  }

  // --- Database -----------------------------------------------------------
  const pool = require("../src/config/db");
  let dbUp = false;
  try {
    const conn = await pool.getConnection();
    conn.release();
    dbUp = true;
    pass("MySQL connection", `${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}`);
  } catch (err) {
    fail("MySQL connection", err.sqlMessage || err.message);
  }

  if (dbUp) {
    try {
      const [tables] = await pool.query("SHOW TABLES");
      if (tables.length === 0) {
        fail("Schema", "database is empty — run `npm run migrate`");
      } else {
        pass("Schema", `${tables.length} tables present`);
      }

      const [admins] = await pool.query(
        "SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1"
      );
      if (admins[0].n > 0) pass("Admin users", `${admins[0].n} active`);
      else fail("Admin users", "none — run `npm run create-admin -- --username admin --password <pw>`");
    } catch (err) {
      if (err.errno === 1146) fail("Schema", "`users` table missing — run `npm run migrate`");
      else fail("Schema check", err.sqlMessage || err.message);
    }
  }

  // --- Uploads ------------------------------------------------------------
  const uploadDir = path.join(config.uploads.dir, "items");
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
    const probe = path.join(uploadDir, `.write-test-${Date.now()}`);
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    pass("Uploads directory writable", uploadDir);
  } catch (err) {
    fail("Uploads directory", `${uploadDir} — ${err.message}`);
  }

  // --- Report -------------------------------------------------------------
  console.log("");
  for (const r of results) {
    const mark = r.ok === true ? "  OK  " : r.ok === false ? " FAIL " : " WARN ";
    console.log(`[${mark}] ${r.label}${r.detail ? `  —  ${r.detail}` : ""}`);
  }

  const failures = results.filter((r) => r.ok === false).length;
  const warnings = results.filter((r) => r.ok === null).length;
  console.log("");
  console.log(`Result: ${results.filter((r) => r.ok === true).length} passed, ${warnings} warning(s), ${failures} failure(s).`);
  if (failures) console.log("Fix the failures above before starting the app.");
  console.log("");

  await pool.end();
  process.exitCode = failures ? 1 : 0;
}

main().catch((err) => {
  console.error("[check] Unexpected error:", err.message);
  process.exit(1);
});
