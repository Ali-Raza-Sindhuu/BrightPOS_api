-- Migration: 13_goods_receipt_items.sql
-- Table: goods_receipt_items
-- Used by modules/goodsReceipts
-- Depends on: goods_receipts (12), item_details (08)

CREATE TABLE `goods_receipt_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `grn_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `received_qty` decimal(10,2) DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `grn_id` (`grn_id`),
  CONSTRAINT `goods_receipt_items_ibfk_1` FOREIGN KEY (`grn_id`) REFERENCES `goods_receipts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
