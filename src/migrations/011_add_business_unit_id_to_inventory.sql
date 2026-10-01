-- Migration: make `inventory` location-aware
-- Depends on: business_units (already exists — Step 1)
--
-- inventory previously tracked (item_id, unit_id) globally with no location.
-- This adds business_unit_id so stock_transfers/stock_snapshots can mean
-- something real. Existing rows are backfilled onto a default location so
-- nothing is lost.

-- 1. Ensure at least one business unit exists to backfill onto.
INSERT INTO `business_units` (`name`, `code`)
SELECT 'Main Warehouse', 'MAIN-WAREHOUSE'
WHERE NOT EXISTS (SELECT 1 FROM `business_units`);

-- 2. Add the column, nullable for now so the backfill can populate it.
ALTER TABLE `inventory`
  ADD COLUMN `business_unit_id` int(10) UNSIGNED DEFAULT NULL AFTER `unit_id`;

-- 3. Backfill every existing row onto the lowest-id business unit.
--    Existing quantities become "how much is at that one location" —
--    review/adjust manually afterward if your real stock is actually split
--    across locations; there was previously no way to know that from data.
UPDATE `inventory`
SET `business_unit_id` = (SELECT MIN(`id`) FROM `business_units`)
WHERE `business_unit_id` IS NULL;

-- 4. Now that every row has a value, make it required.
ALTER TABLE `inventory`
  MODIFY COLUMN `business_unit_id` int(10) UNSIGNED NOT NULL;

-- 5. Replace the old (item_id, unit_id) uniqueness with
--    (item_id, unit_id, business_unit_id) — the same item/unit combo can now
--    have one row per location.
ALTER TABLE `inventory`
  DROP INDEX `item_per_unit`,
  ADD UNIQUE KEY `item_unit_per_location` (`item_id`, `unit_id`, `business_unit_id`);

ALTER TABLE `inventory`
  ADD CONSTRAINT `fk_inventory_business_unit_id`
    FOREIGN KEY (`business_unit_id`) REFERENCES `business_units` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
