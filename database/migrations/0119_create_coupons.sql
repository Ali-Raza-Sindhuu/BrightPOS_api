-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE coupons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  code VARCHAR(60) NOT NULL,
  discount_type ENUM('fixed','percent') NOT NULL,
  discount_value DECIMAL(14,2) NOT NULL,
  minimum_spend_minor BIGINT UNSIGNED NOT NULL DEFAULT 0,
  maximum_uses INT UNSIGNED NULL,
  uses_count INT UNSIGNED NOT NULL DEFAULT 0,
  valid_from DATETIME NOT NULL,
  valid_until DATETIME NULL,
  is_active TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_coupons_store_row (store_id, id),
  UNIQUE KEY uq_coupon_code (store_id, code),
  CONSTRAINT chk_coupon_value CHECK (discount_value > 0 AND (discount_type <> 'percent' OR discount_value <= 100)),
  CONSTRAINT chk_coupon_dates CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT chk_coupon_usage CHECK (maximum_uses IS NULL OR uses_count <= maximum_uses),
  CONSTRAINT fk_coupons_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

