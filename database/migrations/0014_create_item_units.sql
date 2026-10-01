-- 0014_create_item_units.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `item_units` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `unit_name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unit_name` (`unit_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
