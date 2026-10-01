-- Migration: create `customer_payments`
-- Backs: modules/customer-payments
-- Depends on: customers (001), sale_invoices (002)

CREATE TABLE IF NOT EXISTS `customer_payments` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `invoice_id` int(10) UNSIGNED DEFAULT NULL,
  `customer_id` int(10) UNSIGNED NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_date` datetime NOT NULL,
  `payment_method` enum('Cash','Card','Bank Transfer','Cheque','Online') NOT NULL DEFAULT 'Cash',
  `remarks` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_customer_payments_customer_id` (`customer_id`),
  KEY `idx_customer_payments_invoice_id` (`invoice_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
