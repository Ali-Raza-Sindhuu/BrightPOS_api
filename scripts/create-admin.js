#!/usr/bin/env node
/**
 * Creates (or resets) the first admin user, so a freshly migrated database has
 * something to log in with. There is no public signup endpoint — without this
 * a new deployment is locked out of its own admin panel.
 *
 *   npm run create-admin -- --username admin --password "S3cret!" --email admin@example.com
 *
 * Re-running with an existing username resets that user's password and
 * re-promotes them to admin — which doubles as the "I forgot the admin
 * password" recovery path on a server with no other way in.
 */

const bcrypt = require("bcryptjs");

const config = require("../src/config/env");
const pool = require("../src/config/db");

const SALT_ROUNDS = 10;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const username = arg("username", "admin");
  const password = arg("password");
  const email = arg("email");
  const fullName = arg("name", "Administrator");

  if (!password) {
    console.error("Usage: npm run create-admin -- --username admin --password <password> [--email a@b.com] [--name \"Full Name\"]");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("[create-admin] Use a unique password with at least 12 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const [existing] = await pool.query(
    "SELECT id FROM users WHERE username = ? LIMIT 1",
    [username]
  );

  if (existing.length) {
    await pool.query(
      "UPDATE users SET password_hash = ?, role = 'admin', is_active = 1 WHERE id = ?",
      [passwordHash, existing[0].id]
    );
    console.log(`[create-admin] Existing user "${username}" updated — password reset, role set to admin.`);
  } else {
    await pool.query(
      `INSERT INTO users (full_name, username, email, password_hash, role, group_id, is_active)
       VALUES (?, ?, ?, ?, 'admin', NULL, 1)`,
      [fullName, username, email || null, passwordHash]
    );
    console.log(`[create-admin] Admin user "${username}" created on database "${config.db.database}".`);
  }

  console.log("[create-admin] You can now log in to the POS frontend with these credentials.");
}

main()
  .catch((err) => {
    console.error("[create-admin] Failed:", err.sqlMessage || err.message);
    if (err.errno === 1146) {
      console.error("[create-admin] The `users` table does not exist yet — run `npm run migrate` first.");
    }
    process.exitCode = 1;
  })
  .finally(() => pool.end());
