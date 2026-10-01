-- 0029_create_sale_invoice_items.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `sale_invoice_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `invoice_id` INT UNSIGNED NOT NULL,
  `item_id` INT UNSIGNED DEFAULT NULL,
  `qty` DECIMAL(15,2) NOT NULL DEFAULT 1.00,
  `unit_price` decimal(12,2) NOT NULL,
  `total_price` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sale_invoice_items_invoice_id` (`invoice_id`),
  KEY `idx_sale_invoice_items_item_id` (`item_id`),
  CONSTRAINT fk_sale_invoice_items_invoice_id FOREIGN KEY (invoice_id) REFERENCES sale_invoices(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_sale_invoice_items_item_id FOREIGN KEY (item_id) REFERENCES item_details(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
