-- Database phase: additive upgrade; preserve applied migrations and existing data.
ALTER TABLE sale_invoice_items ADD COLUMN cost_price_minor BIGINT UNSIGNED NULL, ADD COLUMN discount_minor BIGINT UNSIGNED NULL;

