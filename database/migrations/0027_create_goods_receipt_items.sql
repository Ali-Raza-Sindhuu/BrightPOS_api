-- 0027_create_goods_receipt_items.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `goods_receipt_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `grn_id` INT NOT NULL,
  `item_id` INT UNSIGNED NOT NULL,
  `received_qty` decimal(10,2) DEFAULT 0.00,
  purchase_item_id INT UNSIGNED NOT NULL,
  purchase_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  sale_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  accepted_qty DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  rejected_qty DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  condition_note VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  KEY `grn_id` (`grn_id`),
  CONSTRAINT `goods_receipt_items_ibfk_1` FOREIGN KEY (`grn_id`) REFERENCES `goods_receipts` (`id`) ON DELETE CASCADE,
  CONSTRAINT fk_goods_receipt_items_purchase_item_id FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_goods_receipt_items_item_id FOREIGN KEY (item_id) REFERENCES item_details(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
