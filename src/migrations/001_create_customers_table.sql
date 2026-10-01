-- Migration: create `customers`
-- Backs: modules/customers

CREATE TABLE IF NOT EXISTS `customers` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_name` varchar(150) NOT NULL,
  `address` text DEFAULT NULL,
  `mobile_number` varchar(20) DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `nearby` varchar(150) DEFAULT NULL,
  `total_bill` decimal(12,2) NOT NULL DEFAULT 0.00,
  `previous_balance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_customers_mobile_number` (`mobile_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Note: mobile_number uniqueness is enforced at the application layer
-- (customer.service.js), not as a DB constraint, matching the source schema.
