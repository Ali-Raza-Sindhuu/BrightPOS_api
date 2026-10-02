-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE store_staff (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  role ENUM('owner','manager','cashier','inventory_clerk') NOT NULL,
  is_active TINYINT UNSIGNED NOT NULL DEFAULT 1,
  user_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_store_staff_store_row (store_id, id),
  UNIQUE KEY uq_store_staff_user (store_id, user_id),
  CONSTRAINT fk_store_staff_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_store_staff_user_id FOREIGN KEY (store_id, user_id) REFERENCES users(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

