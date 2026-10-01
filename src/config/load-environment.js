const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '../..');
const envPath = process.env.POS_ENV_FILE
  ? path.resolve(rootDir, process.env.POS_ENV_FILE)
  : path.join(rootDir, '.env');

if (process.env.POS_ENV_FILE && !fs.existsSync(envPath)) {
  throw new Error(`Selected environment file does not exist: ${envPath}`);
}
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath, quiet: true });
}

module.exports = { rootDir, envPath };
