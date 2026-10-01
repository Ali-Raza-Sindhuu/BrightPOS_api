-- 0041_create_stock_snapshots.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `stock_snapshots` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `closing_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_stock_snapshots_closing_date` (`closing_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
