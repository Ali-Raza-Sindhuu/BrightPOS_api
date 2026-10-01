-- 0049_create_sequence_counters.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `sequence_counters` (
  name VARCHAR(50) NOT NULL,
  next_value INT UNSIGNED NOT NULL,
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
