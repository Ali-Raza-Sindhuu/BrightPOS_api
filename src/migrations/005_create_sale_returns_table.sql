-- Migration: create `sale_returns`
-- Backs: modules/sale-returns
-- Depends on: sale_invoices (002), customers (001)

CREATE TABLE IF NOT EXISTS `sale_returns` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `sale_invoice_id` int(10) UNSIGNED NOT NULL,
  `customer_id` int(10) UNSIGNED DEFAULT NULL,
  `return_date` datetime NOT NULL,
  `total_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `reason` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_sale_returns_sale_invoice_id` (`sale_invoice_id`),
  KEY `idx_sale_returns_customer_id` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
