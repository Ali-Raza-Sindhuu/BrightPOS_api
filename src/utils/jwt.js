const jwt = require("jsonwebtoken");
const config = require("../config/env");

// config/env.js loads .env from the app root and already refuses to boot when
// JWT_SECRET is missing, so no undefined-secret check is needed here.
const JWT_SECRET = config.jwt.secret;
const JWT_EXPIRES_IN = config.jwt.expiresIn;

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { signToken, verifyToken };
