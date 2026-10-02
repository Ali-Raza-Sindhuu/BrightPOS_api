-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE recipe_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  version INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  yield_quantity DECIMAL(18,6) NOT NULL,
  yield_unit VARCHAR(20) NOT NULL,
  is_active TINYINT UNSIGNED NOT NULL DEFAULT 1,
  output_item_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_recipe_versions_store_row (store_id, id),
  UNIQUE KEY uq_recipe_version (store_id, output_item_id, version),
  CONSTRAINT chk_recipe_yield CHECK (yield_quantity > 0 AND version > 0),
  CONSTRAINT fk_recipe_versions_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_recipe_versions_output_item_id FOREIGN KEY (store_id, output_item_id) REFERENCES item_details(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

