CREATE TABLE reorders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id INT UNSIGNED NOT NULL,
  reorder_qty INT UNSIGNED NOT NULL DEFAULT 1,
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
);