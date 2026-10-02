-- Read-only manual review in DBeaver, using brightposlocal.
SELECT DATABASE() AS current_database;
SELECT COUNT(*) AS applied_migrations FROM _schema_migrations WHERE state = 'applied';
SELECT version, filename, state FROM _schema_migrations ORDER BY version DESC LIMIT 5;
SELECT COUNT(*) AS application_tables FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME <> '_schema_migrations';
SELECT id, name, code, purpose, currency, timezone FROM stores;
SELECT * FROM store_settings;
SELECT id, item_name, store_id, product_id, sku, sale_price FROM item_details ORDER BY id LIMIT 20;
SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE();
SELECT COUNT(*) AS demo_sessions FROM demo_sessions;
