-- Database phase: additive upgrade; preserve applied migrations and existing data.
CREATE TABLE bakery_order_details (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL DEFAULT 1,
  size VARCHAR(80) NULL,
  flavour VARCHAR(100) NULL,
  cake_message VARCHAR(255) NULL,
  instructions TEXT NULL,
  pickup_at DATETIME NOT NULL,
  preparation_status ENUM('ordered','preparing','ready','collected','cancelled') NOT NULL DEFAULT 'ordered',
  handed_over_at DATETIME NULL,
  booking_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bakery_order_details_store_row (store_id, id),
  UNIQUE KEY uq_bakery_booking (store_id, booking_id),
  KEY idx_bakery_pickup (store_id, pickup_at, preparation_status),
  CONSTRAINT fk_bakery_order_details_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_bakery_order_details_booking_id FOREIGN KEY (store_id, booking_id) REFERENCES bookings(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

