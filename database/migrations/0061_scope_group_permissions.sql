-- Database phase: additive upgrade; preserve applied migrations and existing data.
ALTER TABLE group_permissions
  ADD COLUMN store_id INT UNSIGNED NOT NULL DEFAULT 1,
  ADD KEY idx_group_permissions_store (store_id),
  ADD CONSTRAINT fk_group_permissions_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

