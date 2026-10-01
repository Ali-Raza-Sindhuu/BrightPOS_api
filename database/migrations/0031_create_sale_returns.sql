-- 0031_create_sale_returns.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `sale_returns` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sale_invoice_id` INT UNSIGNED NOT NULL,
  `customer_id` INT UNSIGNED DEFAULT NULL,
  `return_date` datetime NOT NULL,
  `total_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `reason` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_sale_returns_sale_invoice_id` (`sale_invoice_id`),
  KEY `idx_sale_returns_customer_id` (`customer_id`),
  CONSTRAINT fk_sale_returns_sale_invoice_id FOREIGN KEY (sale_invoice_id) REFERENCES sale_invoices(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_sale_returns_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
