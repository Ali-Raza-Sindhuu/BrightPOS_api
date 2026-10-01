ALTER TABLE stock_transfers
  ADD CONSTRAINT fk_stock_transfers_from_unit
    FOREIGN KEY (from_unit_id) REFERENCES business_units(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_stock_transfers_to_unit
    FOREIGN KEY (to_unit_id) REFERENCES business_units(id) ON DELETE RESTRICT;

ALTER TABLE stock_transfer_items
  ADD CONSTRAINT fk_stock_transfer_items_transfer
    FOREIGN KEY (transfer_id) REFERENCES stock_transfers(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_stock_transfer_items_item
    FOREIGN KEY (item_id) REFERENCES item_details(id) ON DELETE RESTRICT;
