-- 0043_create_stock_transfers.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `stock_transfers` (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  from_unit_id INT UNSIGNED NOT NULL,
  to_unit_id INT UNSIGNED NOT NULL,
  transfer_date DATE NOT NULL,
  reference_no VARCHAR(64) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'POSTED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_stock_transfers_date (transfer_date),
  KEY idx_stock_transfers_reference (reference_no),
  CONSTRAINT fk_stock_transfers_from_unit_id FOREIGN KEY (from_unit_id) REFERENCES business_units(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_stock_transfers_to_unit_id FOREIGN KEY (to_unit_id) REFERENCES business_units(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_stock_transfer_locations CHECK (from_unit_id <> to_unit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
