const { splitSql, loadMigrations, getHistory, validateHistory } = require('./migrations');

const normalizeType = value => value.toLowerCase().replace(/\b((?:tiny|small|medium|big)?int)\(\d+\)/g, '$1').replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').trim();
const identifiers = value => value.split(',').map(part => part.trim().replace(/`/g, ''));
const expression = value => value.toLowerCase().replace(/\\'/g, "'").replace(/_utf8mb4(?=')/g, '').replace(/[\s`()]/g, '');
function normalizeDefault(value) {
  if (value == null || /^null$/i.test(value)) return null;
  return /^current_timestamp(?:\(\))?$/i.test(value) ? 'CURRENT_TIMESTAMP' : String(value).replace(/^'(.*)'$/s, '$1');
}

function contractMigrations(migrations) {
  const definitions = new Map();
  for (const migration of migrations) {
    const create = /^CREATE TABLE\s+`?(\w+)`?\s*\(([\s\S]*)\)\s*ENGINE=/i.exec(migration.sql);
    if (create) {
      if (definitions.has(create[1])) throw new Error(`Repeated table definition: ${create[1]}`);
      definitions.set(create[1], { filename: migration.filename, parts: splitSql(create[2], ',') });
      continue;
    }
    const alter = /^ALTER TABLE\s+`?(\w+)`?\s+([\s\S]+)$/i.exec(migration.sql);
    if (!alter) continue;
    const table = definitions.get(alter[1]);
    if (!table) throw new Error(`ALTER references unknown table in ${migration.filename}`);
    for (const clause of splitSql(alter[2], ',')) {
      const add = /^ADD\s+(?:COLUMN\s+)?([\s\S]+)$/i.exec(clause);
      const modify = /^MODIFY\s+(?:COLUMN\s+)?`?(\w+)`?\s+([\s\S]+)$/i.exec(clause);
      const drop = /^DROP\s+(COLUMN|INDEX|KEY|FOREIGN KEY|CHECK)\s+`?(\w+)`?$/i.exec(clause);
      if (add) table.parts.push(add[1]);
      else if (modify || drop) {
        const name = (modify || drop)[modify ? 1 : 2];
        const index = table.parts.findIndex(part => {
          if (modify || drop[1].toUpperCase() === 'COLUMN') return new RegExp(`^\x60?${name}\x60?\\s`, 'i').test(part);
          return new RegExp(`^(?:(?:UNIQUE\\s+)?(?:KEY|INDEX)|CONSTRAINT)\\s+\x60?${name}\x60?\\s`, 'i').test(part);
        });
        if (index < 0) throw new Error(`Unknown ALTER target ${name} in ${migration.filename}`);
        if (modify) table.parts[index] = `${name} ${modify[2]}`;
        else table.parts.splice(index, 1);
      } else throw new Error(`Unsupported ALTER clause in ${migration.filename}: ${clause}`);
    }
  }
  return [...definitions].map(([name, table]) => ({ filename: table.filename, sql: `CREATE TABLE ${name} (${table.parts.join(', ')}) ENGINE=InnoDB` }));
}

// Read the CREATE/ALTER definitions as the schema contract so there is no second,
// hand-maintained list of expected columns that can fall out of date.
function schemaContract(migrations = loadMigrations()) {
  const tables = [];
  for (const migration of contractMigrations(migrations)) {
    const match = /^CREATE TABLE\s+`?(\w+)`?\s*\(([\s\S]*)\)\s*ENGINE=/i.exec(migration.sql);
    if (!match) continue;
    const table = { name: match[1], columns: [], indexes: [], foreignKeys: [], checks: [] };
    for (const definition of splitSql(match[2], ',')) {
      const fk = /^CONSTRAINT\s+`?(\w+)`?\s+FOREIGN KEY\s*\(([^)]+)\)\s+REFERENCES\s+`?(\w+)`?\s*\(([^)]+)\)\s+ON DELETE\s+(CASCADE|RESTRICT|SET NULL|NO ACTION)(?:\s+ON UPDATE\s+(CASCADE|RESTRICT|SET NULL|NO ACTION))?/i.exec(definition);
      if (fk) {
        table.foreignKeys.push({ name: fk[1], columns: identifiers(fk[2]), parent: fk[3], parentColumns: identifiers(fk[4]), onDelete: fk[5].toUpperCase(), onUpdate: (fk[6] || 'NO ACTION').toUpperCase() });
        continue;
      }
      const check = /^CONSTRAINT\s+`?(\w+)`?\s+CHECK\s*\((.*)\)$/is.exec(definition);
      if (check) { table.checks.push({ name: check[1], clause: expression(check[2]) }); continue; }
      const index = /^(PRIMARY KEY|UNIQUE KEY|KEY|INDEX)\s*(?:`?(\w+)`?\s*)?\(([^)]+)\)$/i.exec(definition);
      if (index) {
        table.indexes.push({ name: index[1].toUpperCase() === 'PRIMARY KEY' ? 'PRIMARY' : index[2], unique: /^(PRIMARY|UNIQUE)/i.test(index[1]), columns: identifiers(index[3]) });
        continue;
      }
      const column = /^`?(\w+)`?\s+([\s\S]+)$/.exec(definition);
      const type = column?.[2].match(/^(\w+(?:\((?:[^'()]|'(?:\\.|''|[^'])*')*\))?(?:\s+UNSIGNED)?)/i);
      if (!column || !type || /^(CONSTRAINT|FOREIGN|UNIQUE|KEY|PRIMARY)$/i.test(column[1])) throw new Error(`Unsupported schema definition in ${migration.filename}: ${definition}`);
      const defaultValue = column[2].match(/\bDEFAULT\s+('(?:[^']|'')*'|CURRENT_TIMESTAMP(?:\(\))?|NULL|-?\d+(?:\.\d+)?)/i);
      const primary = /\bPRIMARY KEY\b/i.test(column[2]);
      table.columns.push({ name: column[1], type: normalizeType(type[1]), nullable: !/\bNOT NULL\b/i.test(column[2]) && !primary, default: normalizeDefault(defaultValue?.[1]), autoIncrement: /\bAUTO_INCREMENT\b/i.test(column[2]), onUpdate: /ON UPDATE CURRENT_TIMESTAMP/i.test(column[2]) });
      if (primary) table.indexes.push({ name: 'PRIMARY', unique: true, columns: [column[1]] });
      if (/\bUNIQUE\b/i.test(column[2])) table.indexes.push({ name: column[1], unique: true, columns: [column[1]] });
    }
    tables.push(table);
  }
  return tables;
}

async function validateSchema(conn, migrations = loadMigrations()) {
  const history = await getHistory(conn);
  validateHistory(migrations, history.rows);
  if (history.rows.length !== migrations.length) throw new Error(`Schema incomplete: ${migrations.length - history.rows.length} pending migrations`);
  const contract = schemaContract(migrations);
  const [tables] = await conn.query('SELECT TABLE_NAME, ENGINE, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
  const [columns] = await conn.query('SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()');
  const [indexes] = await conn.query('SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX');
  const [foreignKeys] = await conn.query(`SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, r.DELETE_RULE, r.UPDATE_RULE
    FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r
      ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME
    WHERE k.CONSTRAINT_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY k.ORDINAL_POSITION`);
  const [checks] = await conn.query(`SELECT t.TABLE_NAME, t.CONSTRAINT_NAME, t.ENFORCED, c.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS t
    JOIN information_schema.CHECK_CONSTRAINTS c ON c.CONSTRAINT_SCHEMA = t.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME = t.CONSTRAINT_NAME
    WHERE t.CONSTRAINT_SCHEMA = DATABASE() AND t.CONSTRAINT_TYPE = 'CHECK'`);
  const errors = [];
  const expectedTriggers = migrations.map(migration => /^CREATE TRIGGER\s+(\w+)\s+(BEFORE|AFTER)\s+(UPDATE|DELETE|INSERT)\s+ON\s+(\w+)\s+FOR EACH ROW\s+([\s\S]+)$/i.exec(migration.sql)).filter(Boolean);
  const [triggers] = await conn.query('SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_TIMING, ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()');
  for (const trigger of expectedTriggers) {
    const actual = triggers.find(value => value.TRIGGER_NAME === trigger[1]);
    if (!actual || actual.ACTION_TIMING !== trigger[2].toUpperCase() || actual.EVENT_MANIPULATION !== trigger[3].toUpperCase() || actual.EVENT_OBJECT_TABLE !== trigger[4] || expression(actual.ACTION_STATEMENT) !== expression(trigger[5])) errors.push(`Missing/changed trigger ${trigger[1]}`);
  }
  for (const trigger of triggers) if (!expectedTriggers.some(value => value[1] === trigger.TRIGGER_NAME)) errors.push(`Untracked trigger ${trigger.TRIGGER_NAME}`);
  for (const expected of contract) {
    const actual = tables.find(table => table.TABLE_NAME === expected.name);
    if (!actual) { errors.push(`Missing table ${expected.name}`); continue; }
    if (actual.ENGINE !== 'InnoDB' || actual.TABLE_COLLATION !== 'utf8mb4_unicode_ci') errors.push(`${expected.name}: engine/collation mismatch`);
    const actualColumns = columns.filter(column => column.TABLE_NAME === expected.name);
    if (actualColumns.length !== expected.columns.length) errors.push(`${expected.name}: column count differs (${actualColumns.length}/${expected.columns.length})`);
    for (const column of expected.columns) {
      const value = actualColumns.find(actualColumn => actualColumn.COLUMN_NAME === column.name);
      if (!value) { errors.push(`Missing column ${expected.name}.${column.name}`); continue; }
      if (normalizeType(value.COLUMN_TYPE) !== column.type || (value.IS_NULLABLE === 'YES') !== column.nullable || normalizeDefault(value.COLUMN_DEFAULT) !== column.default || value.EXTRA.includes('auto_increment') !== column.autoIncrement || /on update CURRENT_TIMESTAMP/i.test(value.EXTRA) !== column.onUpdate) errors.push(`${expected.name}.${column.name}: type/nullability/default/extra mismatch`);
    }
    for (const index of expected.indexes) {
      const values = indexes.filter(value => value.TABLE_NAME === expected.name && value.INDEX_NAME === index.name);
      if (values.map(value => value.COLUMN_NAME).join(',') !== index.columns.join(',') || !values.length || (Number(values[0].NON_UNIQUE) === 0) !== index.unique) errors.push(`${expected.name}: missing/changed index ${index.name}`);
    }
    for (const key of expected.foreignKeys) {
      const values = foreignKeys.filter(value => value.TABLE_NAME === expected.name && value.CONSTRAINT_NAME === key.name);
      if (values.map(value => value.COLUMN_NAME).join(',') !== key.columns.join(',') || values.map(value => value.REFERENCED_COLUMN_NAME).join(',') !== key.parentColumns.join(',') || !values.length || values[0].REFERENCED_TABLE_NAME !== key.parent || values[0].DELETE_RULE !== key.onDelete || values[0].UPDATE_RULE !== key.onUpdate) errors.push(`${expected.name}: missing/changed foreign key ${key.name}`);
    }
    for (const check of expected.checks) {
      const actualCheck = checks.find(value => value.TABLE_NAME === expected.name && value.CONSTRAINT_NAME === check.name);
      if (!actualCheck || actualCheck.ENFORCED !== 'YES' || expression(actualCheck.CHECK_CLAUSE) !== check.clause) errors.push(`${expected.name}: missing/changed CHECK ${check.name}`);
    }
  }
  const expectedNames = new Set([...contract.map(table => table.name), '_schema_migrations']);
  for (const table of tables) if (!expectedNames.has(table.TABLE_NAME)) errors.push(`Untracked table ${table.TABLE_NAME}`);
  if (errors.length) throw new Error(`Schema validation failed:\n${errors.map(error => `  - ${error}`).join('\n')}`);
  const [[settings]] = await conn.query('SELECT COUNT(*) AS n FROM access_control_settings WHERE id = 1');
  const [[sequence]] = await conn.query("SELECT COUNT(*) AS n FROM sequence_counters WHERE name = 'expense_voucher' AND next_value >= 1");
  if (Number(settings.n) !== 1 || Number(sequence.n) !== 1) throw new Error('Required settings/sequence bootstrap rows are missing');
  if (contract.some(table => table.name === 'store_settings')) {
    const [[bootstrap]] = await conn.query("SELECT COUNT(*) AS n FROM stores s JOIN store_settings c ON c.store_id=s.id WHERE s.id=1 AND s.purpose='business'");
    if (Number(bootstrap.n) !== 1) throw new Error('Required default business/store settings are missing');
  }
  return { migrations: migrations.length, tables: contract.length, columns: columns.filter(column => column.TABLE_NAME !== '_schema_migrations').length, foreignKeys: contract.reduce((sum, table) => sum + table.foreignKeys.length, 0), checks: contract.reduce((sum, table) => sum + table.checks.length, 0) };
}

module.exports = { schemaContract, validateSchema, normalizeType, normalizeDefault, contractMigrations };
