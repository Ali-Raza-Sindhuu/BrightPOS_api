# Historical database phase report

This records acceptance of the original 52-file baseline. The backend upgrade later moved canonical SQL to `database/migrations`, removed the unused legacy archive at your request, added migrations 0053/0054 and seeded the local administrator. For current counts and acceptance, see [backend completion report](backend-completion-report.md).

# Database phase completion report

Date: 2026-10-01. Scope: backend database schemas, migrations, local Docker database and the Aiven Free setup guide.

**Result: OK — local fresh-install database phase complete.** The local MySQL container is running and healthy. Remote Aiven provisioning/acceptance remains with the project owner. This report does not certify complete POS application behavior or deployment readiness.

## Delivered

- Replaced mixed, conflicting executable migration names with 52 consecutive dependency-ordered files (`0001`–`0052`), containing one SQL statement each.
- At initial database acceptance, preserved all 46 original SQL files in the former `src/migrations/legacy/` archive. Their Git-normalized hashes matched the original tracked files. That unused archive was subsequently removed during the backend upgrade at the owner's request.
- Completed 49 application schemas: 412 columns, 66 foreign keys and 3 CHECK constraints. Resolved missing access settings, expiry tags, customer returns, movement-ledger fields, receipt-line fields, location fields and decimal quantity compatibility.
- Added checksum-verified `_schema_migrations` history, exclusive runner locking, read-only status/dry run, explicit failed-state recording and refusal of unsafe legacy/untracked adoption.
- Added schema verification for engines, collations, columns/defaults, indexes, foreign keys/actions, enforced CHECKs and system settings/counter rows. Normal migration application also runs verification.
- Added local MySQL Docker Compose with health checking, localhost binding, a persistent named volume, and isolated integration-test databases.
- Added shared database-only configuration and verified TLS options for Aiven. Database tools do not require JWT configuration. Application pool and existing seed entry points now honor the same selected environment file.
- Added local setup, migration/recovery, schema reference and Aiven **Free** setup documentation. No new runtime dependencies were needed.

## Acceptance evidence

| Check | Result |
| --- | --- |
| Local engine | MySQL 8.4.11, image `mysql:8.4` |
| Container | `brightpos-database-mysql-1`, healthy |
| Local target | `127.0.0.1:3307`, `brightpos_local`, user `brightpos` |
| Empty-database install | All 52 migrations applied successfully |
| Schema verification | 49 application tables, 412 columns, 66 foreign keys, 3 CHECKs |
| Journal | 52 applied, 0 pending; separate infrastructure table |
| SQL enforcement | STRICT_TRANS_TABLES and foreign-key checks enabled throughout |
| Repeat application | Executed 0 files; schema verified; bootstrap rows preserved |
| Docker restart | Schema and journal persisted; repeat migration and verification passed afterward |
| Existing/unit tests | `npm.cmd test`: 10 passed, 0 failed |
| Real MySQL integration tests | `npm.cmd run test:db`: 14 passed, 0 failed |
| Patch formatting | `git diff --check` passed; only Windows line-ending notices |

The integration checks exercise fresh installation, read-only preview/status, repeat runs, all schema areas' insert shapes, fractional quantities, repeated signed stock movements, two-location stock keys, partial receipt fields, walk-in payments, foreign-key rejection/restrict behavior, transaction rollback, child cascade, schema drift, checksum/history corruption, concurrent runner refusal, failed migration recording and refusal of legacy/untracked tables.

The failure tests deliberately leave a `running` entry in **brightpos_migration_failure**, not in the main database. The three local fixture databases are cleared by integration tests; business data in `brightpos_local` is not cleared by those tests.

## Reuse

From `POS_Backend`, with Docker running:

```powershell
$env:POS_ENV_FILE = '.env.docker'
npm.cmd run db:up
npm.cmd run migrate
npm.cmd run db:verify
```

The ignored `.env.docker` was created from its committed example. Fresh clones follow [README.md](../README.md), including dependency installation and first-time environment-file creation. The volume `brightpos-database_mysql_data` preserves local data; ordinary `db:down` does not delete it. System bootstrap includes Main Warehouse, access settings and the expense-voucher counter. There are no application users or demo transactions in the fresh main database.

## Remaining boundaries

- **Aiven:** guide and TLS configuration are prepared, but no remote connection was tested. Provision the Free service and follow [the guide](aiven-free-database-setup.md). Add remote acceptance below after it passes.
- **Existing data:** this baseline is for empty databases. An old `_migrations` database needs a separate reviewed data/schema upgrade, not renamed history or direct execution of the archive.
- **Backend workflows:** transaction boundaries, totals/balances, stock reconciliation, authorization, cross-document consistency and idempotency remain separate backend tasks from the overall implementation plan.
- **Compatibility:** voucher number/location remain nullable to match the current insert path. Polymorphic source references need application validation. The schema reference documents these choices.
- **Future migrations:** append new files; extend schema-contract verification when adding ALTER/DROP changes. Applied files must remain immutable.
- **Deployment/UI:** Vercel deployment, frontend changes, portfolio presentation and business seed/demo data were outside this phase.

## Remote acceptance record (owner to complete)

| Field | Value |
| --- | --- |
| Aiven service plan | Free |
| Provisioned/tested date | Pending |
| Actual MySQL version | Pending |
| Migration count / pending | Pending; expected 52 / 0 |
| `db:verify` result | Pending |
| Negotiated verified TLS | Pending |
| Repeat migration executed files | Pending; expected 0 |

Record only nonsecret results. Do not include passwords, connection URIs or environment-file contents in this report.
