-- 0034_create_purchase_returns.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `purchase_returns` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `purchase_id` INT UNSIGNED NOT NULL,
  `supplier_id` INT UNSIGNED DEFAULT NULL,
  `return_date` date NOT NULL,
  `total_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `reason` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_purchase_returns_purchase_id` (`purchase_id`),
  KEY `idx_purchase_returns_supplier_id` (`supplier_id`),
  CONSTRAINT fk_purchase_returns_purchase_id FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_purchase_returns_supplier_id FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
