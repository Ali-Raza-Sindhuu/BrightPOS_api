const ApiError = require("../../utils/api-error");
const { signToken, credentialVersion } = require("../../utils/jwt");
const { hashPassword, comparePassword } = require("../../utils/password");
const userModel = require("../users/user.model");

async function login(identifier, password) {
  if (!identifier || !password) {
    throw new ApiError(400, "Email/username and password are required");
  }

  const trimmedIdentifier = (identifier || "").trim();
  const user = await userModel.findByIdentifier(trimmedIdentifier);
  if (!user) {    // Same message for "no such user" and "wrong password" so login
    // can't be used to enumerate valid usernames/emails.
    throw new ApiError(401, "Invalid credentials");
  }

  if (!user.is_active) {    throw new ApiError(403, "This account has been deactivated. Contact your administrator.");
  }

  const passwordMatches = await comparePassword(password, user.password_hash);
  if (!passwordMatches) {    throw new ApiError(401, "Invalid credentials");
  }

  await userModel.touchLastLogin(user.id);
  const ctx=await require('../counter/management.service').context(user);

  const token = signToken({
    id: user.id,
    role: user.role,
    groupId: user.group_id,
    credentialVersion: credentialVersion(user.password_hash),
  });

  return {
    token,
    user: {...userModel.toSafeJSON(user),operationalRole:ctx.role,storeId:ctx.storeId},
  };
}

async function changePassword(userId, currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Current and new password are required");
  }
  if (newPassword.length < 8) {
    throw new ApiError(400, "New password must be at least 8 characters");
  }

  const user = await userModel.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const passwordMatches = await comparePassword(currentPassword, user.password_hash);
  if (!passwordMatches) {
    throw new ApiError(401, "Current password is incorrect");
  }

  const newHash = await hashPassword(newPassword);
  await userModel.updatePasswordHash(userId, newHash);
}

async function updateOwnProfile(userId, { name, email }) {
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new ApiError(400, "Name is required");
  }

  const trimmedEmail = email ? email.trim() : null;
  if (trimmedEmail) {
    // findByEmailOrUsername needs a username to OR against — pass a value
    // that can never collide (empty string never matches a real username)
    // so this only actually checks the email side.
    const dupe = await userModel.findByEmailOrUsername(trimmedEmail, "", userId);
    if (dupe) {
      throw new ApiError(409, "That email is already in use by another account");
    }
  }

  const updated = await userModel.updateOwnProfile(userId, {
    fullName: trimmedName,
    email: trimmedEmail,
  });
  return userModel.toSafeJSON(updated);
}

module.exports = { login, changePassword, updateOwnProfile };
