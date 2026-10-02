// Local process entry. src/app.js exports the Express application separately.
const config = require("./src/config/env");
const app = require("./src/app");
const pool = require("./src/config/db");

let server;

(async () => {
  try {
    // Verify MySQL before accepting traffic so a bad DB_* value surfaces as a
    // clear boot error in the cPanel log instead of a 500 on the first request.
    const connection = await pool.getConnection();
    try {
      await require('./scripts/lib/schema').validateSchema(connection, require('./scripts/lib/migrations').loadMigrations());
    } finally { connection.release(); }
    console.log(`[db] Connected to MySQL database "${config.db.database}"`);

    server = app.listen(config.port, config.host, () => {
      console.log(`[server] POS backend running in ${config.env} mode on port ${config.port}`);
    });
  } catch (err) {
    console.error("[server] Failed to start — could not connect to MySQL.");
    console.error(`[server]   host=${config.db.host}:${config.db.port} db=${config.db.database} user=${config.db.user}`);
    console.error(`[server]   ${err.message}`);
    console.error("[server] Check the DB_* values in your .env file.");
    process.exit(1);
  }
})();

// Passenger restarts the app by signalling it. Draining connections and
// closing the MySQL pool first avoids leaking connections on every restart —
// which matters on shared hosting where the per-user connection cap is low.
function shutdown(signal) {
  console.log(`[server] ${signal} received — shutting down.`);
  const done = () => Promise.allSettled([pool.end(),require('./src/modules/demo/demo.service').closePool()]).then(() => process.exit(0));
  if (server) {
    server.close(done);
    // Don't hang forever on a stuck keep-alive connection.
    setTimeout(() => process.exit(0), 10000).unref();
  } else {
    done();
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (err) => {
  console.error("[server] Unhandled promise rejection:", err);
});
