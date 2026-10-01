-- 0026_create_goods_receipts.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `goods_receipts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `purchase_id` INT UNSIGNED NOT NULL,
  `grn_no` varchar(100) DEFAULT NULL,
  `grn_date` date NOT NULL,
  `status` ENUM('pending','partial','received') DEFAULT 'pending',
  `remarks` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  business_unit_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `grn_no` (`grn_no`),
  KEY `purchase_id` (`purchase_id`),
  CONSTRAINT `goods_receipts_ibfk_1` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`) ON DELETE CASCADE,
  CONSTRAINT fk_goods_receipts_business_unit_id FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
