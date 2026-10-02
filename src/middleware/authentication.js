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
  if (decoded.purpose === 'demo') throw new ApiError(403, 'Demo tokens cannot access business routes');
  if (!user) {
    throw new ApiError(401, "User no longer exists");
  }
  if (!user.is_active) {
    throw new ApiError(403, "This account has been deactivated");
  }

  if (decoded.credentialVersion !== credentialVersion(user.password_hash)) {
    throw new ApiError(401, 'Credentials changed; log in again');
  }

  const pool = require('../config/db');
  const [[staff]] = await pool.query('SELECT role,is_active FROM store_staff WHERE store_id=? AND user_id=?', [user.store_id,user.id]);
  if (staff && !staff.is_active) throw new ApiError(403, 'Staff access is inactive');
  const [[settings]] = await pool.query('SELECT session_timeout_minutes FROM store_settings WHERE store_id=?', [user.store_id]);
  if (settings && Date.now()/1000-decoded.iat > settings.session_timeout_minutes*60) throw new ApiError(401, 'Staff session timed out; sign in again');
  if (decoded.pinRevision !== undefined) {
    const [[credentials]] = await pool.query('SELECT credential_revision FROM staff_credentials WHERE store_id=? AND user_id=?', [user.store_id,user.id]);
    if (!credentials || Number(credentials.credential_revision)!==decoded.pinRevision) throw new ApiError(401, 'PIN changed; sign in again');
  }
  // The established APIs belong to the single business store. Demo sessions
  // use a separate database and their dedicated router.
  if (user.store_id !== 1 && !req.originalUrl.startsWith('/api/counter/')) throw new ApiError(403, 'This store must use scoped counter routes');

  req.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    groupId: user.group_id,
    storeId: user.store_id,
    operationalRole: staff?.role || null,
  };

  require('../utils/request-context').run({user:req.user,request:req},()=>next());
});

module.exports = authenticate;
