-- Migration: create `stock_snapshot_items`
-- Backs: modules/stock-snapshots
-- Depends on: stock_snapshots (032), item_details (already exists — Step 1)

CREATE TABLE IF NOT EXISTS `stock_snapshot_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `snapshot_id` int(11) NOT NULL,
  `item_id` int(10) UNSIGNED NOT NULL,
  `opening_stock` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total_purchases` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total_sales` decimal(15,2) NOT NULL DEFAULT 0.00,
  `adjustment` decimal(15,2) NOT NULL DEFAULT 0.00,
  `calc_closing` decimal(15,2) NOT NULL DEFAULT 0.00,
  `purchase_price` decimal(12,2) DEFAULT NULL,
  `sale_price` decimal(12,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_snapshot_item` (`snapshot_id`, `item_id`),
  KEY `idx_stock_snapshot_items_item_id` (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
