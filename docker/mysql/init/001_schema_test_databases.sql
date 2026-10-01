-- Disposable integration-test databases. Never copy this file to Aiven.
CREATE DATABASE brightpos_migration_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE brightpos_migration_failure CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE brightpos_migration_history CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON brightpos_migration_test.* TO 'brightpos'@'%';
GRANT ALL PRIVILEGES ON brightpos_migration_failure.* TO 'brightpos'@'%';
GRANT ALL PRIVILEGES ON brightpos_migration_history.* TO 'brightpos'@'%';
