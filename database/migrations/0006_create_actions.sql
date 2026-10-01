-- 0006_create_actions.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE actions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL,
  code        VARCHAR(50)  NOT NULL UNIQUE,   
  description VARCHAR(255) DEFAULT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
