const assert = require('node:assert/strict');

function configureLocalDatabase() {
  require('../../src/config/load-environment');
  const { getDatabaseOptions } = require('../../src/config/database');
  const options = getDatabaseOptions();
  assert.ok(['127.0.0.1', 'localhost'].includes(options.host) && !options.ssl,
    'Integration tests require the local Docker connection; remote targets are refused');
  process.env.NODE_ENV = 'test';
  process.env.DB_NAME = 'brightpos_migration_test';
}

async function clearFixture(connection) {
  const [[{database}]]=await connection.query('SELECT DATABASE() AS `database`');
  assert.ok(['brightpos_migration_test','brightpos_migration_failure','brightpos_migration_history'].includes(database),'Refusing cleanup outside whitelisted local fixture');
  const [tables]=await connection.query('SHOW TABLES');const remaining=new Set(tables.map(row=>Object.values(row)[0]));
  const [keys]=await connection.query('SELECT TABLE_NAME,REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL');
  while(remaining.size){const leaves=[...remaining].filter(name=>!keys.some(key=>key.REFERENCED_TABLE_NAME===name&&remaining.has(key.TABLE_NAME)));assert.ok(leaves.length,'Circular dependency');for(const name of leaves){assert.match(name,/^\w+$/);await connection.query(`DROP TABLE \`${name}\``);remaining.delete(name);}}
}
module.exports = { configureLocalDatabase, clearFixture };
