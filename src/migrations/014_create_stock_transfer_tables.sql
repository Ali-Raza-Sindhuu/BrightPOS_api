-- Store a posted stock transfer and its item rows. Foreign keys are added by
-- the later schema-change migration after all referenced tables exist.
CREATE TABLE IF NOT EXISTS stock_transfers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  from_unit_id INT UNSIGNED NOT NULL,
  to_unit_id INT UNSIGNED NOT NULL,
  transfer_date DATE NOT NULL,
  reference_no VARCHAR(64) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'POSTED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_stock_transfers_from (from_unit_id),
  KEY idx_stock_transfers_to (to_unit_id),
  KEY idx_stock_transfers_date (transfer_date),
  KEY idx_stock_transfers_reference (reference_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  transfer_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  quantity DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_stock_transfer_items_transfer (transfer_id),
  KEY idx_stock_transfer_items_item (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
