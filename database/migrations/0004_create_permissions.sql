-- 0004_create_permissions.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE permissions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  permission_key VARCHAR(150) NOT NULL UNIQUE,
  module         VARCHAR(100) NOT NULL,
  description    VARCHAR(255) DEFAULT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
