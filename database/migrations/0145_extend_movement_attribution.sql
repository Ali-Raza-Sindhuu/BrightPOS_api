-- Database phase: additive upgrade; preserve applied migrations and existing data.
ALTER TABLE item_stock
  ADD COLUMN created_by INT NULL,
  ADD COLUMN register_id BIGINT UNSIGNED NULL,
  ADD COLUMN reason VARCHAR(500) NULL,
  ADD CONSTRAINT fk_movement_actor FOREIGN KEY (store_id, created_by) REFERENCES users(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_movement_register FOREIGN KEY (store_id, register_id) REFERENCES registers(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;

