# Canonical database migrations

This directory contains the executable baseline: `0001_…sql` through `0054_…sql`. Every file contains one statement. The runner reads only SQL directly in this directory, orders by four-digit sequence, and rejects gaps. The original legacy archive was removed at the project owner's request. Only the canonical files remain. The runner still refuses legacy database journals rather than silently adopting old tables.

## Dependency order

| Range | Purpose |
| --- | --- |
| 0001–0010 | Business units, users, access groups/permissions, access settings/logs |
| 0011–0019 | Catalog masters, suppliers, customers, item details |
| 0020–0023 | Per-location inventory, movement ledger, opening stock |
| 0024–0027 | Purchases and goods receipts |
| 0028–0035 | Sales, payments, sale/purchase returns |
| 0036–0039 | Bookings, payments, legacy customer returns |
| 0040–0045 | Reorders, snapshots, transfers and expiry tags |
| 0046–0049 | Expenses, daybook and voucher counter |
| 0050–0052 | Settings, counter and Main Warehouse bootstrap rows |
| 0053–0054 | Booking/invoice linkage and persistent login-attempt buckets |

Parents precede children. All application tables use InnoDB and utf8mb4_unicode_ci. Foreign-key checks stay enabled throughout installation. See [schema notes](../../docs/database-schema.md) for properties and deliberate compatibility decisions.

## Commands (from repository root)

Select `$env:POS_ENV_FILE = '.env.docker'` for Docker or `.env.aiven` for your remote service. See the [local quick start](../../README.md) and [Aiven Free guide](../../docs/aiven-free-database-setup.md).

```powershell
npm.cmd run migrate -- --dry-run
npm.cmd run migrate
npm.cmd run migrate:status
npm.cmd run db:verify
```

Dry run and status only read metadata. Apply serializes cooperating runners using a MySQL named lock. The journal `_schema_migrations` records version, filename, SHA-256 checksum, running/applied state and timestamps. A record becomes applied only after its statement succeeds. Repeat applies are no-ops; normal apply finishes with schema verification. Verification checks engine, collation, exact columns/defaults/nullability, indexes, foreign keys/actions, enforced CHECK constraints and required settings/counter rows. It detects missing/extra tables and schema drift.

Migration commands use database configuration only; no API server or JWT secret is needed. Files are checked after normalizing BOM and CRLF, allowing Windows and Linux checkouts to share checksums.

## Existing databases and recovery

This is a **fresh database baseline**, not an in-place legacy upgrade. Renaming files does not translate `_migrations` into `_schema_migrations`. The runner refuses a legacy journal, nonempty untracked database, changed applied file, unknown/nonconsecutive history or a running/failed record. It never auto-adopts old tables or deletes your data.

MySQL DDL can commit implicitly; a transaction cannot roll back an entire schema installation. [MySQL implicit-commit reference](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html). A failed statement leaves a running journal row so the next run stops for review.

For a disposable, brand-new setup with no required data: create another empty database and run the baseline there, or explicitly recreate only the disposable database after reviewing its contents. Never remove the persistent local volume casually.

For a database containing required data:

1. Stop migration attempts and application writes; preserve the error and failing filename.
2. Back up the database and journal. Inspect the failing statement, `SHOW CREATE TABLE`, and the affected data; a statement may have succeeded before a process interruption prevented the journal update.
3. Restore any accidentally changed applied migration from version control. Do not clear the journal or mark all files applied to bypass verification.
4. Review a repair in a copy of the database. A journal repair is justified only after establishing the exact statement outcome; otherwise restore a consistent backup or prepare a reviewed legacy/repair upgrade.
5. Resume only after review, then run `db:verify`. No automatic destructive recovery is provided.

## Adding future changes

Append `0055_descriptive_name.sql`, then subsequent consecutive numbers. Never modify an applied file. Use one ordinary SQL statement per file; split multi-statement changes into separate migrations. Stored routines, DELIMITER and executable SQL comments are unsupported. Avoid `IF NOT EXISTS` as a substitute for checking the schema. Preserve the parent-before-child order and include required indexes/FKs explicitly.

The current schema contract is derived from baseline CREATE TABLE files. When adding ALTER/DROP migrations, extend `scripts/lib/schema.js` to model their resulting schema and update the integration tests; do not disable verification. Verify both a fresh install and an upgrade from the prior baseline on disposable test databases before release.

The named lock coordinates these runners; it does not prevent a DBA or application from modifying tables. Apply with application writes stopped. [MySQL named-lock reference](https://dev.mysql.com/doc/refman/8.4/en/locking-functions.html).
