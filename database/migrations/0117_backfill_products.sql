-- Database phase: additive upgrade; preserve applied migrations and existing data.
INSERT INTO products (id, store_id, name, category_id, is_active) SELECT id, store_id, item_name, item_category_id, is_enable FROM item_details;

