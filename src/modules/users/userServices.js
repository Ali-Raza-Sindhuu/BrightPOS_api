const bcrypt = require("bcryptjs");
const ApiError = require("../../utils/ApiError");
const userModel = require("./userModel");
const groupModel = require("../groups/groupModel");

const SALT_ROUNDS = 10;
const VALID_ROLES = ["admin", "user"];

function assertValidRole(role) {
  if (role && !VALID_ROLES.includes(role)) {
    throw new ApiError(400, `Role must be one of: ${VALID_ROLES.join(", ")}`);
  }
}

// Only username is truly required — email is optional (migration 008)
// to match the frontend's "Email (optional)" field.
function assertRequiredFields({ username }) {
  if (!username || !username.trim()) {
    throw new ApiError(400, "Username is required.");
  }
}

async function assertGroupExists(groupId) {
  if (groupId === null || groupId === undefined || groupId === "") return;
  const group = await groupModel.findById(groupId);
  if (!group) throw new ApiError(404, "Selected group does not exist.");
}

async function listUsers() {
  const rows = await userModel.findAll();
  return rows.map(userModel.toSafeJSON);
}

async function getUser(id) {
  const user = await userModel.findById(id);
  if (!user) throw new ApiError(404, "User not found.");
  return userModel.toSafeJSON(user);
}

async function createUser({ fullName, username, email, password, role = "user", groupId = null }) {
  assertRequiredFields({ username });
  assertValidRole(role);
  await assertGroupExists(groupId);

  if (!password || password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters.");
  }

  const trimmedEmail = email ? email.trim() : null;
  const dupe = await userModel.findByEmailOrUsername(trimmedEmail, username.trim());
  if (dupe) {
    throw new ApiError(409, "A user with that email or username already exists.");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await userModel.create({
    fullName: fullName?.trim() || username.trim(),
    username: username.trim(),
    email: trimmedEmail,
    passwordHash,
    role,
    groupId: groupId || null,
  });
  return userModel.toSafeJSON(user);
}

async function updateUser(id, { fullName, username, email, role, groupId, isActive, password }) {
  const existing = await userModel.findById(id);
  if (!existing) throw new ApiError(404, "User not found.");

  assertRequiredFields({ username });
  assertValidRole(role);
  await assertGroupExists(groupId);

  const trimmedEmail = email ? email.trim() : null;
  const dupe = await userModel.findByEmailOrUsername(trimmedEmail, username.trim(), id);
  if (dupe) {
    throw new ApiError(409, "A user with that email or username already exists.");
  }

  await userModel.update(id, {
    fullName: fullName?.trim() || existing.full_name,
    username: username.trim(),
    email: trimmedEmail,
    role: role || existing.role,
    groupId: groupId ?? existing.group_id,
    isActive: isActive ?? Boolean(existing.is_active),
  });

  // Password change is optional on update - only touch it if one was sent.
  if (password) {
    if (password.length < 6) {
      throw new ApiError(400, "Password must be at least 6 characters.");
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await userModel.updatePasswordHash(id, passwordHash);
  }

  return userModel.toSafeJSON(await userModel.findById(id));
}

async function deleteUser(id) {
  const existing = await userModel.findById(id);
  if (!existing) throw new ApiError(404, "User not found.");
  await userModel.remove(id);
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
};
