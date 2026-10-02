-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE cash_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  direction ENUM('in','out') NOT NULL,
  kind ENUM('sale','refund','paid_in','paid_out','safe_drop') NOT NULL,
  amount_minor BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(500) NOT NULL,
  reference_type VARCHAR(60) NULL,
  reference_id BIGINT UNSIGNED NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  shift_id BIGINT UNSIGNED NOT NULL,
  actor_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cash_movements_store_row (store_id, id),
  UNIQUE KEY uq_cash_movement_request (store_id, idempotency_key),
  KEY idx_cash_shift (store_id, shift_id, created_at),
  CONSTRAINT chk_cash_positive CHECK (amount_minor > 0),
  CONSTRAINT fk_cash_movements_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_cash_movements_shift_id FOREIGN KEY (store_id, shift_id) REFERENCES register_shifts(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_cash_movements_actor_id FOREIGN KEY (store_id, actor_id) REFERENCES users(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

