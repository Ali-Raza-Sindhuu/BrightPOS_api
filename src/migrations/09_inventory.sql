-- Migration: 09_inventory.sql
-- Table: inventory
-- Used by modules/goodsReceipts (upserted when a GRN is received)
-- Depends on: item_details (08), item_units (04)

CREATE TABLE `inventory` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `item_id` int(10) UNSIGNED NOT NULL,
  `unit_id` int(11) NOT NULL,
  `quantity` decimal(15,2) DEFAULT 0.00,
  `last_updated` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `item_per_unit` (`item_id`,`unit_id`),
  KEY `fk_inventory_unit` (`unit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- The UNIQUE KEY (item_id, unit_id) is what modules/goodsReceipts/models/goodsReceipt.model.js
-- relies on to decide whether to INSERT a new inventory row or UPDATE the existing quantity.
-- No DB-level FK constraints in the source dump for this table either; item_id/unit_id
-- validity is guaranteed because inventory rows are only ever written by the
-- goods-receipt "receive" flow, which reads item_id/unit_id from item_details directly.
