# BrightPOS backend

Express 5 + MySQL retail POS API. The database and core backend workflow upgrade are tested locally with Docker. Aiven Free provisioning, Vercel preview acceptance and frontend integration remain separate steps.

## Run locally

Use Node.js 22+ (tested on 24.20.0) and Docker Desktop with Linux containers. Run commands from this repository. Fresh clone, PowerShell:

```powershell
npm.cmd ci
Copy-Item .env.example .env
```

Edit `.env`: generate a unique JWT_SECRET of at least 32 characters and set a unique ADMIN_PASSWORD of at least 12 characters. Keep the supplied local Docker DB values. Only copy the example on first setup; do not overwrite an existing configured file.

```powershell
npm.cmd run db:up
npm.cmd run migrate
npm.cmd run seed:admin
npm.cmd run check
npm.cmd run dev
```

API: `http://127.0.0.1:5000/api`; health: `/api/health`. Login: `POST /api/auth/login` with `{"identifier":"admin","password":"your configured password"}`. The admin seed creates the permission catalog, Administrators group and user. Email is optional. Repeat seeding preserves an existing password; `create-admin` is the explicit password-reset recovery command and also configures group rights.

For this workspace, `.env` is already configured with generated local JWT/admin secrets, and the local admin is seeded. Read ADMIN_PASSWORD from your ignored `.env`; credentials are not committed or printed in reports. Your previous `.env` was preserved as ignored `.env.before-backend-upgrade`.

On macOS/Linux use `npm`. `$env:POS_ENV_FILE = '.env.aiven'` selects Aiven for a PowerShell session; `export POS_ENV_FILE=.env.aiven` does the same in a Unix shell. Remove the PowerShell override with `Remove-Item Env:POS_ENV_FILE` to return to `.env`. Process environment variables take precedence over files.

## Folder structure

```text
database/
  migrations/          # Immutable numbered SQL, including additive upgrades
  seeds/               # Permission catalog and administrator bootstrap
docker/mysql/init/     # First-volume initialization for local test databases
scripts/               # Migration, verification, code/config checks and recovery
src/
  app.js               # Express application export
  config/              # Environment selection and shared verified DB connection
  middleware/          # Authentication, permissions, upload and error handling
  modules/             # Domain folders in lowercase kebab-case
  utils/               # Shared money, validation, inventory and response helpers
tests/
  unit/                # Fast rules and HTTP smoke tests
  integration/         # Real MySQL schema and backend workflow tests
docs/                  # Schema, environment, API and completion documentation
server.js              # Local server with schema preflight and shutdown handling
```

Domain files use `domain.controller.js`, `domain.service.js`, `domain.model.js`, `domain.routes.js`. Existing public API paths are preserved. Legacy migration files were removed at your request; canonical SQL names/checksums remain intact. Databases carrying the old `_migrations` journal still require a reviewed upgrade.

## Checks

```powershell
npm.cmd run check:code
npm.cmd test
npm.cmd run db:verify
npm.cmd run test:db
Copy-Item .env.test.example .env.test  # First test setup only
$env:POS_ENV_FILE = '.env.test'
npm.cmd run test:backend
Remove-Item Env:POS_ENV_FILE
```

Integration suites clear **only dedicated local fixture databases** and refuse remote targets. Run the two suites sequentially; they share one fixture schema. They never clear `brightpos_local`. Docker binds MySQL to `127.0.0.1:3307`; its named volume persists across restart and ordinary `db:down`. Avoid deleting that volume if you need its data.

Current schema: 54 migrations, 51 application tables, 418 columns, 68 foreign keys and 3 CHECKs, plus `_schema_migrations`. Database commands do not require JWT configuration.

## Guides

- [Environment setup](docs/environment-setup.md)
- [API behavior and frontend compatibility](docs/backend-api-contract.md)
- [Backend upgrade report](docs/backend-completion-report.md)
- [Migration ordering/recovery](database/migrations/README.md)
- [Schema reference](docs/database-schema.md)
- [Aiven Free guide](docs/aiven-free-database-setup.md)
- [Vercel deployment preparation](VERCEL_DEPLOYMENT.md)
- [Original database acceptance report](docs/database-completion-report.md)
