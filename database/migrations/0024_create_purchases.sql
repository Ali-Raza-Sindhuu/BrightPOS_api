-- 0024_create_purchases.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `purchases` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `supplier_id` INT UNSIGNED DEFAULT NULL,
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
  business_unit_id INT UNSIGNED NOT NULL,
  paid DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `fk_pur_supplier` (`supplier_id`),
  CONSTRAINT fk_purchases_supplier_id FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_purchases_business_unit_id FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
