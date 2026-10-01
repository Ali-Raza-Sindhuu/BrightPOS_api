-- 0002_create_access_groups.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE access_groups (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(50) NOT NULL UNIQUE,
  name         VARCHAR(100) NOT NULL UNIQUE,
  description  VARCHAR(255) DEFAULT NULL,
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
