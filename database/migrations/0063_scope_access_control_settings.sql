-- Database phase: additive upgrade; preserve applied migrations and existing data.
ALTER TABLE access_control_settings
  ADD COLUMN store_id INT UNSIGNED NOT NULL DEFAULT 1,
  ADD KEY idx_access_control_settings_store (store_id),
  ADD UNIQUE KEY uq_access_control_settings_store_row (store_id, id),
  ADD CONSTRAINT fk_access_control_settings_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

