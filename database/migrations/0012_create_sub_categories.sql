-- 0012_create_sub_categories.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `sub_categories` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_id` INT UNSIGNED NOT NULL ,
  `sub_category_name` varchar(100) NOT NULL,
  `is_enable` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_sub_categories_category_id` (`category_id`),
  KEY `idx_sub_categories_is_enable` (`is_enable`),
  CONSTRAINT fk_sub_categories_category_id FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
