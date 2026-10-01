#!/usr/bin/env node
const mysql = require('mysql2/promise');
const { getDatabaseOptions } = require('../src/config/database');
const { validateSchema } = require('./lib/schema');

async function main() {
  const options = getDatabaseOptions();
  const conn = await mysql.createConnection(options);
  try {
    const [[runtime]] = await conn.query('SELECT VERSION() AS version, @@SESSION.sql_mode AS sqlMode, @@SESSION.foreign_key_checks AS foreignKeyChecks');
    const [tls] = await conn.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'");
    if (options.ssl && !tls[0]?.Value) throw new Error('TLS requested but no encrypted session was established');
    if (Number(runtime.foreignKeyChecks) !== 1) throw new Error('Foreign-key checks are disabled');
    const report = await validateSchema(conn);
    console.log(`[schema] OK ${options.database}: ${JSON.stringify(report)}`);
    console.log(`[schema] MySQL ${runtime.version}; SQL mode: ${runtime.sqlMode}; foreign-key checks: ON; TLS: ${tls[0]?.Value || 'not used (local)'}\n[schema] Read-only validation; no business data changed.`);
  } finally { await conn.end(); }
}
if (require.main === module) main().catch(error => { console.error(`[schema] ${error.message}`); process.exitCode = 1; });
module.exports = { main };
