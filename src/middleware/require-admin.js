const ApiError = require("../utils/api-error");

// Owner gate supplements the existing group permission check. Explicit staff
// assignments take precedence over a legacy admin/user account label.
function requireAdmin(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, "Not authenticated"));
  }
  if (req.user.operationalRole ? req.user.operationalRole !== 'owner' : req.user.role !== 'admin') {
    return next(new ApiError(403, "Admin access required"));
  }
  next();
}

module.exports = requireAdmin;
