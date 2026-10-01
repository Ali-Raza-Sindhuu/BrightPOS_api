-- 0046_create_expense_heads.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `expense_heads` (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  head VARCHAR(100) NOT NULL,
  expense_code VARCHAR(20) NOT NULL,
  description TEXT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_expense_heads_head (head),
  UNIQUE KEY uq_expense_heads_code (expense_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
