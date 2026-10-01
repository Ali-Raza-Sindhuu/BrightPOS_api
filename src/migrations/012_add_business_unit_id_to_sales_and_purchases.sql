-- Migration: record which location a sale/purchase happened at
-- Depends on: business_units (already exists), 011 (inventory is now
-- location-aware, so transactions need to say which location they affect)
--
-- Without this, sale_invoices/purchases have no way to tell which
-- inventory row (item_id, unit_id, business_unit_id) to adjust.

ALTER TABLE `sale_invoices`
  ADD COLUMN `business_unit_id` int(10) UNSIGNED DEFAULT NULL AFTER `customer_id`;

UPDATE `sale_invoices`
SET `business_unit_id` = (SELECT MIN(`id`) FROM `business_units`)
WHERE `business_unit_id` IS NULL;

ALTER TABLE `sale_invoices`
  MODIFY COLUMN `business_unit_id` int(10) UNSIGNED NOT NULL;

ALTER TABLE `sale_invoices`
  ADD CONSTRAINT `fk_sale_invoices_business_unit_id`
    FOREIGN KEY (`business_unit_id`) REFERENCES `business_units` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- purchases: same reasoning, on the receiving side. This table predates this
-- conversation (Step 2) — if your goods-receipts service lives outside what
-- was built here, see the note in modules/business-units/README-INTEGRATION.md
-- for what needs to change there too.
ALTER TABLE `purchases`
  ADD COLUMN `business_unit_id` int(10) UNSIGNED DEFAULT NULL AFTER `supplier_id`;

UPDATE `purchases`
SET `business_unit_id` = (SELECT MIN(`id`) FROM `business_units`)
WHERE `business_unit_id` IS NULL;

ALTER TABLE `purchases`
  MODIFY COLUMN `business_unit_id` int(10) UNSIGNED NOT NULL;

ALTER TABLE `purchases`
  ADD CONSTRAINT `fk_purchases_business_unit_id`
    FOREIGN KEY (`business_unit_id`) REFERENCES `business_units` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
