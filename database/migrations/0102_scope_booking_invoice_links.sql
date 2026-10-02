-- Database phase: additive upgrade; preserve applied migrations and existing data.
ALTER TABLE booking_invoice_links
  ADD COLUMN store_id INT UNSIGNED NOT NULL DEFAULT 1,
  ADD KEY idx_booking_invoice_links_store (store_id),
  ADD CONSTRAINT fk_booking_invoice_links_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

