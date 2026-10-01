-- 0020_create_inventory.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `inventory` (
  id INT NOT NULL AUTO_INCREMENT,
  item_id INT UNSIGNED NOT NULL,
  unit_id INT UNSIGNED NOT NULL,
  business_unit_id INT UNSIGNED NOT NULL,
  quantity DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY item_unit_per_location (item_id, unit_id, business_unit_id),
  KEY idx_inventory_location_item (business_unit_id, item_id),
  CONSTRAINT fk_inventory_item_id FOREIGN KEY (item_id) REFERENCES item_details(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_inventory_unit_id FOREIGN KEY (unit_id) REFERENCES item_units(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_inventory_business_unit_id FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_inventory_nonnegative CHECK (quantity >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
