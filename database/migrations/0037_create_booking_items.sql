-- 0037_create_booking_items.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `booking_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `item_id` INT UNSIGNED DEFAULT NULL,
  `booking_id` INT UNSIGNED NOT NULL,
  `qty` DECIMAL(15,2) NOT NULL DEFAULT 1.00,
  `unit_price` decimal(12,2) NOT NULL,
  `total_price` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_booking_items_booking_id` (`booking_id`),
  KEY `idx_booking_items_item_id` (`item_id`),
  CONSTRAINT fk_booking_items_booking_id FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_booking_items_item_id FOREIGN KEY (item_id) REFERENCES item_details(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
