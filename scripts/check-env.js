#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const config = require('../src/config/env');
  const { envPath } = require('../src/config/load-environment');
  const pool = require('../src/config/db');
  try {
    console.log(`[check] Environment: ${config.env}; selected file: ${envPath}`);
    const conn = await pool.getConnection();
    try {
      const report = await require('./lib/schema').validateSchema(conn, require('./lib/migrations').loadMigrations());
      console.log(`[check] Database OK: ${report.migrations} migrations; ${report.tables} application tables`);
      const [[admins]] = await conn.query("SELECT COUNT(*) AS n FROM users u JOIN access_groups g ON g.id = u.group_id AND g.is_active = 1 WHERE u.role = 'admin' AND u.is_active = 1");
      console.log(Number(admins.n) ? '[check] Active grouped administrator exists' : '[check] Setup needed: set ADMIN_PASSWORD, then npm run seed:admin');
    } finally { conn.release(); }
    if (process.env.VERCEL === '1') {
      if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Vercel image uploads require BLOB_READ_WRITE_TOKEN');
      console.log('[check] Blob storage token configured');
    } else {
      const dir = path.join(config.uploads.dir, 'items');
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, `.write-test-${Date.now()}`);
      fs.writeFileSync(probe, 'ok');
      fs.unlinkSync(probe);
      console.log('[check] Local upload directory writable');
    }
  } finally { await pool.end(); }
}
main().catch(error => { console.error(`[check] ${error.message}`); process.exitCode = 1; });
