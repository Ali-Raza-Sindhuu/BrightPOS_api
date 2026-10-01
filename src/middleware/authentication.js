const { verifyToken, credentialVersion } = require("../utils/jwt");
const ApiError = require("../utils/api-error");
const asyncHandler = require("../utils/async-handler");
const userModel = require("../modules/users/user.model");

/**
 * Verifies the Bearer token, then re-checks is_active against the DB on
 * every request — a token issued before a deactivation shouldn't keep working.
 * Attaches { id, username, role, group_id } to req.user.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new ApiError(401, "Missing or malformed Authorization header");
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    throw new ApiError(401, "Invalid or expired token");
  }

  const user = await userModel.findById(decoded.id);
  if (!user) {
    throw new ApiError(401, "User no longer exists");
  }
  if (!user.is_active) {
    throw new ApiError(403, "This account has been deactivated");
  }

  if (decoded.credentialVersion !== credentialVersion(user.password_hash)) {
    throw new ApiError(401, 'Credentials changed; log in again');
  }

  req.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    groupId: user.group_id,
  };

  next();
});

module.exports = authenticate;
