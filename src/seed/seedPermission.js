// Run after migrations 011-014: `npm run seed:permissions`
//
// Per the guide (section 1.2): every permission your frontend's
// SIDEBAR_CATALOG / route guards reference must exist as a row here.
// Swap BASE_PERMISSIONS (seed/basePermissions.js) for the recursive
// SIDEBAR_CATALOG walk the guide describes once that catalog exists in the
// frontend — this script is idempotent (createIfMissing / INSERT IGNORE),
// safe to re-run any time the catalog grows.
require("dotenv").config();
const permissionModel = require("../modules/accessControl/permissionModel");
const BASE_PERMISSIONS = require("./basePermission");

async function seed() {
  console.log("[seed:permissions] Seeding base permission catalog...");
  for (const perm of BASE_PERMISSIONS) {
    await permissionModel.createIfMissing(perm);
    console.log(`[seed:permissions]   + ${perm.permissionKey}`);
  }

  const all = await permissionModel.findAll();
  console.log(`[seed:permissions] Done. ${all.length} permission(s) now in the catalog.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed:permissions] Failed:", err.sqlMessage || err.message);
  if (err.code) console.error("[seed:permissions] MySQL error code:", err.code);
  process.exit(1);
});
