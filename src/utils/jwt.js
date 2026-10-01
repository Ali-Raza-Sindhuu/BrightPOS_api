const jwt = require("jsonwebtoken");
const crypto = require('node:crypto');
const config = require("../config/env");

// config/env.js loads .env from the app root and already refuses to boot when
// JWT_SECRET is missing, so no undefined-secret check is needed here.
const JWT_SECRET = config.jwt.secret;
const JWT_EXPIRES_IN = config.jwt.expiresIn;

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
}

function credentialVersion(passwordHash) {
  return crypto.createHmac('sha256', JWT_SECRET).update(passwordHash).digest('hex');
}
module.exports = { signToken, verifyToken, credentialVersion };
