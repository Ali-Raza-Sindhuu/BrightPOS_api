-- 0032_create_sale_return_items.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `sale_return_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sale_return_id` INT UNSIGNED NOT NULL,
  `item_id` INT UNSIGNED DEFAULT NULL,
  `qty` DECIMAL(15,2) NOT NULL DEFAULT 1.00,
  `price` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total` decimal(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `idx_sale_return_items_sale_return_id` (`sale_return_id`),
  KEY `idx_sale_return_items_item_id` (`item_id`),
  CONSTRAINT fk_sale_return_items_sale_return_id FOREIGN KEY (sale_return_id) REFERENCES sale_returns(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_sale_return_items_item_id FOREIGN KEY (item_id) REFERENCES item_details(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
