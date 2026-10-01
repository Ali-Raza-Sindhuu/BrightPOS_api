-- Align the deployed business_units table with the fields used by the API.
-- Additive and safe for existing records; migration runner applies this only
-- to databases that have not recorded this migration yet.
ALTER TABLE `business_units`
  ADD COLUMN `type` ENUM('Warehouse','Shop','Godown') NOT NULL DEFAULT 'Warehouse' AFTER `code`,
  ADD COLUMN `address` VARCHAR(255) NULL AFTER `type`,
  ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `address`;

UPDATE `business_units`
SET `is_active` = CASE WHEN `status` = 'active' THEN 1 ELSE 0 END;
