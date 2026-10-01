const express = require("express");
const authenticate = require("../../middleware/authentication");
const { requirePermission } = require("./require-permission");
const ctrl = require("./access-control.controller");

const router = express.Router();
router.param('id', (req, res, next, value) => { try { req.params.id = require('../../utils/validation').id(value, 'id'); next(); } catch (error) { next(error); } });

router.use(authenticate); // all routes require a logged-in user

// Groups
router.get("/groups", requirePermission("ACCESS.GROUPS.READ"), ctrl.listGroups);
router.post("/groups", requirePermission("ACCESS.GROUPS.CREATE"), ctrl.createGroup);
router.put("/groups/:id", requirePermission("ACCESS.GROUPS.UPDATE"), ctrl.updateGroup);
router.get("/groups/:id/permissions", requirePermission("ACCESS.GROUPS.READ"), ctrl.getGroupPermissions);
router.put("/groups/:id/permissions", requirePermission("ACCESS.PERMISSIONS.UPDATE"), ctrl.updateGroupPermissions);
router.delete("/groups/:id", requirePermission("ACCESS.GROUPS.DELETE"), ctrl.deleteGroup);

// Catalog (all permissions, for building the tree UI)
router.get("/catalog", requirePermission("ACCESS.PERMISSIONS.READ"), ctrl.getCatalog);

// Users <-> Group assignment
router.get("/users", requirePermission("ACCESS.USER_GROUPS.READ"), ctrl.listUsers);
router.put("/users/:id/group", requirePermission("ACCESS.USER_GROUPS.UPDATE"), ctrl.assignUserGroup);

// Permissions (read-only browse — reuses /catalog under the hood)
router.get("/permissions", requirePermission("ACCESS.PERMISSIONS.READ"), ctrl.getCatalog);

// IP tracking
router.get("/ip-logs", requirePermission("ACCESS.IP_TRACKING.READ"), ctrl.listIpLogs);

// Control panel / settings
router.get("/settings", requirePermission("ACCESS.CONTROL_PANEL.READ"), ctrl.getSettings);
router.put("/settings", requirePermission("ACCESS.CONTROL_PANEL.UPDATE"), ctrl.updateSettings);

// Current user's own permissions — no permission required to read your own.
router.get("/me/permissions", ctrl.getMyPermissions);

module.exports = router;
