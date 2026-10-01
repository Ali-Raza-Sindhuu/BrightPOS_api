const mysql = require("mysql2/promise");
const config = require("./env");

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
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
