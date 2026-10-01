#!/usr/bin/env node
const mysql = require('mysql2/promise');
const { getDatabaseOptions } = require('../src/config/database');
const { loadMigrations, runMigrations } = require('./lib/migrations');
const { validateSchema } = require('./lib/schema');

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--status', '--dry', '--dry-run'].includes(arg))) throw new Error('Usage: npm run migrate -- [--status | --dry-run]');
  const options = getDatabaseOptions();
  const migrations = loadMigrations();
  const conn = await mysql.createConnection(options);
  try {
    console.log(`[migrate] ${options.host}:${options.port}/${options.database}${options.ssl ? ' (verified TLS)' : ' (local/plain TCP)'}`);
    const result = await runMigrations(conn, migrations, { status: args.includes('--status'), dryRun: args.includes('--dry') || args.includes('--dry-run') });
    if (!args.length) {
      await validateSchema(conn, migrations);
      console.log(`[migrate] OK: ${result.applied} applied, ${result.pending} pending; executed ${result.executed} this run. Schema verified.`);
    }
  } finally {
    await conn.end();
  }
}

if (require.main === module) main().catch(error => {
  console.error(`[migrate] ${error.message}`);
  process.exitCode = 1;
});
module.exports = { main };
