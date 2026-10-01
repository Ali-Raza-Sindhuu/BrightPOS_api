-- 0028_create_sale_invoices.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `sale_invoices` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id` INT UNSIGNED DEFAULT NULL,
  `description` text DEFAULT NULL,
  `receipt_no` varchar(50) DEFAULT NULL,
  `discount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `sub_total` decimal(12,2) DEFAULT 0.00,
  `payable` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` enum('paid','unpaid','partially_paid') DEFAULT 'unpaid',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  business_unit_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sale_invoices_customer_id` (`customer_id`),
  KEY `idx_sale_invoices_receipt_no` (`receipt_no`),
  KEY `idx_sale_invoices_status` (`status`),
  CONSTRAINT fk_sale_invoices_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT fk_sale_invoices_business_unit_id FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
