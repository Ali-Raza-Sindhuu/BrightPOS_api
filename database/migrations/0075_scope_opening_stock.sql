-- Database phase: additive upgrade; preserve applied migrations and existing data.
ALTER TABLE opening_stock
  ADD COLUMN store_id INT UNSIGNED NOT NULL DEFAULT 1,
  ADD KEY idx_opening_stock_store (store_id),
  ADD UNIQUE KEY uq_opening_stock_store_row (store_id, id),
  ADD CONSTRAINT fk_opening_stock_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

