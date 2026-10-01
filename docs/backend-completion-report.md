# Backend upgrade completion report

Date: 2026-10-01. **OK — core backend upgrade accepted locally.** This covers the backend code, internal naming, configuration, core transaction workflows and local Docker acceptance. Frontend integration and remote Aiven/Vercel acceptance have not been performed.

## Structure and setup

- Domain folders use lowercase kebab-case; files use controller/service/model/routes suffixes. Static import checks verify exact casing for Linux compatibility.
- Canonical SQL lives in `database/migrations`, seeds in `database/seeds`, and tests in `tests/unit` / `tests/integration`. All corresponding imports and npm commands were updated.
- The unused legacy SQL archive was removed at the owner's request. Original baseline migration filenames, SQL and checksums remain intact after moving. Legacy database history is still refused rather than automatically adopted.
- `.env` is the default local setup. Docker, Aiven and test examples now share variable names and the same loader. The previous local file remains in ignored `.env.before-backend-upgrade`.
- Local JWT/admin secrets were generated into ignored configuration files. `admin` was seeded with an active Administrators group and 170 catalog permissions. No secret values were written into this report.
- The DB pool is bounded to 3 connections by default, with queue and idle limits. Local startup verifies the complete schema before listening.

## Corrections delivered

| Finding | Result |
| --- | --- |
| Purchase strict-mode detail failure / undefined rounding branch | Detail query corrected; financial edits rejected in favor of payment endpoints |
| Purchase forged totals, overpayments, unsafe lifecycle edits | Validated finite decimal input and server totals; transactional guards against structural edits/deletion after posting |
| Receipt join multiplication and cross-purchase/duplicate lines | Preaggregated receipt quantities, explicit line validation and serialized purchase/GRN locks |
| Customer opening-balance double deduction | Opening balance remains immutable; payment and return credits appear once in derived summary/ledger |
| DECIMAL string payment concatenation and stale supplier paid totals | Explicit numeric handling, document-derived limits/status and atomic supplier paid cache reconciliation |
| Inflated discounted return credit | Server-derived net allocation, deterministic cent rounding and cumulative quantity caps; posted returns retained |
| Duplicate booking completion lines | Aggregated locked availability and one movement per item |
| Booking-to-sale double payment/stock/charge | Additive unique booking/invoice linkage; advances allocated once; Pending/Completed conversion supported; repeats return original invoice |
| Unsafe transfer/opening reversals | Shared nonnegative stock guard, compensating ledger rows, retained cancelled transfer, repeated-reversal checks |
| Incomplete stock snapshots | Complete movement-ledger calculation instead of purchase-order/global master stock estimates |
| Cash daybook double counting | Actual cash payments/advances/expenses/manual cash entries only; credit notes do not invent cash refunds |
| Expense report omission and editable posted cash | Server numbering and posted status; cash insertion and numbering in one transaction; financial edits blocked |
| Missing sale filters / payment search precedence | Same validated predicates for row/count/summary; OR search kept inside party/document scope |
| Read permissions permitting security writes | Action-specific rights, restricted user/group browse, inactive-group denial |
| Unlimited login attempts / old tokens after password changes | MySQL-backed fixed-window throttling and credential-version verification |
| Client MIME/extension-only uploads | Supported raster whitelist, matching signature checks, canonical extensions and rejection cleanup |
| Configuration and error inconsistencies | Shared environment loader, verified TLS, production config checks, semantic DB/API errors and unified async/response wrappers |

Additive migrations **0053** and **0054** create booking_invoice_links and auth_login_limits. Current schema: **54 migrations, 51 application tables, 418 columns, 68 foreign keys, 3 CHECK constraints**, plus the migration journal. Existing 52-file installations upgrade by applying only those two additions.

## Acceptance evidence

| Verification | Result |
| --- | --- |
| Environment | Node.js 24.20.0; MySQL 8.4.11 in local Docker |
| `npm run check:code` | 172 JavaScript files parsed; static relative imports exist with exact casing |
| `npm test` | 15 passed, 0 failed |
| `npm run test:db` | 14 passed, 0 failed; strict SQL/FKs, fresh install, drift/history/failure/concurrency guards |
| `npm run test:backend` | 23 passed, 0 failed; actual services/transactions and HTTP security requests against MySQL |
| Authenticated local GET/report smoke | 32 endpoints checked, all successful using valid required report parameters |
| Local DB upgrade and verification | 52 → 54; 0 pending; original history checksums accepted |
| Configuration preflight | Schema, active grouped admin and local upload directory pass |
| Normal local server startup | `npm start` listens on port 5000 after schema preflight; `/api/health` returns success |
| Code formatting check | `git diff --check` passes |

Backend tests include 20 + 10 payment status, customer summary/ledger agreement, partial 4 + 6 receipts, concurrent overselling refusal, discounted duplicate lines, aggregate booking completion, idempotent conversion, conversion after completion, advance mutation refusal, guarded/preserved reversal, ledger/inventory/snapshot reconciliation, posted expense/cash daybook rules, scoped searches, immutable openings and revoked tokens/read-only rights over HTTP.

Integration suites recreate only dedicated local fixture databases, require localhost:3307 and the local test user, and reject the main/remote database. Run them sequentially because they share a fixture. The original schema suite deliberately leaves a failed-migration record in its isolated failure database; main local history is healthy.

## Run and reuse

```powershell
# From POS_Backend, using the configured default .env
npm.cmd run db:up
npm.cmd run migrate
npm.cmd run check
npm.cmd run dev
```

API base: `http://127.0.0.1:5000/api`. Local login username: `admin`; password: ADMIN_PASSWORD in your ignored `.env`. Fresh clones follow [README](../README.md), including first-time environment creation and `seed:admin`.

## Compatibility and remaining boundaries

Read [the updated API contract](backend-api-contract.md) before changing the frontend. Existing URL prefixes remain stable, but unsafe financial updates and deletion of posted sales/returns now return errors. Frontend forms/actions must respect these rules; booking-origin sales must send booking_id or use the conversion endpoint. Old tokens require a new login.

This release records returns as customer/supplier **account credits**, not executed cash refunds. Cash refunds, credit reversals, generic create-request idempotency, payment-gateway/tax rules, multi-tenant isolation, per-user location ownership, register shifts and isolated public demo resets remain separate features. Booking conversion and posted stock reversals have explicit retry guards.

Snapshots are global and use UTC posting timestamps. Branch-specific historical snapshots, business timezone configuration, FIFO/weighted-average valuation and inventory audit adjustments need dedicated design. Report valuation still uses current catalog costs. Signature-checked uploads are not decoded/re-encoded; full media processing and orphan cleanup after unrelated DB failures remain future work.

Aiven **Free** setup guidance and TLS configuration are prepared; the owner still provisions and verifies the remote service. Vercel pool lifecycle/connection-load acceptance, Blob persistence and preview behavior are deployment work. No frontend files or remote services were modified, and no claim of complete production POS readiness is made.
