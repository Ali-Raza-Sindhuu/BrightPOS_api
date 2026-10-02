-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE offline_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  client_id CHAR(36) NOT NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  payload JSON NOT NULL,
  status ENUM('queued','processing','synced','conflict','failed') NOT NULL DEFAULT 'queued',
  error_code VARCHAR(80) NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  occurred_at DATETIME NOT NULL,
  synced_at DATETIME NULL,
  register_id BIGINT UNSIGNED NOT NULL,
  invoice_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_offline_transactions_store_row (store_id, id),
  UNIQUE KEY uq_offline_client (store_id, register_id, client_id),
  UNIQUE KEY uq_offline_request (store_id, idempotency_key),
  CONSTRAINT fk_offline_transactions_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_offline_transactions_register_id FOREIGN KEY (store_id, register_id) REFERENCES registers(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_offline_transactions_invoice_id FOREIGN KEY (store_id, invoice_id) REFERENCES sale_invoices(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

