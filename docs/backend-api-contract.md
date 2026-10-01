# Backend API contract after upgrade

Existing public route prefixes remain stable. Send bearer tokens to protected routes. Successful JSON remains `{ success, message, data, meta? }`; invalid input returns 400/422, missing records 404, lifecycle/stock conflicts 409, missing permission 403 and throttled login 429 with Retry-After.

## Workflow rules

| Area | Behavior |
| --- | --- |
| Purchases | Required supplier/location, finite positive decimal quantities, nonnegative prices/discount, payment not above payable; totals/status computed by server |
| Purchase edits | Metadata only; financial fields/items cannot be forged. Supplier/location changes and deletion are blocked after any receipt/payment/return. Pending GRN location follows an allowed location edit |
| Goods receipts | Supply `purchase_item_id` and `received_qty`; explicit positive received lines, no duplicate/foreign lines, serialized outstanding checks. Partial 4 + 6 receipts show ordered 10, not 20 |
| Sales | Fractional quantities preserved, aggregate duplicate-item availability, transaction rollback on insufficient stock. Cash tender above payable is capped to payable as payment; excess is change |
| Sale edits/deletion | Posted financial fields/items/customer/location are immutable; description may be edited. Posted invoices cannot be deleted; use a sale return |
| Customer/supplier payments | Positive amount with at most two decimals; document must belong to the party. Derived paid/remaining amounts include return credit. Supplier paid/status cache updated atomically |
| Opening balances | Customer previous_balance and supplier opening_balance set at party creation, then immutable. Payment/return records do not mutate opening balances |
| Returns | Credit derived from original invoice/purchase net value; client-selected prices cannot inflate it. Duplicate price lines are weighted within the item group, with deterministic discount allocation and cumulative partial-return rounding. Full credit cannot exceed original net amount. Posted return documents cannot be deleted |
| Bookings | Non-reserving orders. Completion rechecks aggregate item quantities under lock. Paid bookings cannot be rejected without resolving advances |
| Booking conversion | `POST /api/sales/from-booking/:id` or `POST /api/sales` with `booking_id`. Uses stored lines/customer/location/discount; copies advances to invoice payments, links once, prevents duplicate stock posting and charge. Repeats return the existing invoice. Completed bookings can convert without moving stock again |
| Converted advances | Original booking payment records retained but excluded from duplicate ledger/daybook totals. New payments go to the invoice. Allocated advances cannot be edited/removed through booking payment endpoints |
| Stock transfers | Reversal checks destination stock, records compensating movements, retains header/items with CANCELLED status. Repeat reversal rejected |
| Opening stock | Validated decimals, duplicate-item guard, item locks, reversal stock checks and explicit ledger guard against repeat reversal |
| Snapshots | Derive global quantities from complete timestamped stock movements through the closing date. Purchase/sale columns mean positive/negative movement quantities; transfers net to zero globally |
| Expenses | Server-numbered EV vouchers are posted with cash entry in one transaction; amount/date/head cannot be rewritten afterward. Reports include posted vouchers |
| Cash daybook | `GET /api/daybook?from=YYYY-MM-DD&to=YYYY-MM-DD`; includes actual cash payments, unallocated booking advances, posted cash expenses and manual cash entries, excluding invoice charges and credit-only returns. Includes opening balance before the interval. `POST /api/daybook` records an authorized manual entry |

Sale responses preserve original `payable` and add `net_payable` after credits. Status is derived against that net amount. Purchase responses similarly expose `net_payable`. Money uses fixed two-decimal input and integer minor-unit validation/allocation; quantities support two decimal places. Invalid dates, nonfinite values and IDs are rejected early on upgraded paths.

## Authentication and rights

Login body uses `identifier` and `password`. Limits are stored in MySQL, shared by all app instances: 10 attempts per IP/identifier and 60 per IP in a fixed 15-minute window. Proxy configuration must reflect trusted infrastructure. Password changes invalidate old tokens using a signed credential-version claim; existing tokens from before this upgrade require a fresh login.

Group rights use the appropriate READ/CREATE/UPDATE/DELETE permissions. Read access to groups no longer grants permission editing or user-group reassignment. Inactive groups do not grant permissions. User/group administration additionally retains its admin-role guard. Public v1 is one demo business; row-level tenant/location membership is not claimed.

Product uploads accept PNG, JPEG, GIF and WebP MIME values with matching content signatures and canonical extensions. SVG/HTML content is rejected. This is signature validation, not image decoding/re-encoding or antivirus scanning. Hosted uploads still need Vercel Blob acceptance tests.

## Frontend integration required next

Update the frontend to send `booking_id` or call the conversion endpoint instead of submitting booking data as an unrelated sale. Use payment endpoints for additional payments. Do not submit editable totals/status fields to purchase updates or offer destructive deletion of posted invoices/returns. Use `net_payable` for outstanding amounts, display cancelled transfers, and explain that returns are **account credits** in this release.

Cash refunds and credit reversals are not implemented. A paid returned invoice produces a customer credit; it does not automatically pay cash out. Payment gateways, tax jurisdiction logic, tenant isolation, shift/register reconciliation, generic request idempotency and isolated public demo sessions remain separate features. Booking conversion and stock reversal retries have explicit duplicate guards; arbitrary duplicate sale submissions do not yet share an idempotency key.

Reporting timestamps and period boundaries currently use UTC. Snapshots are global, not per-branch. Per-branch historical snapshots and a configurable business timezone require dedicated schema/UI design. Historical cost valuation uses the current catalog cost, so it is not a FIFO/weighted-average valuation engine.
