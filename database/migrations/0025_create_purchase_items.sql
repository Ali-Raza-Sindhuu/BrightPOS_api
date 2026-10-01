-- 0025_create_purchase_items.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `purchase_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `purchase_id` INT UNSIGNED NOT NULL,
  `item_id` INT UNSIGNED DEFAULT NULL,
  `purchase_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `sale_price` decimal(12,2) NOT NULL DEFAULT 0.00,
  `qty` DECIMAL(15,2) NOT NULL DEFAULT 1.00,
  `total` decimal(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `fk_pi_purchase` (`purchase_id`),
  KEY `fk_purchase_items_item` (`item_id`),
  CONSTRAINT fk_purchase_items_purchase_id FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_purchase_items_item_id FOREIGN KEY (item_id) REFERENCES item_details(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
