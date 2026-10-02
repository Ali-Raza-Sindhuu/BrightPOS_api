-- Database phase: additive upgrade; preserve applied migrations and existing data.
ALTER TABLE sale_invoices
  ADD COLUMN register_id BIGINT UNSIGNED NULL,
  ADD COLUMN shift_id BIGINT UNSIGNED NULL,
  ADD COLUMN cashier_id INT NULL,
  ADD CONSTRAINT fk_sale_register FOREIGN KEY (store_id, register_id) REFERENCES registers(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_sale_shift FOREIGN KEY (store_id, shift_id) REFERENCES register_shifts(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_sale_cashier FOREIGN KEY (store_id, cashier_id) REFERENCES users(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;

