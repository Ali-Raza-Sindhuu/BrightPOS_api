const groupPermissionModel = require("./group-permission.model");

// Per the access-control guide: this is a pure group_permissions check.
// Unlike Day 1's requireAdmin, there is NO role === 'admin' bypass here —
// an "admin" account only has full access because it's placed in a group
// that has every permission ALLOWed (see seed/seedAccessControl.js). This
// is intentional: one consistent authorization path, no special-cased role.
//
// A real app should cache this per-session/Redis instead of hitting the DB
// on every request (see guide's "nice-to-haves") — left as a TODO.
async function getUserPermissions(groupId) {
  if (!groupId) return {};
  const rows = await groupPermissionModel.findByGroup(groupId);
  const map = {};
  rows.forEach((r) => {
    map[r.permission_key] = r.effect;
  });
  return map;
}

function requirePermission(permissionKey) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }
      const perms = await getUserPermissions(req.user.groupId);
      if (perms[permissionKey] !== "ALLOW") {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

module.exports = { requirePermission, getUserPermissions };
