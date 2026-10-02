-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE payment_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  event_key VARCHAR(191) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  redacted_payload JSON NULL,
  processed_at DATETIME NULL,
  payment_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_events_store_row (store_id, id),
  UNIQUE KEY uq_payment_event (store_id, event_key),
  CONSTRAINT fk_payment_events_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_payment_events_payment_id FOREIGN KEY (store_id, payment_id) REFERENCES checkout_payments(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

