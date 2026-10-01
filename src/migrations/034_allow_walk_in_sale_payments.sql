-- Walk-in invoices have no customer account. Keep their payment linked to the
-- invoice while allowing customer_id to be NULL.
ALTER TABLE `customer_payments`
  MODIFY `customer_id` int(10) UNSIGNED NULL;
