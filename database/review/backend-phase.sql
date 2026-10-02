-- Read-only main-business review in DBeaver; select brightposlocal first.
SELECT DATABASE() AS current_database;
SELECT COUNT(*) AS applied_migrations FROM _schema_migrations WHERE state='applied';
SELECT id,code,name,purpose,currency,timezone FROM stores ORDER BY id;
SELECT store_id,revision,return_window_days,cashier_discount_percent,
       manager_discount_percent,session_timeout_minutes,enabled_payment_methods
FROM store_settings ORDER BY store_id;
SELECT s.user_id,u.username,s.role,s.is_active
FROM store_staff s JOIN users u ON u.id=s.user_id AND u.store_id=s.store_id
ORDER BY s.store_id,s.user_id;
SELECT id,store_id,name,code,business_unit_id,is_active FROM registers;
SELECT id,register_id,opened_by,status,opening_float_minor,expected_close_minor,
       closing_count_minor,variance_minor FROM register_shifts;
SELECT action,COUNT(*) AS events FROM audit_events GROUP BY action ORDER BY action;
SELECT status,COUNT(*) AS requests FROM idempotency_requests GROUP BY status;
SELECT status,COUNT(*) AS transactions FROM offline_transactions GROUP BY status;
SELECT COUNT(*) AS main_demo_sessions_expected_zero FROM demo_sessions;
-- Run separately after choosing brightpos_demo in DBeaver:
-- SELECT id,store_id,scenario,status,expires_at FROM demo_sessions;
-- SELECT id,code,purpose FROM stores ORDER BY id;
