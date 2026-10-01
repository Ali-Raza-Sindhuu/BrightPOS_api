-- 0045_create_expiry_tags.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `expiry_tags` (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id INT UNSIGNED NOT NULL,
  expiry_date DATE NOT NULL,
  manufacturer_date DATE NULL,
  description TEXT NULL,
  receipt_no VARCHAR(100) NULL,
  item_code VARCHAR(100) NULL,
  purchase_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  sale_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expiry_tags_date (expiry_date),
  CONSTRAINT fk_expiry_tags_item_id FOREIGN KEY (item_id) REFERENCES item_details(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
