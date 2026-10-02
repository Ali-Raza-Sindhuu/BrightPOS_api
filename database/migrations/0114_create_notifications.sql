-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  type VARCHAR(80) NOT NULL,
  severity ENUM('info','warning','critical') NOT NULL DEFAULT 'info',
  title VARCHAR(150) NOT NULL,
  body TEXT NOT NULL,
  recipient_role ENUM('owner','manager','cashier','inventory_clerk') NULL,
  entity_type VARCHAR(60) NULL,
  entity_id BIGINT UNSIGNED NULL,
  dedupe_key VARCHAR(191) NULL,
  read_at DATETIME NULL,
  recipient_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notifications_store_row (store_id, id),
  UNIQUE KEY uq_notification_dedupe (store_id, dedupe_key),
  KEY idx_notification_unread (store_id, recipient_id, read_at, created_at),
  CONSTRAINT fk_notifications_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_notifications_recipient_id FOREIGN KEY (store_id, recipient_id) REFERENCES users(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

