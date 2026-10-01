-- Migration: create `booking_items`
-- Backs: modules/bookings
-- Depends on: bookings (023), item_details (already exists — Step 1)

CREATE TABLE IF NOT EXISTS `booking_items` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `item_id` int(10) UNSIGNED DEFAULT NULL,
  `booking_id` int(10) UNSIGNED NOT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `unit_price` decimal(12,2) NOT NULL,
  `total_price` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_booking_items_booking_id` (`booking_id`),
  KEY `idx_booking_items_item_id` (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
