-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE checkout_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  quantity DECIMAL(18,6) NOT NULL,
  unit_price_minor BIGINT UNSIGNED NOT NULL,
  cost_price_minor BIGINT UNSIGNED NULL,
  discount_minor BIGINT UNSIGNED NOT NULL DEFAULT 0,
  total_minor BIGINT UNSIGNED NOT NULL DEFAULT 0,
  notes VARCHAR(500) NULL,
  discount_source ENUM('none','manual','coupon') NOT NULL DEFAULT 'none',
  checkout_id BIGINT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_checkout_lines_store_row (store_id, id),
  CONSTRAINT chk_checkout_quantity CHECK (quantity > 0),
  CONSTRAINT fk_checkout_lines_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_checkout_lines_checkout_id FOREIGN KEY (store_id, checkout_id) REFERENCES checkout_sessions(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_checkout_lines_item_id FOREIGN KEY (store_id, item_id) REFERENCES item_details(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

