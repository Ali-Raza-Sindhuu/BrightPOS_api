-- 0010_create_access_control_settings.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `access_control_settings` (
  id TINYINT UNSIGNED NOT NULL,
  enforce_2fa TINYINT NOT NULL DEFAULT 0,
  lock_after_failed_attempts TINYINT NOT NULL DEFAULT 0,
  session_ip_binding TINYINT NOT NULL DEFAULT 0,
  log_permission_changes TINYINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_access_settings_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
