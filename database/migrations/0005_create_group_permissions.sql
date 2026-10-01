-- 0005_create_group_permissions.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE group_permissions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  group_id      INT NOT NULL,
  permission_id INT NOT NULL,
  effect         ENUM('ALLOW','DENY') NOT NULL DEFAULT 'ALLOW',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gp_group FOREIGN KEY (group_id) REFERENCES access_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_gp_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_group_permission (group_id, permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
