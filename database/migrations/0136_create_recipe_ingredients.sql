-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE recipe_ingredients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  quantity DECIMAL(18,6) NOT NULL,
  unit_code VARCHAR(20) NOT NULL,
  to_stock_unit_factor DECIMAL(18,9) NOT NULL,
  cost_minor BIGINT UNSIGNED NULL,
  recipe_id BIGINT UNSIGNED NOT NULL,
  ingredient_item_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_recipe_ingredients_store_row (store_id, id),
  UNIQUE KEY uq_recipe_ingredient (store_id, recipe_id, ingredient_item_id),
  CONSTRAINT chk_recipe_ingredient_positive CHECK (quantity > 0 AND to_stock_unit_factor > 0),
  CONSTRAINT fk_recipe_ingredients_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_recipe_ingredients_recipe_id FOREIGN KEY (store_id, recipe_id) REFERENCES recipe_versions(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_recipe_ingredients_ingredient_item_id FOREIGN KEY (store_id, ingredient_item_id) REFERENCES item_details(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

