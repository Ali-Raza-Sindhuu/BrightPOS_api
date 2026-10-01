// Run once after migrations (and after seed:permissions, or this seeds the
// same catalog itself if it's missing): `npm run seed:admin`
//
// IMPORTANT — this is different from the Day 1 version. Per the guide,
// requirePermission has NO role === 'admin' bypass: an admin account only
// has full access because it belongs to a group that's been granted every
// permission with effect=ALLOW. This script creates that group, grants it
// everything currently in the catalog, and puts the admin user in it — skip
// any of those three steps and the "admin" account will get 403s everywhere.
require("dotenv").config();
const  pool  = require("../config/db");
const { hashPassword } = require("../utils/password");
const permissionModel = require("../modules/accessControl/permissionModel");
const groupPermissionModel = require("../modules/accessControl/groupPermissionModel");
const BASE_PERMISSIONS = require("./basePermission");

const ADMIN = {
  fullName: process.env.ADMIN_FULL_NAME || "System Administrator",
  username: process.env.ADMIN_USERNAME || "admin",
  email: process.env.ADMIN_EMAIL || null,
  password: process.env.ADMIN_PASSWORD,
};

const ADMIN_GROUP = { code: "ADMINISTRATORS", name: "Administrators", description: "Full system access" };

async function ensureCatalogSeeded() {
  for (const perm of BASE_PERMISSIONS) {
    await permissionModel.createIfMissing(perm);
  }
  return permissionModel.findAll();
}

async function ensureAdminGroup() {
  const [rows] = await pool.query(`SELECT * FROM access_groups WHERE code = ?`, [ADMIN_GROUP.code]);
  if (rows[0]) return rows[0];

  const [result] = await pool.query(
    `INSERT INTO access_groups (code, name, description, is_active) VALUES (?, ?, ?, 1)`,
    [ADMIN_GROUP.code, ADMIN_GROUP.name, ADMIN_GROUP.description]
  );
  console.log(`[seed:admin] Created "${ADMIN_GROUP.name}" group (id=${result.insertId})`);
  const [created] = await pool.query(`SELECT * FROM access_groups WHERE id = ?`, [result.insertId]);
  return created[0];
}

async function grantAllPermissions(groupId, allPermissions) {
  const payload = allPermissions.map((p) => ({ permissionId: p.id, effect: "ALLOW" }));
  await groupPermissionModel.replaceForGroup(groupId, payload);
  console.log(`[seed:admin] Granted ${payload.length} permission(s) to the Administrators group`);
}

async function seed() {
  if (!ADMIN.password || ADMIN.password.length < 12) {
    throw new Error("Set ADMIN_PASSWORD to a unique password of at least 12 characters before seeding the admin user.");
  }
  if (!ADMIN.email) {
    throw new Error("Set ADMIN_EMAIL before seeding the admin user.");
  }
  const allPermissions = await ensureCatalogSeeded();
  const adminGroup = await ensureAdminGroup();
  await grantAllPermissions(adminGroup.id, allPermissions);

  const [existing] = await pool.query(`SELECT id FROM users WHERE username = ?`, [ADMIN.username]);
  if (existing.length) {
    // User already exists — still make sure they're in the fully-permissioned
    // group, in case this script is re-run after adding new permissions.
    await pool.query(`UPDATE users SET group_id = ? WHERE id = ?`, [adminGroup.id, existing[0].id]);
    console.log(`[seed:admin] User "${ADMIN.username}" already exists — re-confirmed group membership.`);
    process.exit(0);
  }

  const passwordHash = await hashPassword(ADMIN.password);
  await pool.query(
    `INSERT INTO users (full_name, username, email, password_hash, role, group_id, is_active)
     VALUES (?, ?, ?, ?, 'admin', ?, 1)`,
    [ADMIN.fullName, ADMIN.username, ADMIN.email, passwordHash, adminGroup.id]
  );

  console.log(`[seed:admin] Admin user created:`);
  console.log(`        username: ${ADMIN.username}`);
  console.log("        password: taken from ADMIN_PASSWORD (not printed)");
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed:admin] Failed:", err.sqlMessage || err.message);
  if (err.code) console.error("[seed:admin] MySQL error code:", err.code);
  process.exit(1);
});
