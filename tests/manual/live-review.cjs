// Local backend smoke review. Creates only isolated visitor/demo data.
require('../../src/config/load-environment');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const pool=require('../../src/config/db');
const api='http://127.0.0.1:5000/api';
async function request(path,method='GET',body,token) {
  const response=await fetch(api+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,body:await response.json()};
}
async function snapshot() {
  const values={};for(const table of ['item_details','inventory','sale_invoices','customer_payments','bookings','booking_payments'])values[table]=(await pool.query(`SELECT * FROM ${table} WHERE store_id=1 ORDER BY id`))[0];
  return crypto.createHash('sha256').update(JSON.stringify(values)).digest('hex');
}
(async()=>{
  try {
    const before=await snapshot();assert.equal((await request('/health')).status,200);
    const review=require('node:fs').readFileSync(require('node:path').join(__dirname,'../../database/review/backend-phase.sql'),'utf8').replace(/^--.*$/gm,'');
    for(const sql of review.split(';').filter(sql=>sql.trim()))await pool.query(sql);
    assert.equal((await request('/demo/start','POST',{scenario:'invalid'})).status,422);
    assert.equal((await request('/auth/login','POST',{})).status,400);
    const contract=await request('/openapi.json');assert.equal(contract.body.openapi,'3.1.0');
    assert.equal((await request('/counter/checkouts')).status,401);
    let businessLogin='not checked: ADMIN_PASSWORD unavailable';
    if(process.env.ADMIN_PASSWORD) {
      const login=await request('/auth/login','POST',{identifier:process.env.ADMIN_USERNAME || 'admin',password:process.env.ADMIN_PASSWORD});assert.equal(login.status,200,'Existing local owner login');
      const me=await request('/counter/me','GET',null,login.body.data.token);assert.equal(me.status,200);assert.equal(me.body.data.operational_role,'owner');
      for(const path of ['/counter/settings','/counter/registers','/counter/stock/reconcile','/counter/audit'])assert.equal((await request(path,'GET',null,login.body.data.token)).status,200,path);
      businessLogin='existing owner login and scoped reads passed';
    }
    const retail=await request('/demo/start','POST',{scenario:'retail'}),bakery=await request('/demo/start','POST',{scenario:'bakery'});assert.equal(retail.status,201);assert.equal(bakery.status,201);
    const a=retail.body.data,b=bakery.body.data;assert.notEqual(a.store_id,b.store_id);assert.ok(b.booking_id);
    assert.equal((await request('/demo/catalog','GET',null,a.token)).body.data.rows.length,3);
    const bakeryCheckouts=await request('/demo/checkouts','GET',null,b.token);
    assert.equal((await request(`/demo/checkouts/${bakeryCheckouts.body.data.rows[0].id}`,'GET',null,a.token)).status,404);
    assert.equal((await request('/counter/me','GET',null,a.token)).status,401);
    const restarted=await request('/demo/restart','POST',{},a.token);assert.equal(restarted.status,200);
    assert.equal((await request('/demo/session','GET',null,a.token)).status,401);assert.equal((await request('/demo/session','GET',null,b.token)).status,200);
    assert.equal(await snapshot(),before,'Business catalog, balances, invoices and deposits preserved');
    console.log(JSON.stringify({health:'passed',contract_paths:Object.keys(contract.body.paths).length,business_login:businessLogin,demo:'retail/bakery, isolation, restart and business-data preservation passed',frontend:'not started'}));
  }finally{await pool.end();}
})().catch(error=>{console.error('[live-review]',error.message);process.exitCode=1;});
