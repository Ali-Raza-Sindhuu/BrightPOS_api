-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE registers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(40) NOT NULL,
  device_key_hash CHAR(64) NULL,
  is_active TINYINT UNSIGNED NOT NULL DEFAULT 1,
  business_unit_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_registers_store_row (store_id, id),
  UNIQUE KEY uq_register_code (store_id, code),
  UNIQUE KEY uq_register_device (device_key_hash),
  CONSTRAINT fk_registers_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_registers_business_unit_id FOREIGN KEY (store_id, business_unit_id) REFERENCES business_units(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

