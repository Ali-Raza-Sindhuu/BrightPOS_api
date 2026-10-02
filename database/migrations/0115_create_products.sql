-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  name VARCHAR(200) NOT NULL,
  kind ENUM('retail','bakery','ingredient') NOT NULL DEFAULT 'retail',
  description TEXT NULL,
  is_active TINYINT UNSIGNED NOT NULL DEFAULT 1,
  category_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_store_row (store_id, id),
  KEY idx_product_search (store_id, name),
  CONSTRAINT fk_products_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_products_category_id FOREIGN KEY (store_id, category_id) REFERENCES categories(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

