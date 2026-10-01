-- 0038_create_booking_payments.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `booking_payments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id` INT UNSIGNED NOT NULL,
  `booking_id` INT UNSIGNED NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_method` enum('cash','card','bank_transfer','mobile_wallet','cheque') DEFAULT 'cash',
  `payment_date` datetime DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_booking_payments_customer_id` (`customer_id`),
  KEY `idx_booking_payments_booking_id` (`booking_id`),
  CONSTRAINT fk_booking_payments_booking_id FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_booking_payments_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
