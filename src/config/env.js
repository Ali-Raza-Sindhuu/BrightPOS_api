const path = require('node:path');
const { rootDir, envPath } = require('./load-environment');
const { getDatabaseOptions, positiveInteger } = require('./database');

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}. Selected file: ${envPath}`);
  return value;
}
const env = process.env.NODE_ENV || 'development';
if (!['development', 'test', 'production'].includes(env)) throw new Error('NODE_ENV must be development, test or production');
const isProduction = env === 'production';
const dbOptions = getDatabaseOptions();
const secret = required('JWT_SECRET');
if (secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
if (isProduction && /replace|change.this|local.only/i.test(secret)) throw new Error('Set a unique production JWT_SECRET');
if (isProduction && !dbOptions.ssl) throw new Error('Production Aiven connections require DB_SSL=true');
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map(value => value.trim().replace(/\/$/, '')).filter(Boolean);
for (const origin of corsOrigins) {
  const parsed = new URL(origin);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) throw new Error('CORS_ORIGIN must contain exact HTTP(S) origins');
}
if (isProduction && !corsOrigins.length) throw new Error('Production requires CORS_ORIGIN');
const proxy = process.env.TRUST_PROXY || 'false';
const trustProxy = proxy === 'true' ? true : proxy === 'false' ? false : /^\d+$/.test(proxy) ? Number(proxy) : proxy;
const connectionLimit = positiveInteger('DB_CONNECTION_LIMIT', 3, 20);
module.exports = {
  rootDir, env, isProduction,
  port: positiveInteger('PORT', 5000, 65535),
  host: process.env.HOST || '127.0.0.1',
  db: { ...dbOptions, connectionLimit, queueLimit: positiveInteger('DB_QUEUE_LIMIT', 30, 1000) },
  jwt: { secret, expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  corsOrigins, trustProxy,
  uploads: { dir: path.resolve(rootDir, process.env.UPLOAD_DIR || 'uploads'), maxFileSizeMb: positiveInteger('UPLOAD_MAX_FILE_SIZE_MB', 4, 10) },
};
