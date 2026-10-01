-- 0022_create_opening_stock.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `opening_stock` (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  business_unit_id INT UNSIGNED NOT NULL,
  stock_date DATE NOT NULL,
  remarks VARCHAR(255) NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_opening_stock_location_date (business_unit_id, stock_date),
  CONSTRAINT fk_opening_stock_business_unit_id FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_opening_stock_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
