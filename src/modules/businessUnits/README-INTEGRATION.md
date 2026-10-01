# Integration note: goods-receipts / purchases module

The `purchases` and `inventory` tables changed under this migration set
(011, 012) — this repo doesn't include the Purchases/Goods-Receipts module
itself (it predates this conversation, per the original README), so this
note describes what needs to change there.

## What changed

- `purchases` gained a required `business_unit_id` column — which location
  the goods were ordered for.
- `inventory` is no longer unique on `(item_id, unit_id)` — it's now unique
  on `(item_id, unit_id, business_unit_id)`. A row for the same item/unit
  now exists once *per location*.

## What to update in that module

1. **`POST /api/purchases`** — accept `business_unit_id` in the request
   body, validate it exists (same pattern as validating `supplier_id`),
   and save it on the `purchases` insert.

2. **`POST /api/goods-receipts/:id/receive`** — wherever it currently
   upserts `inventory` by `(item_id, item_unit_id)`, add the purchase's
   `business_unit_id` to that lookup/insert:

   ```sql
   -- before
   SELECT id, quantity FROM inventory WHERE item_id = ? AND unit_id = ? FOR UPDATE

   -- after
   SELECT id, quantity FROM inventory
   WHERE item_id = ? AND unit_id = ? AND business_unit_id = ? FOR UPDATE
   ```

   and include `business_unit_id` in the `INSERT` branch when no row
   exists yet. Pull it from the parent `purchases` row for that GRN
   (`purchases.business_unit_id`), not from the request — the receipt
   should land wherever the purchase said it would.

3. `item_details.stock` (the global total) is unaffected — it stays a
   simple running total across all locations, same as today.

## The two migrations that require this

- `011_add_business_unit_id_to_inventory.sql`
- `012_add_business_unit_id_to_sales_and_purchases.sql`

Run these before deploying the updated goods-receipts code, since the
column and the new unique index need to exist first. Both migrations
backfill existing rows onto a default "Main Warehouse" location
automatically, so nothing breaks on a database that already has purchase
history — but review whether your real stock is actually split across
multiple locations, since there was previously no way to know that from
the data.
