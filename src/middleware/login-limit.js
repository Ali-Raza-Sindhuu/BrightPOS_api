const crypto = require('node:crypto');
const pool = require('../config/db');
const config = require('../config/env');
const ApiError = require('../utils/api-error');
const asyncHandler = require('../utils/async-handler');

async function consumeLoginAttempt(ip, identifier, database = pool) {
  const buckets = [[`ip:${ip}`, 60], [`account:${ip}:${identifier.toLowerCase()}`, 10]];
  const conn = await database.getConnection();
  let limited = false;
  try {
    await conn.beginTransaction();
    for (const [key, limit] of buckets) {
      const hash = crypto.createHmac('sha256', config.jwt.secret).update(key).digest('hex');
      await conn.query('INSERT IGNORE INTO auth_login_limits (bucket_key) VALUES (?)', [hash]);
      const [[row]] = await conn.query('SELECT attempts, TIMESTAMPDIFF(SECOND, window_start, UTC_TIMESTAMP()) AS age FROM auth_login_limits WHERE bucket_key = ? FOR UPDATE', [hash]);
      const expired = Number(row.age) >= 900;
      if (!expired && Number(row.attempts) >= limit) limited = true;
      await conn.query('UPDATE auth_login_limits SET attempts = ?, window_start = IF(?, UTC_TIMESTAMP(), window_start) WHERE bucket_key = ?', [expired ? 1 : Math.min(Number(row.attempts) + 1, limit + 1), expired, hash]);
    }
    await conn.query('DELETE FROM auth_login_limits WHERE window_start < UTC_TIMESTAMP() - INTERVAL 1 DAY LIMIT 100');
    await conn.commit();
  } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
  if (limited) throw new ApiError(429, 'Too many login attempts; try again in 15 minutes');
}
const loginLimit = asyncHandler(async (req, res, next) => {
  const body=req.body || {};
  const identifier = body.email || body.username || body.identifier;
  if (typeof identifier !== 'string' || !identifier.trim() || identifier.length > 255 || typeof body.password !== 'string' || !body.password || body.password.length > 1024) throw new ApiError(400, 'Valid username/email and password are required');
  await consumeLoginAttempt(req.ip, identifier.trim());
  next();
});
module.exports = loginLimit;
module.exports.consumeLoginAttempt = consumeLoginAttempt;
