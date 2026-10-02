-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE idempotency_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  action VARCHAR(80) NOT NULL,
  request_key VARCHAR(100) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  status ENUM('processing','succeeded','failed') NOT NULL DEFAULT 'processing',
  response_status SMALLINT UNSIGNED NULL,
  response_body JSON NULL,
  lease_until DATETIME NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_idempotency_requests_store_row (store_id, id),
  UNIQUE KEY uq_idempotency_request (store_id, action, request_key),
  KEY idx_idempotency_expiry (expires_at),
  CONSTRAINT fk_idempotency_requests_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

