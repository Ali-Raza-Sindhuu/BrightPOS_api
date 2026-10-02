-- Database phase: additive upgrade; preserve applied migrations and existing data.
ALTER TABLE users
  ADD COLUMN store_id INT UNSIGNED NOT NULL DEFAULT 1,
  ADD KEY idx_users_store (store_id),
  ADD UNIQUE KEY uq_users_store_row (store_id, id),
  ADD CONSTRAINT fk_users_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

