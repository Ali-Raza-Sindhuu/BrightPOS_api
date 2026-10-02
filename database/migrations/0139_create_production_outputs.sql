-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE production_outputs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  produced_quantity DECIMAL(18,6) NOT NULL,
  unit_code VARCHAR(20) NOT NULL,
  cost_minor BIGINT UNSIGNED NULL,
  production_id BIGINT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_production_outputs_store_row (store_id, id),
  UNIQUE KEY uq_production_outputs_item (store_id, production_id, item_id),
  CONSTRAINT chk_production_outputs_quantity CHECK (produced_quantity > 0),
  CONSTRAINT fk_production_outputs_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_production_outputs_production_id FOREIGN KEY (store_id, production_id) REFERENCES production_runs(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_production_outputs_item_id FOREIGN KEY (store_id, item_id) REFERENCES item_details(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

