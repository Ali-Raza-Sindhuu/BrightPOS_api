-- Migration: 10_purchases.sql
-- Table: purchases
-- Used by modules/purchases
-- Depends on: suppliers (07)

CREATE TABLE `purchases` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `supplier_id` int(10) UNSIGNED DEFAULT NULL,
  `invoice_no` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `discount_percent` decimal(5,2) NOT NULL DEFAULT 0.00,
  `discount_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `sub_total` decimal(12,2) DEFAULT NULL,
  `payable` decimal(12,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `payment_status` enum('paid','partial','unpaid') DEFAULT 'unpaid',
  `order_status` enum('pending','received','returned') NOT NULL DEFAULT 'pending',
  PRIMARY KEY (`id`),
  KEY `fk_pur_supplier` (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
