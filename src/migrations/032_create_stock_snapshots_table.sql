-- Migration: create `stock_snapshots`
-- Backs: modules/stock-snapshots

CREATE TABLE IF NOT EXISTS `stock_snapshots` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `closing_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_stock_snapshots_closing_date` (`closing_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
