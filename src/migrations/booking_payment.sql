-- Migration: create `booking_payments`
-- Backs: modules/booking-payments
-- Depends on: customers (001), bookings (023)

CREATE TABLE IF NOT EXISTS `booking_payments` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id` int(10) UNSIGNED NOT NULL,
  `booking_id` int(10) UNSIGNED NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_method` enum('cash','card','bank_transfer','mobile_wallet','cheque') DEFAULT 'cash',
  `payment_date` datetime DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_booking_payments_customer_id` (`customer_id`),
  KEY `idx_booking_payments_booking_id` (`booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
