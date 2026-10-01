const asyncHandler = require("../../utils/async-handler");
const authService = require("./auth.service");
const userModel = require("../users/user.model");
const accessControlService = require("../access-control/access-control.service");

// Per the access-control guide: NO role-based bypass. An "admin" account
// only sees everything because it sits in a group that has every permission
// ALLOWed (see seed/seedAccessControl.js) — this always does a real lookup.
async function resolvePermissions(user) {
  return accessControlService.getAllowedPermissionKeysForUser(user);
}

const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  const { token, user } = await authService.login(identifier, password);
  const permissions = await resolvePermissions(user);

  // IP/activity logging per the guide (section 2.4) — best-effort, a logging
  // failure should never block a successful login.
  try {
    await accessControlService.logActivity({
      userId: user.id,
      ipAddress: req.ip,
      action: "LOGIN",
      userAgent: req.headers["user-agent"],
    });
  } catch (err) {
    console.error("[auth] Failed to write IP log:", err.message);
  }

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        username: user.username,
        email: user.email,
        role: user.role,
        groupId: user.group_id,
        permissions,
      },
    },
  });
});

const me = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.id);
  const safe = userModel.toSafeJSON(user);
  const permissions = await resolvePermissions(safe);

  res.json({
    success: true,
    data: {
      id: safe.id,
      fullName: safe.full_name,
      username: safe.username,
      email: safe.email,
      role: safe.role,
      groupId: safe.group_id,
      permissions,
    },
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user.id, currentPassword, newPassword);
  res.json({ success: true, message: "Password updated successfully" });
});

const updateMe = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  const updated = await authService.updateOwnProfile(req.user.id, { name, email });
  const permissions = await resolvePermissions(updated);

  // Same shape as login/me — authSlice.updateProfile.fulfilled overwrites
  // state.user with this payload directly, so it must match.
  res.json({
    success: true,
    data: {
      id: updated.id,
      fullName: updated.full_name,
      username: updated.username,
      email: updated.email,
      role: updated.role,
      groupId: updated.group_id,
      permissions,
    },
  });
});

module.exports = { login, me, changePassword, updateMe };
