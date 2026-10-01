-- 0003_create_users.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE users (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  full_name      VARCHAR(150) NOT NULL,
  username       VARCHAR(50)  NOT NULL UNIQUE,
  email VARCHAR(150) NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  role           ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  group_id       INT DEFAULT NULL,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at  TIMESTAMP NULL DEFAULT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_group FOREIGN KEY (group_id) REFERENCES access_groups(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
