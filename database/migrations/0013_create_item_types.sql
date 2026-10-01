-- 0013_create_item_types.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `item_types` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `type_name` varchar(150) DEFAULT NULL,
  `is_enable` tinyint(1) NOT NULL DEFAULT 1 ,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `description` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_item_name` (`type_name`),
  KEY `idx_is_enable` (`is_enable`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
