-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE demo_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  session_hash CHAR(64) NOT NULL,
  scenario ENUM('retail','bakery') NOT NULL,
  status ENUM('active','expired','resetting') NOT NULL DEFAULT 'active',
  expires_at DATETIME NOT NULL,
  last_seen_at DATETIME NULL,
  reset_revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
  visitor_user_id INT NULL,
  register_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_demo_sessions_store_row (store_id, id),
  UNIQUE KEY uq_demo_session_hash (session_hash),
  KEY idx_demo_session_expiry (expires_at),
  CONSTRAINT fk_demo_sessions_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_demo_sessions_visitor_user_id FOREIGN KEY (store_id, visitor_user_id) REFERENCES users(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_demo_sessions_register_id FOREIGN KEY (store_id, register_id) REFERENCES registers(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

