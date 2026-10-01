-- 0016_create_shelve_locations.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `shelve_locations` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `shelf_name_code` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `shelf_name_code` (`shelf_name_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
