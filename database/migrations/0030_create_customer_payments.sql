-- 0030_create_customer_payments.sql
-- Ordered fresh-install baseline. Do not edit after applying.
CREATE TABLE `customer_payments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `invoice_id` INT UNSIGNED DEFAULT NULL,
  `customer_id` INT UNSIGNED DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_date` datetime NOT NULL,
  `payment_method` enum('Cash','Card','Bank Transfer','Cheque','Online') NOT NULL DEFAULT 'Cash',
  `remarks` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_customer_payments_customer_id` (`customer_id`),
  KEY `idx_customer_payments_invoice_id` (`invoice_id`),
  CONSTRAINT fk_customer_payments_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_customer_payments_invoice_id FOREIGN KEY (invoice_id) REFERENCES sale_invoices(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
