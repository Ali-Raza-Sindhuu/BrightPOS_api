-- 0040_create_reorders.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE reorders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id INT UNSIGNED NOT NULL,
  reorder_qty DECIMAL(15,2) NOT NULL DEFAULT 1.00,
  status ENUM('Pending', 'Ordered', 'Received') NOT NULL DEFAULT 'Pending',
  notes TEXT NULL,
  ordered_at DATETIME NULL,
  received_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_reorders_item
    FOREIGN KEY (item_id) REFERENCES item_details(id)
    ON DELETE CASCADE,

  INDEX idx_reorders_item_status (item_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
