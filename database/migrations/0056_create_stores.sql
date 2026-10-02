-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE stores (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(40) NOT NULL,
  purpose ENUM('business','demo') NOT NULL DEFAULT 'business',
  currency CHAR(3) NOT NULL DEFAULT 'PKR',
  timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Karachi',
  is_active TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stores_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

