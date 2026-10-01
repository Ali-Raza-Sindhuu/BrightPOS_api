-- 0001_create_business_units.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `business_units` (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL,
  type ENUM('Warehouse','Shop','Godown') NOT NULL DEFAULT 'Warehouse',
  address VARCHAR(255) NULL,
  is_active TINYINT NOT NULL DEFAULT 1,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_business_units_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
