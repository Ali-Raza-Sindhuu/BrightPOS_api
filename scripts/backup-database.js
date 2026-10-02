#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { getDatabaseOptions } = require('../src/config/database');
const { rootDir } = require('../src/config/load-environment');

async function backupDatabase(databaseOptions = getDatabaseOptions()) {
  const options = { ...databaseOptions, supportBigNumbers: true, bigNumberStrings: true };
  const conn = await mysql.createConnection(options);
  const directory = path.join(rootDir, 'backups');
  fs.mkdirSync(directory, { recursive: true });
  const filename = path.join(directory, `${options.database}-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`);
  const file = fs.openSync(filename, 'wx');
  const write = text => fs.writeSync(file, text, null, 'utf8');
  let rows = 0;
  try {
    await conn.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await conn.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    write('-- BrightPOS consistent data/schema backup. Restore into an empty database, not over live tables.\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n');
    const [tables] = await conn.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME");
    for (const { TABLE_NAME: name } of tables) {
      const [[definition]] = await conn.query(`SHOW CREATE TABLE ${mysql.escapeId(name)}`);
      write(`${definition['Create Table']};\n`);
      const [primary] = await conn.query("SELECT COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = 'PRIMARY' ORDER BY SEQ_IN_INDEX", [name]);
      if (!primary.length) throw new Error(`Cannot create deterministic backup without primary key: ${name}`);
      const order = primary.map(column => mysql.escapeId(column.COLUMN_NAME)).join(',');
      for (let offset = 0; ; offset += 500) {
        const [batch] = await conn.query(`SELECT * FROM ${mysql.escapeId(name)} ORDER BY ${order} LIMIT 500 OFFSET ?`, [offset]);
        for (const row of batch) {
          const columns = Object.keys(row);
          const values = columns.map(column => {
            const value = row[column];
            return mysql.escape(value !== null && typeof value === 'object' && !Buffer.isBuffer(value) ? JSON.stringify(value) : value);
          });
          write(`INSERT INTO ${mysql.escapeId(name)} (${columns.map(column => mysql.escapeId(column)).join(',')}) VALUES (${values.join(',')});\n`);
          rows += 1;
        }
        if (batch.length < 500) break;
      }
    }
    const [triggers] = await conn.query('SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()');
    for (const trigger of triggers) {
      const [[definition]] = await conn.query(`SHOW CREATE TRIGGER ${mysql.escapeId(trigger.TRIGGER_NAME)}`);
      write(`${definition['SQL Original Statement']};\n`);
    }
    write('SET FOREIGN_KEY_CHECKS=1;\n');
    await conn.commit();
    console.log(`[backup] ${tables.length} tables, ${rows} rows saved to ${filename}`);
    return filename;
  } catch (error) {
    await conn.rollback();
    console.error(`[backup] Incomplete file retained for inspection: ${filename}`);
    throw error;
  } finally {
    fs.closeSync(file);
    await conn.end();
  }
}
if (require.main === module) backupDatabase().catch(error => { console.error(`[backup] ${error.message}`); process.exitCode = 1; });
module.exports = { backupDatabase };
