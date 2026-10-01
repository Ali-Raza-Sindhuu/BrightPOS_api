-- 0036_create_bookings.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `bookings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id` INT UNSIGNED DEFAULT NULL,
  `booking_date` date NOT NULL,
  `booking_time` time DEFAULT NULL,
  `sub_total` decimal(12,2) DEFAULT NULL,
  `discount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `payable` decimal(12,2) NOT NULL DEFAULT 0.00,
  `paid` decimal(12,2) NOT NULL DEFAULT 0.00,
  `to_be_paid` decimal(12,2) DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `booking_status` ENUM('Pending','Completed','Rejected') NOT NULL DEFAULT 'Pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `payment_status` enum('Paid','Unpaid','Partial') NOT NULL DEFAULT 'Unpaid',
  business_unit_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_bookings_customer_id` (`customer_id`),
  KEY `idx_bookings_status` (`booking_status`),
  CONSTRAINT fk_bookings_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT fk_bookings_business_unit_id FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
