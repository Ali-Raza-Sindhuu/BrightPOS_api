-- 0042_create_stock_snapshot_items.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `stock_snapshot_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `snapshot_id` INT NOT NULL,
  `item_id` INT UNSIGNED NOT NULL,
  `opening_stock` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total_purchases` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total_sales` decimal(15,2) NOT NULL DEFAULT 0.00,
  `adjustment` decimal(15,2) NOT NULL DEFAULT 0.00,
  `calc_closing` decimal(15,2) NOT NULL DEFAULT 0.00,
  `purchase_price` decimal(12,2) DEFAULT NULL,
  `sale_price` decimal(12,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_snapshot_item` (`snapshot_id`, `item_id`),
  KEY `idx_stock_snapshot_items_item_id` (`item_id`),
  CONSTRAINT fk_stock_snapshot_items_snapshot_id FOREIGN KEY (snapshot_id) REFERENCES stock_snapshots(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_stock_snapshot_items_item_id FOREIGN KEY (item_id) REFERENCES item_details(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
