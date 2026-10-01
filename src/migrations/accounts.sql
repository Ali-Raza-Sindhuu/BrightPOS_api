-- =====================================================================
-- Accounts Module migration
-- Adds: business units, voucher numbering, status workflow, expense
-- head status/code, and the indexes the report/list queries need.
-- Run inside a maintenance window; this is not itself transactional
-- (DDL in MySQL auto-commits per statement).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Business units (referenced by expense_vouchers; needed for multi-BU
-- isolation, which the current schema has no concept of at all).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_units (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  code        VARCHAR(20)  NOT NULL,
  status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_business_units_code (code)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- A dedicated counter row + FOR UPDATE lock is the standard safe
-- pattern for gapless-ish sequential document numbers in MySQL.
-- (AUTO_INCREMENT alone works for uniqueness but not for a stable
-- zero-padded human-facing sequence like EXP-000001.)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sequence_counters (
  name        VARCHAR(50) NOT NULL PRIMARY KEY,
  next_value  INT UNSIGNED NOT NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO sequence_counters (name, next_value) VALUES ('expense_voucher', 1);

-- ---------------------------------------------------------------------
-- expense_heads: add code + status (deactivate support)
-- ---------------------------------------------------------------------
ALTER TABLE expense_heads
  ADD COLUMN expense_code VARCHAR(20) NULL AFTER head,
  ADD COLUMN status ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER description;

-- Backfill codes for any existing rows before making it required+unique.
-- Adjust the generation logic to your own convention before running in prod.
UPDATE expense_heads SET expense_code = CONCAT('EH-', LPAD(id, 4, '0')) WHERE expense_code IS NULL;

ALTER TABLE expense_heads
  MODIFY COLUMN expense_code VARCHAR(20) NOT NULL,
  ADD UNIQUE KEY uq_expense_heads_code (expense_code);

-- ---------------------------------------------------------------------
-- expense_vouchers: voucher_number, business_unit_id, status workflow,
-- payment_method, paid_to, reference_number, audit fields, and an
-- idempotency key to catch double-submits.
-- ---------------------------------------------------------------------

-- Seed a default business unit so existing rows have somewhere to point.
INSERT IGNORE INTO business_units (id, name, code) VALUES (1, 'Default', 'DEFAULT');

ALTER TABLE expense_vouchers
  ADD COLUMN voucher_number    VARCHAR(20) NULL AFTER id,
  ADD COLUMN business_unit_id  INT UNSIGNED NULL AFTER voucher_number,
  ADD COLUMN payment_method    ENUM('cash','bank','cheque','online_transfer') NOT NULL DEFAULT 'cash',
  ADD COLUMN paid_to           VARCHAR(150) NULL,
  ADD COLUMN reference_number  VARCHAR(50) NULL,
  ADD COLUMN status            ENUM('draft','posted','cancelled') NOT NULL DEFAULT 'draft',
  ADD COLUMN created_by        INT UNSIGNED NULL,
  ADD COLUMN posted_at         DATETIME NULL,
  ADD COLUMN idempotency_key   VARCHAR(100) NULL;

-- Backfill voucher_number + business_unit_id for existing rows so the
-- NOT NULL + UNIQUE constraints below don't fail on old data.
SET @rownum := 0;
UPDATE expense_vouchers
  SET voucher_number = CONCAT('EXP-', LPAD((@rownum := @rownum + 1), 6, '0'))
  WHERE voucher_number IS NULL
  ORDER BY id;
UPDATE sequence_counters SET next_value = @rownum + 1 WHERE name = 'expense_voucher';
UPDATE expense_vouchers SET business_unit_id = 1 WHERE business_unit_id IS NULL;
-- Existing rows already hit the daybook when they were created, so treat
-- them as posted rather than draft to avoid silently un-posting history.
UPDATE expense_vouchers SET status = 'posted' WHERE posted_at IS NULL;

ALTER TABLE expense_vouchers
  MODIFY COLUMN voucher_number   VARCHAR(20) NOT NULL,
  MODIFY COLUMN business_unit_id INT UNSIGNED NOT NULL,
  MODIFY COLUMN amount           DECIMAL(14,2) NOT NULL,
  ADD CONSTRAINT fk_ev_business_unit FOREIGN KEY (business_unit_id) REFERENCES business_units(id),
  ADD UNIQUE KEY uq_ev_voucher_number (voucher_number),
  ADD UNIQUE KEY uq_ev_idempotency_key (idempotency_key),
  ADD KEY idx_ev_business_unit (business_unit_id),
  ADD KEY idx_ev_head (head_id),
  ADD KEY idx_ev_date (voucher_date),
  ADD KEY idx_ev_status (status),
  ADD KEY idx_ev_payment_method (payment_method),
  ADD KEY idx_ev_report_filter (status, business_unit_id, voucher_date);
  -- idx_ev_report_filter is the composite index the report queries below
  -- actually hit: WHERE status='posted' AND business_unit_id=? AND
  -- voucher_date BETWEEN ? AND ?, so status leads (most selective/fixed
  -- filter), then business_unit_id, then the range column last.
