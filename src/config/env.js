const fs = require("fs");
const path = require("path");

// Resolve .env from the backend root, not from process.cwd(). cPanel/Passenger
// boots the app from the app root, but cron jobs and `npm run migrate` can be
// invoked from anywhere — relying on the CWD would silently load nothing.
const ROOT_DIR = path.join(__dirname, "..", "..");
const ENV_PATH = path.join(ROOT_DIR, ".env");

if (fs.existsSync(ENV_PATH)) {
  require("dotenv").config({ path: ENV_PATH });
} else {
  // Not fatal: on cPanel you may set variables through the "Setup Node.js App"
  // UI instead of a file. The required-var check below still catches gaps.
  require("dotenv").config();
}

function required(name) {
  const value = process.env[name];
  return value === undefined || value === null || value.trim() === "" ? null : value.trim();
}

function optional(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === null || value.trim() === "" ? fallback : value.trim();
}

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

const REQUIRED_VARS = ["DB_HOST", "DB_USER", "DB_NAME", "JWT_SECRET"];
const missing = REQUIRED_VARS.filter((name) => required(name) === null);

if (missing.length) {
  console.error(
    [
      "",
      "[config] Missing required environment variable(s):",
      ...missing.map((name) => `          - ${name}`),
      "",
      `[config] Expected a .env file at: ${ENV_PATH}`,
      "[config] Copy .env.example to .env and fill it in:",
      "[config]   cp .env.example .env",
      "",
    ].join("\n")
  );
  process.exit(1);
}

const nodeEnv = optional("NODE_ENV", "development");
const isProduction = nodeEnv === "production";

// An unset CORS_ORIGIN permits any origin only in development. Production
// browser requests are denied until the frontend origin list is configured.
const corsOrigins = optional("CORS_ORIGIN", "")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

if (isProduction && corsOrigins.length === 0) {
  console.warn(
    "[config] CORS_ORIGIN is not set while NODE_ENV=production — the API will " +
      "deny browser origins. Set it to your frontend URL."
  );
}

const config = {
  rootDir: ROOT_DIR,
  env: nodeEnv,
  isProduction,

  port: toInt(process.env.PORT, 5000),
  // Passenger (cPanel) hands the app a socket and ignores HOST, but an
  // explicit bind address matters when running behind a plain reverse proxy.
  host: optional("HOST", "0.0.0.0"),

  db: {
    host: required("DB_HOST"),
    port: toInt(process.env.DB_PORT, 3306),
    user: required("DB_USER"),
    password: optional("DB_PASSWORD", ""),
    database: required("DB_NAME"),
    connectionLimit: toInt(process.env.DB_CONNECTION_LIMIT, 10),
  },

  jwt: {
    secret: required("JWT_SECRET"),
    expiresIn: optional("JWT_EXPIRES_IN", "8h"),
  },

  corsOrigins,

  uploads: {
    dir: path.isAbsolute(optional("UPLOAD_DIR", ""))
      ? optional("UPLOAD_DIR", "")
      : path.join(ROOT_DIR, optional("UPLOAD_DIR", "uploads")),
    maxFileSizeMb: toInt(process.env.UPLOAD_MAX_FILE_SIZE_MB, 5),
  },

  trustProxy: toBool(process.env.TRUST_PROXY, true),
};

module.exports = config;
