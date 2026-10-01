-- Migration: 05_manufacturers.sql
-- Table: manufacturers
-- Used by modules/manufacturers

CREATE TABLE `manufacturers` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `manufacturer_id` varchar(50) NOT NULL,
  `manufacturer_name` varchar(150) NOT NULL,
  `contact_person` varchar(100) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `mobile` varchar(20) DEFAULT NULL,
  `designation` varchar(100) DEFAULT NULL,
  `ntn` varchar(50) DEFAULT NULL,
  `gst` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `manufacturer_id` (`manufacturer_id`),
  UNIQUE KEY `unique_ntn` (`ntn`),
  UNIQUE KEY `unique_gst` (`gst`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
