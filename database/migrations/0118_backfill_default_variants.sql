-- Database phase: additive upgrade; preserve applied migrations and existing data.
UPDATE item_details SET product_id = id, sku = CONCAT('LEGACY-', id), variant_options = JSON_OBJECT(), updated_at = updated_at WHERE product_id IS NULL;
