const asyncHandler = require("../../utils/asyncHandler");
const accessControlService = require("./accessControlServices");
const userModel = require("../users/userModel");

// ── Groups ─────────────────────────────────────────────────────────────
const listGroups = asyncHandler(async (req, res) => {
  const data = await accessControlService.listGroups();
  res.json({ success: true, data });
});

const createGroup = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const data = await accessControlService.createGroup({ name, description });
  res.json({ success: true, data });
});

const updateGroup = asyncHandler(async (req, res) => {
  const { name, description, isActive } = req.body;
  const data = await accessControlService.updateGroup(req.params.id, { name, description, isActive });
  res.json({ success: true, data });
});

const deleteGroup = asyncHandler(async (req, res) => {
  await accessControlService.deleteGroup(req.params.id);
  res.json({ success: true });
});

const getGroupPermissions = asyncHandler(async (req, res) => {
  const data = await accessControlService.getGroupPermissions(req.params.id);
  res.json({ success: true, data });
});

const updateGroupPermissions = asyncHandler(async (req, res) => {
  await accessControlService.updateGroupPermissions(req.params.id, req.body.permissions);
  res.json({ success: true });
});

// ── Catalog ────────────────────────────────────────────────────────────
const getCatalog = asyncHandler(async (req, res) => {
  const permissions = await accessControlService.getCatalog();
  res.json({ success: true, data: { permissions } });
});

// ── Users <-> Group assignment ──────────────────────────────────────────
const listUsers = asyncHandler(async (req, res) => {
  const data = await accessControlService.listUsersForAssignment();
  res.json({ success: true, data });
});

const assignUserGroup = asyncHandler(async (req, res) => {
  await accessControlService.assignUserGroup(req.params.id, req.body.group_id);
  res.json({ success: true });
});

// ── IP tracking ─────────────────────────────────────────────────────────
const listIpLogs = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const search = req.query.search;
  const { rows, total } = await accessControlService.listIpLogs({ page, limit, search });
  res.json({ success: true, data: rows, total });
});

// ── Settings ────────────────────────────────────────────────────────────
const getSettings = asyncHandler(async (req, res) => {
  const data = await accessControlService.getSettings();
  res.json({ success: true, data });
});

const updateSettings = asyncHandler(async (req, res) => {
  const data = await accessControlService.updateSettings(req.body);
  res.json({ success: true, data });
});

// ── Current user's own permissions (dedicated refresh endpoint, guide 3.1) ──
const getMyPermissions = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.id);
  const permissions = await accessControlService.getAllowedPermissionKeysForUser(user);
  res.json({ success: true, data: permissions });
});

module.exports = {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupPermissions,
  updateGroupPermissions,
  getCatalog,
  listUsers,
  assignUserGroup,
  listIpLogs,
  getSettings,
  updateSettings,
  getMyPermissions,
};
