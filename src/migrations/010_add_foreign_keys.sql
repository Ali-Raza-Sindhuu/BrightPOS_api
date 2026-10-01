-- @optional
-- (scripts/migrate.js treats a failure here as a warning, not a deploy
-- blocker — see the NOTE below for why this file is optional.)
--
-- Migration: foreign key constraints for the tables created in
-- 001–009. Run this LAST, after every table above (and the pre-existing
-- customers/item_details/suppliers/purchases tables from Steps 1–2) exists.
--
-- NOTE: the original schema dump does NOT define most of these constraints
-- at the DB level — sale_invoices, sale_invoice_items, sale_returns,
-- sale_return_items, supplier_payments, purchase_returns, and
-- purchase_return_items currently have no FK constraints in the live
-- database; only customer_payments does. The application layer
-- (service files) already validates these relationships and blocks
-- deletes/edits accordingly, so the app works correctly without this file.
-- This migration is optional hardening to also enforce integrity at the
-- DB level. Skip it if you'd rather keep parity with the existing schema,
-- or run it against a copy first if the live data might already contain
-- orphaned rows (an orphan will make the ADD CONSTRAINT fail).

ALTER TABLE `sale_invoices`
  ADD CONSTRAINT `fk_sale_invoices_customer_id`
    FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `sale_invoice_items`
  ADD CONSTRAINT `fk_sale_invoice_items_invoice_id`
    FOREIGN KEY (`invoice_id`) REFERENCES `sale_invoices` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sale_invoice_items_item_id`
    FOREIGN KEY (`item_id`) REFERENCES `item_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- customer_payments constraints already exist in the source schema:
--   customer_payments_ibfk_1 (customer_id -> customers.id, ON DELETE CASCADE)
--   fk_customer_payments_invoice_id (invoice_id -> sale_invoices.id)
-- Included here as a no-op reference only — do not re-run if already present.

ALTER TABLE `sale_returns`
  ADD CONSTRAINT `fk_sale_returns_invoice_id`
    FOREIGN KEY (`sale_invoice_id`) REFERENCES `sale_invoices` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sale_returns_customer_id`
    FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `sale_return_items`
  ADD CONSTRAINT `fk_sale_return_items_return_id`
    FOREIGN KEY (`sale_return_id`) REFERENCES `sale_returns` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sale_return_items_item_id`
    FOREIGN KEY (`item_id`) REFERENCES `item_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `supplier_payments`
  ADD CONSTRAINT `fk_supplier_payments_supplier_id`
    FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_supplier_payments_purchase_id`
    FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `purchase_returns`
  ADD CONSTRAINT `fk_purchase_returns_purchase_id`
    FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_purchase_returns_supplier_id`
    FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `purchase_return_items`
  ADD CONSTRAINT `fk_purchase_return_items_return_id`
    FOREIGN KEY (`purchase_return_id`) REFERENCES `purchase_returns` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_purchase_return_items_item_id`
    FOREIGN KEY (`item_id`) REFERENCES `item_details` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
