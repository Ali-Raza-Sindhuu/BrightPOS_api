-- The current API stores permission keys directly (for example,
-- ACCESS.SALES.READ) and loads them through permissionModel.js.
CREATE TABLE IF NOT EXISTS permissions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  permission_key VARCHAR(150) NOT NULL UNIQUE,
  module         VARCHAR(100) NOT NULL,
  description    VARCHAR(255) DEFAULT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
