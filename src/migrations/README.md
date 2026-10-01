# Migrations

SQL migration files for every table introduced by the modules built so far
(Customers, Sales, Customer Payments, Sale Returns, Supplier Payments,
Purchase Returns). Numbered so they can be run in order with any tool —
plain `mysql` CLI, or a migration runner that just executes files in a
folder alphabetically.

```
001_create_customers_table.sql
002_create_sale_invoices_table.sql
003_create_sale_invoice_items_table.sql
004_create_customer_payments_table.sql
005_create_sale_returns_table.sql
006_create_sale_return_items_table.sql
007_create_supplier_payments_table.sql
008_create_purchase_returns_table.sql
009_create_purchase_return_items_table.sql
010_add_foreign_keys.sql
011_add_business_unit_id_to_inventory.sql
012_add_business_unit_id_to_sales_and_purchases.sql
013_create_accounts_base_tables.sql
014_create_stock_transfer_tables.sql
032_create_stock_snapshots_table.sql
033_create_stock_snapshot_items_table.sql
034_allow_walk_in_sale_payments.sql
035_business_units_runtime_columns.sql
036_add_stock_transfer_foreign_keys.sql
034_allow_walk_in_sale_payments.sql
```

## Not included here

`item_details`, `suppliers`, `purchases`, `purchase_items`, `goods_receipts`,
`goods_receipt_items`, `inventory`, and the rest of the Step 1/2 master-data
tables — those were already in place before this conversation started (per
the original README). If you want migration files for those too, say so and
I'll generate them from the same dump.

## How to run

```bash
mysql -u youruser -p yourdatabase < migrations/001_create_customers_table.sql
mysql -u youruser -p yourdatabase < migrations/002_create_sale_invoices_table.sql
# ...through 009, then:
mysql -u youruser -p yourdatabase < migrations/010_add_foreign_keys.sql
```

Or, to run the whole folder in order in one shot:

```bash
for f in migrations/*.sql; do
  echo "Running $f"
  mysql -u youruser -p yourdatabase < "$f"
done
```

Every `CREATE TABLE` uses `IF NOT EXISTS`, so 001–009 are safe to re-run
against a database that already has these tables (e.g. if you're just
using this repo to document/version schema that already exists in your
`pos_system_final.sql` dump — it won't touch existing data or error out).

`010_add_foreign_keys.sql` is **not** idempotent — MySQL has no
`ADD CONSTRAINT IF NOT EXISTS` before 8.0.29, and it's optional (see the
note at the top of that file for why). Only run it once, on a database
where these tables don't already have the same constraints, and ideally
after confirming there's no orphaned data that would make it fail.

## Column source

Every column, type, default, and enum value here is copied directly from
`pos_system_final.sql` (the schema you uploaded) — nothing was invented.
Primary keys and `AUTO_INCREMENT` are folded into the `CREATE TABLE`
statement directly rather than split into a separate `ALTER TABLE` (the dump
does it in two steps; functionally identical).
