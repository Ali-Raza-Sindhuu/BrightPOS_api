-- Database phase: additive upgrade; preserve applied migrations and existing data.
ALTER TABLE marketing_submissions
  ADD COLUMN store_id INT UNSIGNED NOT NULL DEFAULT 1,
  ADD KEY idx_marketing_submissions_store (store_id),
  ADD UNIQUE KEY uq_marketing_submissions_store_row (store_id, id),
  ADD CONSTRAINT fk_marketing_submissions_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

