-- 0033_create_supplier_payments.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `supplier_payments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `supplier_id` INT UNSIGNED NOT NULL,
  `purchase_id` INT UNSIGNED DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `payment_date` datetime DEFAULT current_timestamp(),
  `note` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_supplier_payments_supplier_id` (`supplier_id`),
  KEY `idx_supplier_payments_purchase_id` (`purchase_id`),
  CONSTRAINT fk_supplier_payments_supplier_id FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_supplier_payments_purchase_id FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
