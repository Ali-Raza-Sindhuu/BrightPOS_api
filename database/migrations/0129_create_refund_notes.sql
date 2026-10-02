-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE refund_notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  number VARCHAR(60) NOT NULL,
  amount_minor BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(500) NOT NULL,
  status ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
  idempotency_key VARCHAR(100) NOT NULL,
  invoice_id INT UNSIGNED NOT NULL,
  legacy_return_id INT UNSIGNED NULL,
  exchange_checkout_id BIGINT UNSIGNED NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refund_notes_store_row (store_id, id),
  UNIQUE KEY uq_refund_number (store_id, number),
  UNIQUE KEY uq_refund_request (store_id, idempotency_key),
  UNIQUE KEY uq_refund_legacy (store_id, legacy_return_id),
  CONSTRAINT chk_refund_positive CHECK (amount_minor > 0),
  CONSTRAINT fk_refund_notes_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_refund_notes_invoice_id FOREIGN KEY (store_id, invoice_id) REFERENCES sale_invoices(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_refund_notes_legacy_return_id FOREIGN KEY (store_id, legacy_return_id) REFERENCES sale_returns(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_refund_notes_exchange_checkout_id FOREIGN KEY (store_id, exchange_checkout_id) REFERENCES checkout_sessions(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_refund_notes_created_by FOREIGN KEY (store_id, created_by) REFERENCES users(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

