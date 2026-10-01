CREATE TABLE booking_invoice_links (
  booking_id INT UNSIGNED NOT NULL,
  invoice_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (booking_id),
  UNIQUE KEY uq_booking_invoice (invoice_id),
  CONSTRAINT fk_booking_invoice_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_booking_invoice_invoice FOREIGN KEY (invoice_id) REFERENCES sale_invoices(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
