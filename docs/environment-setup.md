# Environment configuration

| File | Purpose | Commit? |
| --- | --- | --- |
| `.env.example` | Canonical local API/Docker template | Yes |
| `.env` | Default active local configuration | No |
| `.env.aiven.example` | Full API + Aiven TLS template | Yes |
| `.env.aiven` | Your selected hosted database configuration | No |
| `.env.test.example` | Dedicated local integration-test target | Yes |
| `.env.test` | Local test configuration | No |
| `.env.docker.example` / `.env.docker` | Compatibility alias for the database phase's commands | Example only |
| `.env.before-backend-upgrade` | Preserved prior workspace configuration | No |
| `certs/` | Local Aiven CA certificate | No |

One file is selected at a time. The default is repository-root `.env`; POS_ENV_FILE overrides that path. Missing explicitly selected files are errors. Existing process environment variables win, so changing the file will not override exported DB values left in your shell. All runtime, migration, verification, seed and recovery entry points use this loader.

PowerShell Aiven selection:

```powershell
$env:POS_ENV_FILE = '.env.aiven'
npm.cmd run check
Remove-Item Env:POS_ENV_FILE
```

Local Docker runs at host `127.0.0.1`, port `3307`, database `brightpos_local`, user `brightpos`. The API runs on `127.0.0.1:5000`. Containers connecting to MySQL internally use the service name and port 3306; the API currently runs on your host, not inside Docker.

JWT_SECRET must be at least 32 characters. Use a different random value per deployment. Production refuses distributed placeholder secrets, non-TLS DB configuration and missing CORS origins. Database-only migration/verification tools do not need JWT or CORS. Database passwords are not trimmed by the connector.

ADMIN_PASSWORD must be a unique password of at least 12 characters before `seed:admin`; the template is rejected. ADMIN_EMAIL is optional. Seeding creates rights as well as a user and does not reset an existing password. `npm run create-admin` uses ADMIN_* values or explicit CLI flags and intentionally resets/promotes that administrator.

DB_SSL=true enables chain and hostname verification. Supply DB_SSL_CA_FILE for a local certificate, or DB_SSL_CA for complete PEM text in a hosted environment, never both. Do not disable verification. Pool defaults: 3 connections, 30 queued acquisitions, 30-second idle timeout. Limits apply per process, not across a serverless deployment.

CORS_ORIGIN contains comma-separated exact HTTP(S) origins, with no path. TRUST_PROXY defaults to false locally. Aiven/Vercel example uses 1 hop; confirm the actual hosting proxy chain rather than trusting arbitrary forwarded headers. Files are ignored by Git; do not copy secret values into guides or browser VITE_* variables.
