-- Database phase: additive upgrade; preserve applied migrations and existing data.
ALTER TABLE manufacturers
  ADD COLUMN store_id INT UNSIGNED NOT NULL DEFAULT 1,
  ADD KEY idx_manufacturers_store (store_id),
  ADD UNIQUE KEY uq_manufacturers_store_row (store_id, id),
  ADD CONSTRAINT fk_manufacturers_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

