-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE stock_adjustment_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  quantity_delta DECIMAL(18,6) NOT NULL,
  cost_minor BIGINT UNSIGNED NULL,
  adjustment_id BIGINT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stock_adjustment_lines_store_row (store_id, id),
  UNIQUE KEY uq_adjustment_item (store_id, adjustment_id, item_id),
  CONSTRAINT chk_adjustment_nonzero CHECK (quantity_delta <> 0),
  CONSTRAINT fk_stock_adjustment_lines_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_stock_adjustment_lines_adjustment_id FOREIGN KEY (store_id, adjustment_id) REFERENCES stock_adjustments(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_stock_adjustment_lines_item_id FOREIGN KEY (store_id, item_id) REFERENCES item_details(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

