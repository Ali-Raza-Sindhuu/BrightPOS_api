CREATE TABLE `marketing_submissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `kind` enum('contact','demo','trial','newsletter') NOT NULL,
  `name` varchar(150) DEFAULT NULL,
  `email` varchar(254) NOT NULL,
  `business_name` varchar(150) DEFAULT NULL,
  `plan` varchar(50) DEFAULT NULL,
  `message` text DEFAULT NULL,
  `newsletter_key` varchar(254) DEFAULT NULL,
  `status` enum('new','contacted','closed') NOT NULL DEFAULT 'new',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_marketing_newsletter` (`newsletter_key`),
  KEY `idx_marketing_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
