-- Database phase: additive upgrade; preserve applied migrations and existing data.
ALTER TABLE stock_snapshots
  ADD COLUMN store_id INT UNSIGNED NOT NULL DEFAULT 1,
  ADD KEY idx_stock_snapshots_store (store_id),
  ADD UNIQUE KEY uq_stock_snapshots_store_row (store_id, id),
  ADD CONSTRAINT fk_stock_snapshots_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

