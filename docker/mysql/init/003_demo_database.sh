#!/bin/bash
set -eu
# Only the dedicated disposable demo schema; never drop/reset business data.
escaped_user="${MYSQL_USER//\'/\'\'}"
MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket -uroot <<SQL
CREATE DATABASE IF NOT EXISTS brightpos_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON brightpos_demo.* TO '${escaped_user}'@'%';
SQL
