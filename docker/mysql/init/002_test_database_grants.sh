#!/bin/bash
set -eu
# MYSQL_USER is supplied by Compose from the backend's .env.
escaped_user="${MYSQL_USER//\'/\'\'}"
MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket -uroot <<SQL
GRANT ALL PRIVILEGES ON brightpos_migration_test.* TO '${escaped_user}'@'%';
GRANT ALL PRIVILEGES ON brightpos_migration_failure.* TO '${escaped_user}'@'%';
GRANT ALL PRIVILEGES ON brightpos_migration_history.* TO '${escaped_user}'@'%';
SQL
