-- Store authentication and access audit events used by the access-control UI.
CREATE TABLE IF NOT EXISTS `access_ip_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `action` VARCHAR(40) NOT NULL DEFAULT 'LOGIN',
  `user_agent` VARCHAR(500) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_access_ip_logs_created_at` (`created_at`),
  KEY `idx_access_ip_logs_user_created` (`user_id`, `created_at`),
  KEY `idx_access_ip_logs_ip` (`ip_address`),
  CONSTRAINT `fk_access_ip_logs_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
