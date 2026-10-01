-- 0048_create_daybook.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `daybook` (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  reference_type VARCHAR(40) NULL,
  reference_id INT UNSIGNED NULL,
  description VARCHAR(255) NOT NULL,
  cash_out DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  cash_in DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  payment_method ENUM('cash','card','bank_transfer','cheque','online_transfer') NOT NULL DEFAULT 'cash',
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_daybook_date (date),
  KEY idx_daybook_reference (reference_type, reference_id),
  CONSTRAINT fk_daybook_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
