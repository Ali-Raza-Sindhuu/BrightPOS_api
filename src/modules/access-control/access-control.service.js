const ApiError = require("../../utils/api-error");
const groupModel = require("../groups/group.model");
const userModel = require("../users/user.model");
const permissionModel = require("./permission.model");
const groupPermissionModel = require("./group-permission.model");
const ipLogModel = require("./ip-log.model");
const settingsModel = require("./settings.model");

function slugifyCode(value) {
  return (value || "").toString().trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
}

// ── Groups ─────────────────────────────────────────────────────────────
// Deliberately thin wrappers around the existing groups module rather than
// a second, divergent implementation — access_groups is one table, and both
// /api/groups and /api/access-control/groups operate on it.
async function listGroups() {
  return groupModel.findAll();
}

async function createGroup({ name, description }) {
  if (!name) throw new ApiError(400, "Group Name is required");
  const code = slugifyCode(name);
  const dupe = await groupModel.findByCode(code);
  if (dupe) throw new ApiError(409, `A group with code "${code}" already exists`);
  return groupModel.create({ code, name, description });
}

async function updateGroup(id, { name, description, isActive }) {
  const group = await groupModel.findById(id);
  if (!group) throw new ApiError(404, "Group not found");
  if (!name) throw new ApiError(400, "Group Name is required");
  return groupModel.update(id, {
    code: group.code,
    name,
    description,
    isActive: isActive === undefined ? group.is_active : isActive,
  });
}

async function deleteGroup(id) {
  // Cascades per the guide: group_permissions rows go via ON DELETE CASCADE,
  // members' group_id goes to NULL via ON DELETE SET NULL. No member-count
  // guard here — that was a Day 1 choice this guide intentionally drops.
  await groupModel.remove(id);
}

// ── Catalog (all permissions, for building the tree/list UI) ───────────
async function getCatalog() {
  return permissionModel.findAll();
}

// ── Group <-> Permission ────────────────────────────────────────────────
async function getGroupPermissions(groupId) {
  const group = await groupModel.findById(groupId);
  if (!group) throw new ApiError(404, "Group not found");
  return groupPermissionModel.findByGroup(groupId);
}

async function updateGroupPermissions(groupId, permissions) {
  const group = await groupModel.findById(groupId);
  if (!group) throw new ApiError(404, "Group not found");

  if (!Array.isArray(permissions)) {
    throw new ApiError(400, "permissions must be an array of { permission_id, effect }");
  }

  const normalized = permissions
    .map((p) => ({
      permissionId: Number(p.permission_id),
      effect: p.effect === "DENY" ? "DENY" : "ALLOW",
    }))
    .filter((p) => Number.isInteger(p.permissionId));

  await groupPermissionModel.replaceForGroup(groupId, normalized);
}

// Used by auth to build the logged-in user's flat `permissions` array.
async function getAllowedPermissionKeysForUser(user) {
  if (!user || !user.group_id) return [];
  return groupPermissionModel.findAllowedKeysForGroup(user.group_id);
}

// ── Users <-> Group assignment (thin — full user CRUD lives in /api/users) ──
async function listUsersForAssignment() {
  const rows = await userModel.findAll();
  return rows.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.full_name,
    email: u.email,
    group_id: u.group_id,
  }));
}

async function assignUserGroup(userId, groupId) {
  const user = await userModel.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  if (groupId !== null && groupId !== undefined) {
    const group = await groupModel.findById(groupId);
    if (!group) throw new ApiError(404, "Group not found");
  }

  await userModel.update(userId, {
    fullName: user.full_name,
    username: user.username,
    email: user.email,
    role: user.role,
    groupId: groupId ?? null,
    isActive: Boolean(user.is_active),
  });
}

// ── IP tracking ─────────────────────────────────────────────────────────
async function logActivity({ userId, ipAddress, action, userAgent }) {
  await ipLogModel.create({ userId, ipAddress, action, userAgent });
}

async function listIpLogs({ page, limit, search }) {
  return ipLogModel.findPage({ page, limit, search });
}

// ── Settings ────────────────────────────────────────────────────────────
async function getSettings() {
  return settingsModel.getSettings();
}

async function updateSettings(fields) {
  return settingsModel.updateSettings(fields);
}

module.exports = {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  getCatalog,
  getGroupPermissions,
  updateGroupPermissions,
  getAllowedPermissionKeysForUser,
  listUsersForAssignment,
  assignUserGroup,
  logActivity,
  listIpLogs,
  getSettings,
  updateSettings,
};
