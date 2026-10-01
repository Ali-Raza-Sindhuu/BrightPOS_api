const fs = require('node:fs');
const path = require('node:path');
const { rootDir } = require('./load-environment');

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required database variable: ${name}`);
  return value;
}

function positiveInteger(name, fallback, max) {
  const value = process.env[name] ?? String(fallback);
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) {
    throw new Error(`${name} must be an integer from 1 to ${max}`);
  }
  return Number(value);
}

function getDatabaseOptions() {
  const mode = (process.env.DB_SSL || 'false').toLowerCase();
  if (!['true', 'false', '1', '0'].includes(mode)) {
    throw new Error('DB_SSL must be true or false');
  }
  const sslEnabled = mode === 'true' || mode === '1';
  const caFile = process.env.DB_SSL_CA_FILE?.trim();
  const caText = process.env.DB_SSL_CA?.trim();
  if (caFile && caText) throw new Error('Set DB_SSL_CA_FILE or DB_SSL_CA, not both');
  if (!sslEnabled && (caFile || caText)) throw new Error('A CA certificate requires DB_SSL=true');
  const options = {
    host: required('DB_HOST'),
    port: positiveInteger('DB_PORT', 3306, 65535),
    user: required('DB_USER'),
    password: process.env.DB_PASSWORD || '',
    database: required('DB_NAME'),
    charset: 'utf8mb4',
    dateStrings: true,
    connectTimeout: positiveInteger('DB_CONNECT_TIMEOUT_MS', 10000, 300000),
    multipleStatements: false,
  };
  if (sslEnabled) {
    const ca = caFile ? fs.readFileSync(path.resolve(rootDir, caFile), 'utf8') : caText?.replace(/\\n/g, '\n');
    options.ssl = { rejectUnauthorized: true, verifyIdentity: true, minVersion: 'TLSv1.2' };
    if (ca) options.ssl.ca = ca;
  }
  return options;
}

module.exports = { getDatabaseOptions, positiveInteger };
