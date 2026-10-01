const ApiError = require("../../utils/api-error");
const groupModel = require("./group.model");

function slugifyCode(value) {
  return (value || "")
    .toString()
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

async function listGroups() {
  return groupModel.findAll();
}

async function getGroup(id) {
  const group = await groupModel.findById(id);
  if (!group) throw new ApiError(404, "Group not found");
  return group;
}

async function createGroup({ name, description }) {
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new ApiError(400, "Group Name is required");
  }

  const nameDupe = await groupModel.findByName(trimmedName);
  if (nameDupe) {
    throw new ApiError(409, `A group named "${trimmedName}" already exists`);
  }

  const code = slugifyCode(trimmedName);
  const codeDupe = await groupModel.findByCode(code);
  if (codeDupe) {
    throw new ApiError(409, `A group with code "${code}" already exists — choose a different name`);
  }

  return groupModel.create({ code, name: trimmedName, description });
}

async function updateGroup(id, { name, description, isActive }) {
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new ApiError(400, "Group Name is required");
  }

  const group = await groupModel.findById(id);
  if (!group) throw new ApiError(404, "Group not found");

  const nameDupe = await groupModel.findByName(trimmedName, id);
  if (nameDupe) {
    throw new ApiError(409, `A group named "${trimmedName}" already exists`);
  }

  // Keep the original code stable on rename — regenerating it would break
  // anything that referenced the old code (audit logs, external refs, etc).
  return groupModel.update(id, {
    code: group.code,
    name: trimmedName,
    description,
    isActive: isActive === undefined ? group.is_active : isActive,
  });
}

async function deleteGroup(id) {
  const group = await groupModel.findById(id);
  if (!group) throw new ApiError(404, "Group not found");
  // Per the guide's testing checklist: deleting a group should cascade
  // (group_permissions via ON DELETE CASCADE, users.group_id via ON DELETE
  // SET NULL) rather than being blocked. Day 1 originally blocked this —
  // intentionally relaxed now to match the guide.
  await groupModel.remove(id);
}

async function getMemberIds(id) {
  const group = await groupModel.findById(id);
  if (!group) throw new ApiError(404, "Group not found");
  return groupModel.findMemberIds(id);
}

async function setMembers(id, userIds) {
  const group = await groupModel.findById(id);
  if (!group) throw new ApiError(404, "Group not found");

  if (!Array.isArray(userIds)) {
    throw new ApiError(400, "userIds must be an array");
  }
  const uniqueIds = [...new Set(userIds.map(Number).filter(Number.isInteger))];

  await groupModel.replaceMembers(id, uniqueIds);
  return groupModel.findMemberIds(id);
}

module.exports = {
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  getMemberIds,
  setMembers,
};
