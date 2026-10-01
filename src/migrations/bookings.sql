-- Migration: create `bookings`
-- Backs: modules/bookings
-- Depends on: customers (001)

CREATE TABLE IF NOT EXISTS `bookings` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id` int(10) UNSIGNED DEFAULT NULL,
  `booking_date` date NOT NULL,
  `booking_time` time DEFAULT NULL,
  `sub_total` decimal(12,2) DEFAULT NULL,
  `discount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `payable` decimal(12,2) NOT NULL DEFAULT 0.00,
  `paid` decimal(12,2) NOT NULL DEFAULT 0.00,
  `to_be_paid` decimal(12,2) DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `booking_status` enum('Pending','Completed','Rejected') DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `payment_status` enum('Paid','Unpaid','Partial') NOT NULL DEFAULT 'Unpaid',
  PRIMARY KEY (`id`),
  KEY `idx_bookings_customer_id` (`customer_id`),
  KEY `idx_bookings_status` (`booking_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
