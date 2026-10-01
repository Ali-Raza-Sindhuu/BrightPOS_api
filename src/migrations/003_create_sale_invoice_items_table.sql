-- Migration: create `sale_invoice_items`
-- Backs: modules/sales
-- Depends on: sale_invoices (002), item_details (already exists — Step 1)

CREATE TABLE IF NOT EXISTS `sale_invoice_items` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `invoice_id` int(10) UNSIGNED NOT NULL,
  `item_id` int(10) UNSIGNED DEFAULT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `unit_price` decimal(12,2) NOT NULL,
  `total_price` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sale_invoice_items_invoice_id` (`invoice_id`),
  KEY `idx_sale_invoice_items_item_id` (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
