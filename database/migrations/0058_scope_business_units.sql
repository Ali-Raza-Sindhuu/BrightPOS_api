-- Database phase: additive upgrade; preserve applied migrations and existing data.
ALTER TABLE business_units
  ADD COLUMN store_id INT UNSIGNED NOT NULL DEFAULT 1,
  ADD KEY idx_business_units_store (store_id),
  ADD UNIQUE KEY uq_business_units_store_row (store_id, id),
  ADD CONSTRAINT fk_business_units_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

