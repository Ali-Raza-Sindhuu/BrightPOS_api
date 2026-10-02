-- Database phase: additive upgrade; preserve applied migrations and existing data.
ALTER TABLE customers ADD COLUMN email VARCHAR(254) NULL, ADD COLUMN notes TEXT NULL, ADD COLUMN marketing_consent TINYINT UNSIGNED NOT NULL DEFAULT 0;

