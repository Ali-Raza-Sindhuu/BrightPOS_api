-- Migration: 08_item_details.sql
-- Table: item_details (the core "items" table)
-- Used by modules/items
-- Depends on: categories (01), sub_categories (02), item_types (03),
--             item_units (04), manufacturers (05), shelve_locations (06),
--             suppliers (07)

CREATE TABLE `item_details` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `item_name` varchar(200) NOT NULL,
  `item_image_url` varchar(500) DEFAULT NULL,
  `label_barcode` varchar(100) DEFAULT NULL,
  `item_category_id` int(10) UNSIGNED DEFAULT NULL,
  `manufacturer_id` int(10) UNSIGNED DEFAULT NULL,
  `supplier_id` int(10) UNSIGNED DEFAULT NULL,
  `shelve_location_id` int(10) UNSIGNED DEFAULT NULL,
  `item_unit_id` int(10) UNSIGNED DEFAULT NULL,
  `details` text DEFAULT NULL,
  `is_enable` tinyint(1) UNSIGNED NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `purchase_price` decimal(10,2) DEFAULT 0.00,
  `sale_price` decimal(10,2) DEFAULT 0.00,
  `stock` int(11) DEFAULT 0,
  `reorder_level` int(11) DEFAULT 0,
  `per_unit` int(11) NOT NULL DEFAULT 1,
  `item_subcategory_id` int(10) UNSIGNED DEFAULT NULL,
  `item_type_id` int(10) UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `label_barcode` (`label_barcode`),
  KEY `fk_id_category` (`item_category_id`),
  KEY `fk_id_manuf` (`manufacturer_id`),
  KEY `fk_id_supplier` (`supplier_id`),
  KEY `fk_id_shelve` (`shelve_location_id`),
  KEY `fk_id_unit` (`item_unit_id`),
  KEY `idx_id_barcode` (`label_barcode`),
  KEY `fk_item_subcategory` (`item_subcategory_id`),
  KEY `fk_item_type` (`item_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- NOTE: The original schema indexes these FK columns but does not add DB-level
-- FOREIGN KEY constraints on item_details (no ADD CONSTRAINT for this table in
-- the source dump). All 7 relations (category, sub-category, manufacturer,
-- supplier, shelve location, unit, type) are validated at the application
-- layer instead — see modules/items/services/item.service.js -> validateForeignKeys().
