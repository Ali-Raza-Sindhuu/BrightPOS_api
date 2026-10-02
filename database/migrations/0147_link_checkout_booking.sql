-- Scoped backend booking conversion: only one checkout per booking.
ALTER TABLE checkout_sessions
  ADD COLUMN booking_id INT UNSIGNED NULL,
  ADD UNIQUE KEY uq_checkout_booking (store_id, booking_id),
  ADD CONSTRAINT fk_checkout_booking FOREIGN KEY (store_id, booking_id) REFERENCES bookings(store_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
