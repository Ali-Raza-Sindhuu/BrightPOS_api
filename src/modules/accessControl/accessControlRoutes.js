const express = require("express");
const authenticate = require("../../middleware/authentication");
const { requirePermission } = require("./requirePermission");
const ctrl = require("./accessControlController");

const router = express.Router();

router.use(authenticate); // all routes require a logged-in user

// Groups
router.get("/groups", requirePermission("ACCESS.GROUPS.READ"), ctrl.listGroups);
router.post("/groups", requirePermission("ACCESS.GROUPS.READ"), ctrl.createGroup);
router.put("/groups/:id", requirePermission("ACCESS.GROUPS.READ"), ctrl.updateGroup);
router.get("/groups/:id/permissions", requirePermission("ACCESS.GROUPS.READ"), ctrl.getGroupPermissions);
router.put("/groups/:id/permissions", requirePermission("ACCESS.GROUPS.READ"), ctrl.updateGroupPermissions);
router.delete("/groups/:id", requirePermission("ACCESS.GROUPS.READ"), ctrl.deleteGroup);

// Catalog (all permissions, for building the tree UI)
router.get("/catalog", requirePermission("ACCESS.PERMISSIONS.READ"), ctrl.getCatalog);

// Users <-> Group assignment
router.get("/users", requirePermission("ACCESS.USER_GROUPS.READ"), ctrl.listUsers);
router.put("/users/:id/group", requirePermission("ACCESS.USER_GROUPS.READ"), ctrl.assignUserGroup);

// Permissions (read-only browse — reuses /catalog under the hood)
router.get("/permissions", requirePermission("ACCESS.PERMISSIONS.READ"), ctrl.getCatalog);

// IP tracking
router.get("/ip-logs", requirePermission("ACCESS.IP.READ"), ctrl.listIpLogs);

// Control panel / settings
router.get("/settings", requirePermission("ACCESS.GROUPS.READ"), ctrl.getSettings);
router.put("/settings", requirePermission("ACCESS.GROUPS.READ"), ctrl.updateSettings);

// Current user's own permissions — no permission required to read your own.
router.get("/me/permissions", ctrl.getMyPermissions);

module.exports = router;
