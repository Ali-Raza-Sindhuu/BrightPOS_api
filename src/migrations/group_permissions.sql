-- Day 2: groups <-> permissions. This is the ONLY place rights are granted —
-- per the fixed RBAC model, permissions are never assigned directly to a user.
CREATE TABLE IF NOT EXISTS group_permissions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  group_id      INT NOT NULL,
  permission_id INT NOT NULL,
  effect         ENUM('ALLOW','DENY') NOT NULL DEFAULT 'ALLOW',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gp_group FOREIGN KEY (group_id) REFERENCES access_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_gp_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_group_permission (group_id, permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
