-- 0021_create_item_stock.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `item_stock` (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  business_unit_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  type VARCHAR(32) NOT NULL,
  qty DECIMAL(15,2) NOT NULL,
  ref_type VARCHAR(50) NOT NULL,
  ref_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_item_stock_location_item (business_unit_id, item_id, created_at),
  KEY idx_item_stock_reference (ref_type, ref_id),
  CONSTRAINT fk_item_stock_business_unit_id FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_item_stock_item_id FOREIGN KEY (item_id) REFERENCES item_details(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
