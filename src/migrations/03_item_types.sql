-- Migration: 03_item_types.sql
-- Table: item_types
-- Used by modules/itemTypes

CREATE TABLE `item_types` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `type_name` varchar(150) DEFAULT NULL,
  `is_enable` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1 = Active/Enabled, 0 = Inactive/Disabled',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `description` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_item_name` (`type_name`),
  KEY `idx_is_enable` (`is_enable`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
