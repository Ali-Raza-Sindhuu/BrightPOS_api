const test=require('node:test');const assert=require('node:assert/strict');
const exact=require('../../src/utils/exact');
const catalog=require('../../src/modules/counter/catalog.service');
test('exact totals and proportional discounts preserve minor units',()=>{assert.equal(exact.multiply(101,'1.50'),152);assert.deepEqual(exact.allocate(101,[100,100,100]),[33,34,34]);assert.equal(exact.decimal(exact.scaled('0.01')),'0.01');assert.throws(()=>exact.integer(0.1));assert.throws(()=>exact.scaled('1.001'));assert.throws(()=>exact.integer('1000000000000'));});
test('CSV quoting, multiline fields and formula escaping are handled',()=>{assert.deepEqual(catalog.parseCsv('a,b\r\n"x,y","one\ntwo"\r\n'),[['a','b'],['x,y','one\ntwo']]);assert.throws(()=>catalog.parseCsv('a\n"broken'));assert.equal(catalog.cell('=formula'),'"\'=formula"');});
test('compatible bakery conversion and local business-day boundaries',()=>{assert.equal(require('../../src/modules/counter/stock-bakery.service').conversion('kg','g'),'1000.000000000');assert.throws(()=>require('../../src/modules/counter/stock-bakery.service').conversion('g','ml'));assert.equal(require('../../src/modules/counter/reports.service').dateBoundary('2026-10-02','Asia/Karachi').toISOString(),'2026-10-01T19:00:00.000Z');});
test('demo input schemas protect assigned registers and reject malformed public starts',()=>{
  const api=require('../../src/modules/counter/api-contract');
  api.validate(api.bodySchema('/demo','post','/checkouts'),{});
  assert.throws(()=>api.validate(api.bodySchema('/demo','post','/checkouts'),{register_id:99}));
  assert.throws(()=>api.validate(api.bodySchema('/demo','post','/start'),{scenario:'invalid'}));
  assert.throws(()=>api.validate(api.bodySchema('/demo','post','/start'),null));
});
test('legacy audit failure rolls back the business write before commit',async()=>{
  const events=[],storage=require('../../src/utils/request-context');
  const conn={beginTransaction:async()=>events.push('begin'),query:async sql=>{if(sql.startsWith('INSERT INTO audit_events'))throw new Error('audit unavailable');events.push('write');return [{insertId:1}];},commit:async()=>events.push('commit'),rollback:async()=>events.push('rollback'),release:()=>events.push('release')};
  const pool=require('../../src/config/audited-pool')({getConnection:async()=>conn,query:async()=>{throw new Error('untracked write');}});
  await assert.rejects(storage.run({user:{id:1,storeId:1},request:{method:'POST',originalUrl:'/api/customers',body:{customer_name:'Example'},params:{},id:'review'}},()=>pool.query('INSERT INTO customers (customer_name) VALUES (?)',['Example'])),/audit unavailable/);
  assert.deepEqual(events,['begin','write','rollback','release']);
});
