CREATE TABLE auth_login_limits (
  bucket_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  window_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (bucket_key),
  KEY idx_login_limit_window (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
