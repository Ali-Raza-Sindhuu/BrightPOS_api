-- Migration: 02_sub_categories.sql
-- Table: sub_categories
-- Used by modules/subCategories
-- Depends on: categories (01)

CREATE TABLE `sub_categories` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_id` int(10) UNSIGNED NOT NULL COMMENT 'FK -> categories.id',
  `sub_category_name` varchar(100) NOT NULL,
  `is_enable` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_sub_categories_category_id` (`category_id`),
  KEY `idx_sub_categories_is_enable` (`is_enable`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Sub-categories belonging to a parent category';

-- Application-level FK (category_id -> categories.id) is enforced in
-- modules/subCategories/services/subCategory.service.js. No DB-level FK
-- constraint exists in the original schema for this table, so none is added
-- here to stay consistent with the source dump.
