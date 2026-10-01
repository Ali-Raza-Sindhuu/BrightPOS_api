# Business-unit database integration

Purchases and goods-receipts modules exist in this repository. The canonical fresh database baseline now defines business-unit relationships before dependent tables; see the [migration guide](../../../database/migrations/README.md).

- `inventory` uses `(item_id, unit_id, business_unit_id)` as its unique balance key.
- `purchases`, `goods_receipts`, `sale_invoices` and `bookings` require a valid business unit.
- `item_stock` records multiple signed movements per item/location.
- Stock transfers reference distinct source and destination business units.

The previous `011`/`012` legacy upgrade files were removed at the project owner's request. Existing databases need a separately reviewed upgrade, rather than an assumed backfill into the Main Warehouse.

Application services must validate locations and use their document's location consistently when changing stock. The database baseline verifies structures and foreign keys; core services now use guarded transactional stock movements. See the backend completion report for acceptance evidence and remaining feature boundaries.
