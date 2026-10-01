-- Migration: create `purchase_return_items`
-- Backs: modules/purchase-returns
-- Depends on: purchase_returns (008), item_details (already exists — Step 1)

CREATE TABLE IF NOT EXISTS `purchase_return_items` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `purchase_return_id` int(10) UNSIGNED NOT NULL,
  `item_id` int(10) UNSIGNED DEFAULT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `purchase_price` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total` decimal(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `idx_purchase_return_items_purchase_return_id` (`purchase_return_id`),
  KEY `idx_purchase_return_items_item_id` (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
