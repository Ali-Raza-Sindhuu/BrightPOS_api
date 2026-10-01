-- Base tables for the accounts feature. accounts.sql adds business-unit,
-- status, voucher numbering, and reporting columns afterward.
CREATE TABLE IF NOT EXISTS expense_heads (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  head VARCHAR(100) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_expense_heads_head (head)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS expense_vouchers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  head_id INT UNSIGNED NULL,
  amount DECIMAL(14,2) NOT NULL,
  details TEXT NULL,
  voucher_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expense_vouchers_head (head_id),
  KEY idx_expense_vouchers_date (voucher_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS daybook (
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
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_daybook_date (date),
  KEY idx_daybook_reference (reference_type, reference_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
