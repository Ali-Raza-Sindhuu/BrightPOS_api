-- 0023_create_opening_stock_items.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `opening_stock_items` (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  opening_stock_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  qty DECIMAL(15,2) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_opening_stock_items_opening_stock_id FOREIGN KEY (opening_stock_id) REFERENCES opening_stock(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_opening_stock_items_item_id FOREIGN KEY (item_id) REFERENCES item_details(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
