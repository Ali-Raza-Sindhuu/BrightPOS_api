-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE production_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  planned_yield DECIMAL(18,6) NOT NULL,
  actual_yield DECIMAL(18,6) NULL,
  status ENUM('draft','completed','cancelled') NOT NULL DEFAULT 'draft',
  idempotency_key VARCHAR(100) NOT NULL,
  completed_at DATETIME NULL,
  total_cost_minor BIGINT UNSIGNED NULL,
  recipe_id BIGINT UNSIGNED NOT NULL,
  business_unit_id INT UNSIGNED NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_production_runs_store_row (store_id, id),
  UNIQUE KEY uq_production_request (store_id, idempotency_key),
  CONSTRAINT chk_production_yield CHECK (planned_yield > 0 AND (actual_yield IS NULL OR actual_yield >= 0)),
  CONSTRAINT chk_production_complete CHECK (status <> 'completed' OR (actual_yield IS NOT NULL AND completed_at IS NOT NULL)),
  CONSTRAINT fk_production_runs_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_production_runs_recipe_id FOREIGN KEY (store_id, recipe_id) REFERENCES recipe_versions(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_production_runs_business_unit_id FOREIGN KEY (store_id, business_unit_id) REFERENCES business_units(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_production_runs_created_by FOREIGN KEY (store_id, created_by) REFERENCES users(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

