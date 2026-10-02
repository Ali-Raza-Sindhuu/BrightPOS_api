-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE receipt_sequences (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  next_value BIGINT UNSIGNED NOT NULL DEFAULT 1,
  register_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_receipt_sequences_store_row (store_id, id),
  UNIQUE KEY uq_receipt_sequence_register (store_id, register_id),
  CONSTRAINT chk_receipt_sequence_positive CHECK (next_value > 0),
  CONSTRAINT fk_receipt_sequences_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_receipt_sequences_register_id FOREIGN KEY (store_id, register_id) REFERENCES registers(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

