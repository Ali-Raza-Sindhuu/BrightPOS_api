-- Database phase: additive upgrade; preserve applied migrations and existing data.
ALTER TABLE access_ip_logs
  ADD COLUMN store_id INT UNSIGNED NOT NULL DEFAULT 1,
  ADD KEY idx_access_ip_logs_store (store_id),
  ADD UNIQUE KEY uq_access_ip_logs_store_row (store_id, id),
  ADD CONSTRAINT fk_access_ip_logs_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

