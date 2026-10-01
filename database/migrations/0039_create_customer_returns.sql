-- 0039_create_customer_returns.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `customer_returns` (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  return_no VARCHAR(50) NULL,
  source_type ENUM('sale','booking') NOT NULL,
  source_id INT UNSIGNED NOT NULL,
  source_no VARCHAR(50) NULL,
  customer_id INT UNSIGNED NOT NULL,
  customer_name VARCHAR(150) NULL,
  mobile VARCHAR(20) NULL,
  original_subtotal DECIMAL(12,2) NOT NULL,
  original_discount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  original_total DECIMAL(12,2) NOT NULL,
  refund_amount DECIMAL(12,2) NOT NULL,
  restocking_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  final_refund DECIMAL(12,2) NOT NULL,
  refund_method VARCHAR(50) NOT NULL DEFAULT 'cash',
  status ENUM('requested','approved','items_received','refunded','completed','rejected') NOT NULL DEFAULT 'requested',
  cancellation_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  return_reason TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_returns_number (return_no),
  KEY idx_customer_returns_source (source_type, source_id),
  CONSTRAINT fk_customer_returns_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
