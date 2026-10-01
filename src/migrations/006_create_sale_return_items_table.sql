-- Migration: create `sale_return_items`
-- Backs: modules/sale-returns
-- Depends on: sale_returns (005), item_details (already exists — Step 1)

CREATE TABLE IF NOT EXISTS `sale_return_items` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `sale_return_id` int(10) UNSIGNED NOT NULL,
  `item_id` int(10) UNSIGNED DEFAULT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `price` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total` decimal(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `idx_sale_return_items_sale_return_id` (`sale_return_id`),
  KEY `idx_sale_return_items_item_id` (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
