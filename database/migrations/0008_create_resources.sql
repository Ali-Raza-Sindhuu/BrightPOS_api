-- 0008_create_resources.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE resources (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  module_id   INT NOT NULL,
  name        VARCHAR(100) NOT NULL,
  code        VARCHAR(50)  NOT NULL,          
  description VARCHAR(255) DEFAULT NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_resources_module FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
  UNIQUE KEY uq_resource_per_module (module_id, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
