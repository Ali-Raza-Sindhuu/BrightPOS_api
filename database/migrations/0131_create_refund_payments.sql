-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE refund_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  amount_minor BIGINT UNSIGNED NOT NULL,
  method ENUM('cash','card','bank_transfer','wallet') NOT NULL,
  status ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
  provider_reference VARCHAR(191) NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  refund_id BIGINT UNSIGNED NOT NULL,
  original_payment_id BIGINT UNSIGNED NULL,
  shift_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refund_payments_store_row (store_id, id),
  UNIQUE KEY uq_refund_payment_request (store_id, idempotency_key),
  CONSTRAINT chk_refund_payment_positive CHECK (amount_minor > 0),
  CONSTRAINT fk_refund_payments_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_refund_payments_refund_id FOREIGN KEY (store_id, refund_id) REFERENCES refund_notes(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_refund_payments_original_payment_id FOREIGN KEY (store_id, original_payment_id) REFERENCES checkout_payments(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_refund_payments_shift_id FOREIGN KEY (store_id, shift_id) REFERENCES register_shifts(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

