# Aiven Free MySQL setup guide

Provider decision: Aiven **Free** MySQL. You provision the remote service; the local database has already been tested with Docker. No remote service was created or modified during this phase. Research checked 2026-10-01; recheck the console before creating a service.

## What the Free tier provides

Aiven documents one node, 1 CPU, 1 GB RAM, 1 GB disk, backups and monitoring. It requires no credit card and has no fixed expiration. The connection limit is 76; there is one service of each type per organization. There is no SLA/support, VPC, static IP, integration or forking. Inactive services may be powered off and require you to turn them back on. These limits suit a portfolio demo, subject to your data volume and usage. [Official Free tier details](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier).

## 1. Create the service yourself

1. Sign in to [Aiven Console](https://console.aiven.io/), create/select your organization and project.
2. Open Services → Create service → MySQL.
3. Select the **Free** tier/plan and confirm the service summary shows Free with no recurring charge. Do not select Developer or a paid trial. If Free is unavailable, stop and check your organization's existing Free MySQL service and the current offer.
4. Name it, for example `brightpos-portfolio`, and create it. Wait for Running status.
5. Free services do not allow you to choose a cloud provider or region. [Official creation instructions](https://aiven.io/docs/products/mysql/get-started).
6. Open Overview/Quick connect and record the exact host, port, username, password and database. Use the provided database, commonly `defaultdb`, rather than guessing the port or creating another database without checking permissions.
7. Download the project's CA certificate from the connection information/SSL section. [Certificate download guidance](https://aiven.io/docs/products/mysql/howto/connect-from-mysql-workbench).

## 2. Configure this repository

From `POS_Backend`, on first setup:

```powershell
Copy-Item .env.aiven.example .env.aiven
New-Item -ItemType Directory -Force certs
```

Save the downloaded certificate as `certs/aiven-ca.pem`. Edit `.env.aiven` and replace every placeholder with the service's connection values. Keep `DB_SSL=true`, `DB_SSL_CA_FILE=certs/aiven-ca.pem`, and pool size 3. The password is stored only in the ignored local file; keep any literal special characters correctly quoted for dotenv. `.env.aiven` and `certs/` are ignored by Git.

The connector validates both the certificate chain and hostname with TLS 1.2 or later. Connect using the DNS hostname shown by Aiven. Do not change `rejectUnauthorized` or disable hostname checks to work around a failed connection. Aiven's project CA is required for verified MySQL TLS. [Official TLS guidance](https://aiven.io/docs/platform/concepts/tls-ssl-certificates).

## 3. Apply to an empty database

```powershell
$env:POS_ENV_FILE = '.env.aiven'
npm.cmd run migrate -- --dry-run
npm.cmd run migrate
npm.cmd run migrate:status
npm.cmd run db:verify
```

Review the displayed host/port/database before applying. The expected dry run shows 54 pending migrations. The real run creates 51 application tables, the journal, and 3 bootstrap rows; verification must show 54 applied and a negotiated TLS cipher. A repeat migration must execute zero files.

The target must be empty or already contain this exact canonical baseline. Legacy `_migrations` or existing untracked tables are deliberately rejected; use a fresh database or a separately reviewed upgrade. Never run `test:db` against Aiven: it is designed to clear local test fixtures and will refuse the remote configuration.

If the dry run encounters unexpected tables, inspect them before proceeding. If a migration fails, follow the [recovery guide](../database/migrations/README.md); it will not automatically skip the error. Access/network configuration may also need to allow your client according to the console's current settings.

## 4. Record remote acceptance

After you run the commands successfully, add the date, actual MySQL version, migration count and TLS result to the completion report. Do not paste passwords or full connection strings. Until then, remote Aiven acceptance is pending; local Docker acceptance is complete.

## Later Vercel backend configuration

Set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL=true and DB_CONNECTION_LIMIT=3 as backend environment variables. Set `DB_SSL_CA` to the complete PEM text (literal newlines or escaped `\n` work), and omit `DB_SSL_CA_FILE` in that hosted environment. The certificate should not depend on a developer's filesystem. Both the application pool and migration tools use the same TLS configuration.

Run migrations once from a controlled workstation/release job, never on each Vercel request or function cold start. Each instance has its own pool; size 3 does not guarantee the whole deployment stays below 76 connections. Pool behavior, application credentials, API checks and Vercel deployment are later phases. Other application variables such as JWT_SECRET are not required for these database-only commands.
