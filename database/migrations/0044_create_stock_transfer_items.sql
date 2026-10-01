-- 0044_create_stock_transfer_items.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `stock_transfer_items` (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  transfer_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  quantity DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_stock_transfer_items_transfer_id FOREIGN KEY (transfer_id) REFERENCES stock_transfers(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_stock_transfer_items_item_id FOREIGN KEY (item_id) REFERENCES item_details(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
