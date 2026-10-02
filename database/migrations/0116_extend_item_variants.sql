-- Database phase: additive upgrade; preserve applied migrations and existing data.
ALTER TABLE item_details
  ADD COLUMN product_id BIGINT UNSIGNED NULL,
  ADD COLUMN sku VARCHAR(80) NULL,
  ADD COLUMN variant_options JSON NULL,
  ADD COLUMN base_unit_code VARCHAR(20) NULL,
  ADD UNIQUE KEY uq_item_sku (store_id, sku),
  ADD CONSTRAINT fk_item_product FOREIGN KEY (store_id, product_id) REFERENCES products(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;

