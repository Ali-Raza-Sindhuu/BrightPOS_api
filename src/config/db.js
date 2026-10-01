const mysql = require("mysql2/promise");
const config = require("./env");
const { getDatabaseOptions } = require('./database');

const pool = mysql.createPool({
  ...getDatabaseOptions(),
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: config.db.queueLimit,
  maxIdle: config.db.connectionLimit,
  idleTimeout: 30000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  dateStrings: true,
});

// Fails fast on boot if MySQL isn't reachable / credentials are wrong,
// instead of surfacing a confusing error on the first request.
async function testConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    console.log(`[db] Connected to MySQL database "${config.db.database}"`);
  } finally {
    conn.release();
  }
}

module.exports = pool;
module.exports.testConnection = testConnection;
