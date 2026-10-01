-- Migration: 07_suppliers.sql
-- Table: suppliers
-- Used by modules/suppliers

CREATE TABLE `suppliers` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `supplier_name` varchar(150) NOT NULL,
  `contact_person` varchar(100) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `payment_terms` enum('Cash','Credit') NOT NULL DEFAULT 'Cash',
  `credit_limit` decimal(12,2) DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `designation` varchar(100) NOT NULL DEFAULT '',
  `ntn` varchar(50) DEFAULT NULL,
  `gst` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
