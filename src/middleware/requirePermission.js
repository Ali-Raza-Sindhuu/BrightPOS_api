const ApiError = require("../../utils/ApiError");
const rbacService = require("./rbac.service");

/**
 * RBAC middleware skeleton (Day 2 deliverable) — every module built after
 * this should gate its write/read routes with requirePermission("module.resource.action")
 * instead of the Day 1 requireAdmin shortcut.
 *
 * Per the fixed RBAC model: admin bypasses group rights entirely (full access);
 * a non-admin user is strictly bound by their group's checked permissions.
 * Must run after `authenticate`.
 */
function requirePermission(permissionCode) {
  return async function (req, res, next) {
    try {
      if (!req.user) {
        throw new ApiError(401, "Not authenticated");
      }
      if (req.user.role === "admin") {
        return next();
      }

      const groupCodes = await rbacService.getPermissionCodesForGroup(req.user.groupId);
      if (!groupCodes.includes(permissionCode)) {
        throw new ApiError(403, `Missing required permission: ${permissionCode}`);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = requirePermission;
