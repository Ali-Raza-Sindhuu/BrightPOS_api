-- Migration: 12_goods_receipts.sql
-- Table: goods_receipts
-- Used by modules/goodsReceipts
-- Depends on: purchases (10)

CREATE TABLE `goods_receipts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `purchase_id` int(10) UNSIGNED NOT NULL,
  `grn_no` varchar(100) DEFAULT NULL,
  `grn_date` date NOT NULL,
  `status` enum('pending','received') DEFAULT 'pending',
  `remarks` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `grn_no` (`grn_no`),
  KEY `purchase_id` (`purchase_id`),
  CONSTRAINT `goods_receipts_ibfk_1` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- This one DOES have a real FK in the source dump (ON DELETE CASCADE), which is
-- why modules/purchases/services/purchase.service.js blocks deleting a purchase
-- once order_status = 'received' rather than relying on the cascade to clean up
-- history silently.
