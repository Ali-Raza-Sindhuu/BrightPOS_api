-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE offline_stock_allocations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  public_id CHAR(36) NOT NULL,
  allocated_quantity DECIMAL(18,6) NOT NULL,
  consumed_quantity DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  status ENUM('active','reconciling','released') NOT NULL DEFAULT 'active',
  expires_at DATETIME NOT NULL,
  released_at DATETIME NULL,
  register_id BIGINT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  business_unit_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_offline_stock_allocations_store_row (store_id, id),
  UNIQUE KEY uq_offline_allocation_public (public_id),
  KEY idx_offline_allocation_stock (store_id, business_unit_id, item_id, status),
  CONSTRAINT chk_offline_allocation_quantity CHECK (allocated_quantity > 0 AND consumed_quantity >= 0 AND consumed_quantity <= allocated_quantity),
  CONSTRAINT fk_offline_stock_allocations_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_offline_stock_allocations_register_id FOREIGN KEY (store_id, register_id) REFERENCES registers(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_offline_stock_allocations_item_id FOREIGN KEY (store_id, item_id) REFERENCES item_details(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_offline_stock_allocations_business_unit_id FOREIGN KEY (store_id, business_unit_id) REFERENCES business_units(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
