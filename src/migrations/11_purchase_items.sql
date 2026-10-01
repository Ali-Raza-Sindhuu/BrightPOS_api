-- Migration: 11_purchase_items.sql
-- Table: purchase_items
-- Used by modules/purchases
-- Depends on: purchases (10), item_details (08)

CREATE TABLE `purchase_items` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `purchase_id` int(10) UNSIGNED NOT NULL,
  `item_id` int(10) UNSIGNED DEFAULT NULL,
  `purchase_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `sale_price` decimal(12,2) NOT NULL DEFAULT 0.00,
  `qty` int(11) NOT NULL DEFAULT 1,
  `total` decimal(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `fk_pi_purchase` (`purchase_id`),
  KEY `fk_purchase_items_item` (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- No DB-level FK constraint on purchase_items in the source dump. The backend
-- deletes purchase_items manually alongside the parent purchase (see
-- modules/purchases/models/purchase.model.js -> remove()) since there's no
-- ON DELETE CASCADE to rely on.
