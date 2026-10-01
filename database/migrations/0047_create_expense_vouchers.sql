-- 0047_create_expense_vouchers.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `expense_vouchers` (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  voucher_number VARCHAR(20) NULL,
  business_unit_id INT UNSIGNED NULL,
  head_id INT UNSIGNED NULL,
  amount DECIMAL(14,2) NOT NULL,
  details TEXT NULL,
  voucher_date DATE NOT NULL,
  payment_method ENUM('cash','card','bank','bank_transfer','cheque','online_transfer') NOT NULL DEFAULT 'cash',
  paid_to VARCHAR(150) NULL,
  reference_number VARCHAR(50) NULL,
  status ENUM('draft','posted','cancelled') NOT NULL DEFAULT 'draft',
  created_by INT NULL,
  posted_at DATETIME NULL,
  idempotency_key VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ev_voucher_number (voucher_number),
  UNIQUE KEY uq_ev_idempotency_key (idempotency_key),
  KEY idx_ev_report_filter (status, business_unit_id, voucher_date),
  KEY idx_ev_date (voucher_date),
  KEY idx_ev_payment_method (payment_method),
  CONSTRAINT fk_expense_vouchers_business_unit_id FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_expense_vouchers_head_id FOREIGN KEY (head_id) REFERENCES expense_heads(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_expense_vouchers_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
