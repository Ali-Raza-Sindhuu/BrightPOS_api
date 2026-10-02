-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE store_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  return_window_days SMALLINT UNSIGNED NOT NULL DEFAULT 14,
  cashier_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  manager_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  approval_threshold_minor BIGINT UNSIGNED NOT NULL DEFAULT 0,
  low_stock_threshold DECIMAL(18,6) NOT NULL DEFAULT 5.000000,
  cash_rounding_increment_minor INT UNSIGNED NOT NULL DEFAULT 1,
  receipt_header VARCHAR(500) NULL,
  receipt_footer VARCHAR(500) NULL,
  enabled_payment_methods JSON NULL,
  notification_preferences JSON NULL,
  allow_return_window_override TINYINT UNSIGNED NOT NULL DEFAULT 0,
  session_timeout_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_store_settings_store_row (store_id, id),
  UNIQUE KEY uq_store_settings_store (store_id),
  CONSTRAINT chk_settings_discount CHECK (cashier_discount_percent >= 0 AND cashier_discount_percent <= manager_discount_percent AND manager_discount_percent <= 100),
  CONSTRAINT chk_settings_limits CHECK (low_stock_threshold >= 0 AND cash_rounding_increment_minor > 0 AND session_timeout_minutes > 0),
  CONSTRAINT fk_store_settings_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

