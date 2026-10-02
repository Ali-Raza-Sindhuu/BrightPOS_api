-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE payment_providers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  code VARCHAR(60) NOT NULL,
  method ENUM('cash','card','bank_transfer','wallet') NOT NULL,
  mode ENUM('recorded','sandbox') NOT NULL DEFAULT 'sandbox',
  is_enabled TINYINT UNSIGNED NOT NULL DEFAULT 0,
  configuration JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_providers_store_row (store_id, id),
  UNIQUE KEY uq_provider_code (store_id, code),
  CONSTRAINT fk_payment_providers_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

