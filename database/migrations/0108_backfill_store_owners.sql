-- Database phase: additive upgrade; preserve applied migrations and existing data.
INSERT INTO store_staff (store_id, user_id, role) SELECT store_id, id, 'owner' FROM users WHERE role = 'admin';

