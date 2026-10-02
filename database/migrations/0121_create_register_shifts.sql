-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE register_shifts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  open_slot TINYINT UNSIGNED NULL DEFAULT 1,
  opening_float_minor BIGINT UNSIGNED NOT NULL DEFAULT 0,
  closing_count_minor BIGINT UNSIGNED NULL,
  expected_close_minor BIGINT NULL,
  variance_minor BIGINT NULL,
  opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME NULL,
  register_id BIGINT UNSIGNED NOT NULL,
  opened_by INT NOT NULL,
  closed_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_register_shifts_store_row (store_id, id),
  UNIQUE KEY uq_shift_open_register (store_id, register_id, open_slot),
  CONSTRAINT chk_shift_slot CHECK ((status = 'open' AND open_slot IS NOT NULL AND open_slot = 1) OR (status = 'closed' AND open_slot IS NULL)),
  CONSTRAINT chk_shift_close CHECK ((status = 'open' AND closed_at IS NULL) OR (status = 'closed' AND closed_at IS NOT NULL AND closing_count_minor IS NOT NULL)),
  CONSTRAINT fk_register_shifts_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_register_shifts_register_id FOREIGN KEY (store_id, register_id) REFERENCES registers(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_register_shifts_opened_by FOREIGN KEY (store_id, opened_by) REFERENCES users(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_register_shifts_closed_by FOREIGN KEY (store_id, closed_by) REFERENCES users(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

