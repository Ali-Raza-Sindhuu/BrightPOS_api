-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE refund_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  quantity DECIMAL(18,6) NOT NULL,
  credit_minor BIGINT UNSIGNED NOT NULL,
  disposition ENUM('restock','write_off') NOT NULL,
  refund_id BIGINT UNSIGNED NOT NULL,
  invoice_line_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refund_lines_store_row (store_id, id),
  CONSTRAINT chk_refund_quantity CHECK (quantity > 0),
  CONSTRAINT fk_refund_lines_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_refund_lines_refund_id FOREIGN KEY (store_id, refund_id) REFERENCES refund_notes(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_refund_lines_invoice_line_id FOREIGN KEY (store_id, invoice_line_id) REFERENCES sale_invoice_items(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_refund_lines_item_id FOREIGN KEY (store_id, item_id) REFERENCES item_details(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

