-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE approval_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  token_hash CHAR(64) NOT NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  payload_hash CHAR(64) NOT NULL,
  limit_minor BIGINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  requested_by INT NOT NULL,
  approved_by INT NOT NULL,
  register_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_approval_tokens_store_row (store_id, id),
  UNIQUE KEY uq_approval_hash (token_hash),
  KEY idx_approval_expiry (store_id, expires_at),
  CONSTRAINT chk_approval_different_actor CHECK (requested_by <> approved_by),
  CONSTRAINT fk_approval_tokens_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_approval_tokens_requested_by FOREIGN KEY (store_id, requested_by) REFERENCES users(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_approval_tokens_approved_by FOREIGN KEY (store_id, approved_by) REFERENCES users(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_approval_tokens_register_id FOREIGN KEY (store_id, register_id) REFERENCES registers(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

