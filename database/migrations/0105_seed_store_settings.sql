-- Database phase: additive upgrade; preserve applied migrations and existing data.
INSERT INTO store_settings (store_id, enabled_payment_methods, notification_preferences) VALUES (1, JSON_ARRAY('cash','card','bank_transfer','wallet'), JSON_OBJECT('in_app', true));

