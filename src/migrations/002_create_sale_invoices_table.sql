-- Migration: create `sale_invoices`
-- Backs: modules/sales
-- Depends on: customers (001)

CREATE TABLE IF NOT EXISTS `sale_invoices` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id` int(10) UNSIGNED DEFAULT NULL,
  `description` text DEFAULT NULL,
  `receipt_no` varchar(50) DEFAULT NULL,
  `discount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `sub_total` decimal(12,2) DEFAULT 0.00,
  `payable` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` enum('paid','unpaid','partially_paid') DEFAULT 'unpaid',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_sale_invoices_customer_id` (`customer_id`),
  KEY `idx_sale_invoices_receipt_no` (`receipt_no`),
  KEY `idx_sale_invoices_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
