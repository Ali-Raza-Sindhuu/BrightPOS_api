const ApiError = require("../utils/ApiError");

/**
 * Day 1 placeholder gate: role === 'admin' bypasses everything (per the fixed
 * RBAC model — admin has full access). The real per-functionality rights
 * engine (group_rights + hasRight()) is built on Day 2 and will replace this
 * for non-admin, group-based checks. Must run after `authenticate`.
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, "Not authenticated"));
  }
  if (req.user.role !== "admin") {
    return next(new ApiError(403, "Admin access required"));
  }
  next();
}

module.exports = requireAdmin;
