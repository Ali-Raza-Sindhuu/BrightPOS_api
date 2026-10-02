-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE audit_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  event_key VARCHAR(100) NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  reason VARCHAR(500) NULL,
  before_data JSON NULL,
  after_data JSON NULL,
  actor_id INT NULL,
  register_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_audit_events_store_row (store_id, id),
  UNIQUE KEY uq_audit_event (store_id, event_key),
  KEY idx_audit_entity (store_id, entity_type, entity_id, created_at),
  CONSTRAINT fk_audit_events_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_audit_events_actor_id FOREIGN KEY (store_id, actor_id) REFERENCES users(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_audit_events_register_id FOREIGN KEY (store_id, register_id) REFERENCES registers(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

