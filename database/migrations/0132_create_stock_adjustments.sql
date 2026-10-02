-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE stock_adjustments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  reason ENUM('damage','waste','theft','count_correction','received') NOT NULL,
  notes VARCHAR(500) NOT NULL,
  status ENUM('draft','posted','reversed') NOT NULL DEFAULT 'draft',
  idempotency_key VARCHAR(100) NOT NULL,
  posted_at DATETIME NULL,
  business_unit_id INT UNSIGNED NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stock_adjustments_store_row (store_id, id),
  UNIQUE KEY uq_stock_adjustment_request (store_id, idempotency_key),
  CONSTRAINT fk_stock_adjustments_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_stock_adjustments_business_unit_id FOREIGN KEY (store_id, business_unit_id) REFERENCES business_units(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_stock_adjustments_created_by FOREIGN KEY (store_id, created_by) REFERENCES users(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

