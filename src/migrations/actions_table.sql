-- Day 2: global, reusable verbs (view/create/update/delete/export/approve...)
-- Shared across every resource in every module — not module-specific.
CREATE TABLE IF NOT EXISTS actions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL,
  code        VARCHAR(50)  NOT NULL UNIQUE,   -- e.g. 'view' — used in permission_code
  description VARCHAR(255) DEFAULT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
