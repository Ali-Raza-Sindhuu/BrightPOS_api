-- Database phase: additive upgrade; preserve applied migrations and existing data.
ALTER TABLE sale_returns
  ADD COLUMN store_id INT UNSIGNED NOT NULL DEFAULT 1,
  ADD KEY idx_sale_returns_store (store_id),
  ADD UNIQUE KEY uq_sale_returns_store_row (store_id, id),
  ADD CONSTRAINT fk_sale_returns_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

