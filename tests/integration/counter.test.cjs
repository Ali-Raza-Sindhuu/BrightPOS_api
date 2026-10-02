const test=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');
const helper=require('../helpers/local-database.cjs');helper.configureLocalDatabase();
const pool=require('../../src/config/db');
const C=require('../../src/modules/counter/counter-core');
const M=require('../../src/modules/counter/management.service');
const checkout=require('../../src/modules/counter/checkout.service');
const bakery=require('../../src/modules/counter/stock-bakery.service');
const catalog=require('../../src/modules/counter/catalog.service');
const refunds=require('../../src/modules/counter/refund.service');
const offline=require('../../src/modules/counter/offline.service');
let owner,cashier,manager,register,shift,provider,item,ingredient,output,server;
const key=()=>crypto.randomUUID();
const reject=(promise,status)=>assert.rejects(promise,e=>e.statusCode===status);
async function balance(itemId){return (await pool.query('SELECT quantity FROM inventory WHERE store_id=1 AND item_id=? AND business_unit_id=1',[itemId]))[0][0]?.quantity;}
test.before(async()=>{
  const conn=await pool.getConnection();try{await helper.clearFixture(conn);await require('../../scripts/lib/migrations').runMigrations(conn,require('../../scripts/lib/migrations').loadMigrations(),{log:()=>{}});}finally{conn.release();}
  const password=await require('bcryptjs').hash('test-password-123',10);
  for(const [name,role] of [['owner','admin'],['cashier','user'],['manager','user']])await C.insert(pool,'users',{full_name:name,username:name,password_hash:password,role});
  owner={pool,id:1,storeId:1,role:'owner'};cashier={pool,id:2,storeId:1,role:'cashier'};manager={pool,id:3,storeId:1,role:'manager'};
  await M.assignStaff(owner,{user_id:1,role:'owner',pin:'1234'},key());await M.assignStaff(owner,{user_id:2,role:'cashier',pin:'5678'},key());await M.assignStaff(owner,{user_id:3,role:'manager'},key());
  await C.insert(pool,'item_units',{unit_name:'piece'});await C.insert(pool,'item_units',{unit_name:'gram'});
  await C.insert(pool,'customers',{customer_name:'Fixture counter customer'});
  register=await M.register(owner,{name:'Counter',code:'COUNTER',business_unit_id:1},key());
  shift=await M.openShift(cashier,{register_id:register.id,opening_float_minor:10000},key());
  provider=await C.insert(pool,'payment_providers',{code:'TEST_CARD',method:'card',mode:'sandbox',is_enabled:1});
  item=await catalog.variant(owner,{item_name:'Retail product',sku:'RETAIL-1',barcode:'BARCODE-1',unit_id:1,base_unit_code:'piece',sale_price:'10.00',purchase_price:'4.00'},key());
  ingredient=await catalog.variant(owner,{item_name:'Flour',sku:'FLOUR',barcode:'FLOUR',unit_id:2,base_unit_code:'g',sale_price:'0.10',purchase_price:'0.05',kind:'ingredient'},key());
  output=await catalog.variant(owner,{item_name:'Bread',sku:'BREAD',barcode:'BREAD',unit_id:1,base_unit_code:'piece',sale_price:'20.00',purchase_price:'5.00',kind:'bakery'},key());
  await bakery.adjustment(owner,{business_unit_id:1,reason:'received',notes:'Fixture initial stock',lines:[{item_id:item.id,quantity_delta:'20'},{item_id:ingredient.id,quantity_delta:'5000'}]},key());
});
test.after(async()=>{if(server)await new Promise(r=>server.close(r));await pool.end();});
async function cart(qty='1',actor=cashier){const cart=await checkout.create(actor,{register_id:register.id,customer_id:1},key());return checkout.patch(actor,cart.id,{revision:1,customer_id:1,lines:[{item_id:item.id,quantity:qty}]},key());}
test('settings enforce owner role, revision checks, audit and exact limits',async()=>{
  const current=await M.getSettings(owner);await reject(M.updateSettings(cashier,{revision:1},key()),403);
  await M.updateSettings(owner,{revision:Number(current.settings.revision),return_window_days:14},key());await reject(M.updateSettings(owner,{revision:1},key()),409);
});
test('cashier PIN lockout persists and PIN switching issues revocable credentials',async()=>{
  const switched=await M.switchPin(cashier,{user_id:2,pin:'5678'});assert.ok(switched.token);
  for(let i=0;i<5;i++)await reject(M.switchPin(cashier,{user_id:2,pin:'0000'}),401);
  await reject(M.switchPin(cashier,{user_id:2,pin:'5678'}),401);
  await M.assignStaff(owner,{user_id:2,role:'cashier',pin:'5678'},key());
});
test('held carts survive retrieval; discounts require single-use payload-bound approval',async()=>{
  const draft=await cart();const held=await checkout.transition(cashier,draft.id,{status:'held',held_name:'Waiting shopper'},key());assert.equal((await checkout.get(cashier,draft.id)).held_name,'Waiting shopper');
  await checkout.transition(cashier,draft.id,{status:'draft'},key());
  const current=await checkout.get(cashier,draft.id);const payload={revision:Number(current.revision),lines:[{item_id:item.id,quantity:'1'}],discount_minor:100};
  await reject(checkout.patch(cashier,draft.id,payload,key()),403);
  const approval=await M.approve(manager,{requested_by:2,action:'checkout.discount',entity_id:draft.id,payload,limit_minor:100},key());
  const updated=await checkout.patch(cashier,draft.id,{...payload,approval_token:approval.approval_token},key());assert.equal(Number(updated.total_minor),900);
  await reject(checkout.patch(cashier,draft.id,{...payload,revision:Number(updated.revision),approval_token:approval.approval_token},key()),403);
  const [[event]]=await pool.query("SELECT id FROM audit_events LIMIT 1");await assert.rejects(pool.query('UPDATE audit_events SET reason=? WHERE id=?',['mutated',event.id]),/append-only/);
});
let completed;
test('split payment failure/retry and completion are exactly once with cash change and stock',async()=>{
  const draft=await cart('2');const before=await balance(item.id);
  await checkout.payment(cashier,draft.id,{method:'card',provider_id:provider,amount_minor:500,scenario:'fail'},key());
  const pending=await checkout.payment(cashier,draft.id,{method:'card',provider_id:provider,amount_minor:500,scenario:'pending'},key());
  await reject(checkout.complete(cashier,draft.id,{},key()),409);
  await checkout.confirm(cashier,pending.id,{outcome:'captured'},key());
  const paymentKey=key();const cash=await checkout.payment(cashier,draft.id,{method:'cash',amount_minor:1500,tendered_minor:2000},paymentKey);assert.equal(Number(cash.change_minor),500);
  assert.equal((await checkout.payment(cashier,draft.id,{method:'cash',amount_minor:1500,tendered_minor:2000},paymentKey)).id,cash.id);
  await reject(checkout.payment(cashier,draft.id,{method:'cash',amount_minor:1600},paymentKey),409);
  const completeKey=key();completed=await checkout.complete(cashier,draft.id,{},completeKey);assert.deepEqual(await checkout.complete(cashier,draft.id,{},completeKey),completed);
  assert.equal(await balance(item.id),C.exact.decimal(C.exact.scaled(before)-200n));
  const receipt=await checkout.receipt(cashier,completed.invoice_id);assert.equal(receipt.payments.length,3);assert.match(receipt.invoice.receipt_no,/^POS-/);
});
test('receipt refunds cap original quantity/tender, retain history and honor write-off',async()=>{
  const receipt=await checkout.receipt(owner,completed.invoice_id);const line=receipt.lines[0],cash=receipt.payments.find(p=>p.method==='cash');const before=await balance(item.id);
  const body={invoice_id:completed.invoice_id,reason:'Damaged product',lines:[{invoice_line_id:line.id,quantity:'1',disposition:'write_off'}],payments:[{method:'cash',original_payment_id:cash.id,amount_minor:1000}]};
  await pool.query('UPDATE item_details SET is_enable=0 WHERE id=?',[item.id]);
  await reject(refunds.refund(cashier,body,key()),403);const refundKey=key();const result=await refunds.refund(manager,body,refundKey);assert.equal(result.amount_minor,1000);assert.deepEqual(await refunds.refund(manager,body,refundKey),result);assert.equal(await balance(item.id),before);
  await reject(refunds.refund(manager,{...body,lines:[{invoice_line_id:line.id,quantity:'2',disposition:'restock'}],payments:[{method:'cash',original_payment_id:cash.id,amount_minor:2000}]},key()),409);
  assert.equal(Number((await require('../../src/modules/customers/customer.service').getCustomer(1)).current_balance),0);
  assert.equal((await require('../../src/modules/customer-ledger/customer-ledger.routes').getCustomerLedgerData(1)).closingBalance,0);
  await pool.query('UPDATE item_details SET is_enable=1 WHERE id=?',[item.id]);
});
test('two checkouts cannot complete against the same last stock unit; rollback alert survives',async()=>{
  const remaining=C.exact.scaled(await balance(item.id));await bakery.adjustment(owner,{business_unit_id:1,reason:'count_correction',notes:'Prepare last unit race',lines:[{item_id:item.id,quantity_delta:C.exact.decimal(100n-remaining)}]},key());
  const a=await cart(),b=await cart();await checkout.payment(cashier,a.id,{method:'cash',amount_minor:1000},key());await checkout.payment(cashier,b.id,{method:'cash',amount_minor:1000},key());
  const results=await Promise.allSettled([checkout.complete(cashier,a.id,{},key()),checkout.complete(cashier,b.id,{},key())]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(await balance(item.id),'0.00');
  const loser=results[0].status==='rejected'?a:b;
  const outstanding=await checkout.get(cashier,loser.id);for(const p of outstanding.payments)await checkout.cancelPayment(cashier,p.id,{reason:'Return tender after stock conflict'},key());
  assert.equal(Number((await pool.query("SELECT COUNT(*) AS n FROM audit_events WHERE action='stock.blocked'"))[0][0].n),1);
  await bakery.adjustment(owner,{business_unit_id:1,reason:'received',notes:'Restore fixture stock',lines:[{item_id:item.id,quantity_delta:'20'}]},key());
});
test('bakery recipe conversion consumes grams once and produces actual yield once',async()=>{
  const recipe=await bakery.recipe(owner,{output_item_id:output.id,name:'Bread batch',yield_quantity:'10',yield_unit:'piece',ingredients:[{item_id:ingredient.id,quantity:'1',unit_code:'kg'}]},key());
  const productionKey=key();const body={recipe_id:recipe.id,business_unit_id:1,planned_yield:'10',actual_yield:'9',reason:'One loaf damaged'};
  const result=await bakery.production(owner,body,productionKey);assert.equal(await balance(ingredient.id),'4000.00');assert.equal(await balance(output.id),'9.00');assert.equal((await bakery.production(owner,body,productionKey)).id,result.id);
});
test('CSV dry-run is nonmutating; invalid import is atomic; search and export are scoped',async()=>{
  const csv='item_name,sku,barcode,unit_id,base_unit_code,sale_price,purchase_price,kind\nImported,NEW-1,NEW-BARCODE,1,piece,12.25,6.00,retail';
  assert.equal((await catalog.importCsv(owner,{csv,dry_run:true},null)).valid_rows,1);assert.equal((await catalog.search(owner,{search:'NEW-1'})).rows.length,0);
  await catalog.importCsv(owner,{csv,dry_run:false},key());assert.equal((await catalog.search(owner,{search:'NEW-1'})).rows.length,1);
  await reject(catalog.importCsv(owner,{csv,dry_run:false},key()),422);assert.match(await catalog.exportCsv(owner),/NEW-1/);
});
test('offline allowances reserve stock; sync repeats once and changed payload conflicts',async()=>{
  const allocation=await offline.allocation(manager,{register_id:register.id,device_token:register.device_token,item_id:item.id,quantity:'2'},key());
  const syncKey=key(),body={register_id:register.id,device_token:register.device_token,client_id:crypto.randomUUID(),occurred_at:new Date().toISOString(),lines:[{item_id:item.id,allocation_id:allocation.id,quantity:'1',unit_price_minor:1000}],tendered_minor:1000};
  const before=await balance(item.id),result=await offline.sync(cashier,body,syncKey);assert.equal(result.status,'synced');assert.deepEqual(await offline.sync(cashier,body,syncKey),result);assert.equal(await balance(item.id),C.exact.decimal(C.exact.scaled(before)-100n));
  await reject(offline.sync(cashier,{...body,tendered_minor:1100},syncKey),409);
  await offline.release(manager,allocation.id,{confirm_device_reconciled:true,reason:'Queue synchronized'},key());
});
test('HTTP role/group denial, token isolation and API routes behave consistently',async()=>{
  const app=require('../../src/app');server=app.listen(0);await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api`;
  const login=await require('../../src/modules/auth/auth.service').login('cashier','test-password-123');
  const read=await fetch(`${base}/counter/catalog/search`,{headers:{Authorization:`Bearer ${login.token}`}});assert.equal(read.status,200);
  const write=await fetch(`${base}/counter/settings`,{method:'PATCH',headers:{Authorization:`Bearer ${login.token}`,'Content-Type':'application/json','Idempotency-Key':key()},body:'{}'});assert.equal(write.status,403);
  assert.equal((await fetch(`${base}/counter/checkouts`)).status,401);
});
test('HTTP contract rejects unknown fields; PIN rotation revokes tokens; legacy writes are audited',async()=>{
  const base=`http://127.0.0.1:${server.address().port}/api`;
  const login=await require('../../src/modules/auth/auth.service').login('owner','test-password-123');
  const headers={Authorization:`Bearer ${login.token}`,'Content-Type':'application/json','Idempotency-Key':key()};
  const invalid=await fetch(`${base}/counter/checkouts`,{method:'POST',headers,body:JSON.stringify({register_id:register.id,invented_field:true})});assert.equal(invalid.status,422);assert.equal((await invalid.json()).code,'VALIDATION_FAILED');
  const contract=await (await fetch(`${base}/openapi.json`)).json();assert.equal(contract.openapi,'3.1.0');assert.ok(contract.paths['/counter/offline/state']);assert.ok(!contract.paths['/demo/checkouts'].post.requestBody.content['application/json'].schema.required.includes('register_id'));
  const switched=await M.switchPin(cashier,{user_id:2,pin:'5678'});await M.assignStaff(owner,{user_id:2,role:'cashier',pin:'5678'},key());
  assert.equal((await fetch(`${base}/counter/me`,{headers:{Authorization:`Bearer ${switched.token}`}})).status,401);
  const created=await fetch(`${base}/customers`,{method:'POST',headers,body:JSON.stringify({customer_name:'Audited fixture customer'})});assert.equal(created.status,201);
  const [[audit]]=await pool.query("SELECT * FROM audit_events WHERE action='legacy.post.customers' ORDER BY id DESC LIMIT 1");assert.equal(audit.actor_id,1);assert.match(JSON.stringify(audit.after_data),/customer_name/);assert.doesNotMatch(JSON.stringify(audit.after_data),/Audited fixture customer/);
});

test('offline conflict blocks release and close until a manager reconciles cash and goods',async()=>{
  await reject(offline.allocation(manager,{register_id:register.id,device_token:register.device_token,item_id:item.id,quantity:'999'},key()),409);
  const allocation=await offline.allocation(manager,{register_id:register.id,device_token:register.device_token,item_id:item.id,quantity:'1'},key());
  const syncKey=key(),body={register_id:register.id,device_token:register.device_token,client_id:crypto.randomUUID(),occurred_at:new Date().toISOString(),lines:[{item_id:item.id,allocation_id:allocation.id,quantity:'1',unit_price_minor:999}],tendered_minor:1000};
  const before=await balance(item.id);await reject(offline.sync(cashier,body,syncKey),409);assert.equal(await balance(item.id),before);
  const state=await offline.state(cashier,register.id,register.device_token),queue=state.transactions.find(t=>t.client_id===body.client_id);assert.equal(queue.status,'conflict');
  await reject(offline.release(manager,allocation.id,{confirm_device_reconciled:true,reason:'Not reconciled'},key()),409);
  await reject(M.closeShift(cashier,shift.id,{closing_count_minor:0,reason:'Unresolved offline'},key()),409);
  await reject(offline.discard(cashier,queue.id,{confirm_cash_and_goods_reconciled:true,reason:'Unauthorized'},key()),403);
  await offline.discard(manager,queue.id,{confirm_cash_and_goods_reconciled:true,reason:'Cash returned and goods physically reconciled'},key());
  await reject(offline.sync(cashier,body,syncKey),409);await offline.release(manager,allocation.id,{confirm_device_reconciled:true,reason:'Device and physical goods reconciled'},key());
});

test('return window rejects old receipts without override; captured tender blocks closing until cancelled',async()=>{
  const original=await cart('1',manager);await checkout.payment(manager,original.id,{method:'cash',amount_minor:1000},key());const sale=await checkout.complete(manager,original.id,{},key());
  await pool.query('UPDATE sale_invoices SET created_at=DATE_SUB(NOW(),INTERVAL 30 DAY) WHERE id=?',[sale.invoice_id]);
  const receipt=await checkout.receipt(manager,sale.invoice_id);
  await reject(refunds.refund(manager,{invoice_id:sale.invoice_id,reason:'Past return window',lines:[{invoice_line_id:receipt.lines[0].id,quantity:'1',disposition:'restock'}],payments:[{method:'cash',original_payment_id:receipt.payments[0].id,amount_minor:1000}]},key()),403);
  const pending=await cart();const payment=await checkout.payment(cashier,pending.id,{method:'cash',amount_minor:1000},key());
  await reject(M.closeShift(cashier,shift.id,{closing_count_minor:0,reason:'Tender still unresolved'},key()),409);
  await checkout.cancelPayment(cashier,payment.id,{reason:'Tender returned to shopper'},key());
});

test('bakery deposits convert once, handover requires full settlement and cash is not counted twice',async()=>{
  const bookings=require('../../src/modules/counter/booking.service');
  const booking=await bookings.create(cashier,{register_id:register.id,customer_id:1,lines:[{item_id:output.id,quantity:'1'}]},key());
  await bakery.bakeryOrder(cashier,booking.id,{size:'Small',flavour:'Plain',pickup_at:new Date(Date.now()+3600000).toISOString()},key());
  const deposit=await bookings.deposit(cashier,booking.id,{register_id:register.id,amount_minor:500},key());
  const legacyPayments=require('../../src/modules/booking-payments/booking-payment.service');
  await reject(legacyPayments.update(deposit.booking_payment_id,{payment_method:'card'}),409);
  await reject(legacyPayments.remove(deposit.booking_payment_id),409);
  await reject(legacyPayments.create({booking_id:booking.id,amount:'1.00',payment_method:'cash'}),409);
  await reject(bakery.bakeryOrder(cashier,booking.id,{preparation_status:'cancelled'},key()),409);
  const converted=await bookings.convert(cashier,booking.id,{register_id:register.id},key());assert.equal((await bookings.convert(cashier,booking.id,{register_id:register.id},key())).checkout_id,converted.checkout_id);
  await checkout.payment(cashier,converted.checkout_id,{method:'cash',amount_minor:1500},key());const completedBooking=await checkout.complete(cashier,converted.checkout_id,{},key());
  await bakery.bakeryOrder(cashier,booking.id,{preparation_status:'preparing'},key());await bakery.bakeryOrder(cashier,booking.id,{preparation_status:'ready'},key());assert.equal((await bakery.bakeryOrder(cashier,booking.id,{preparation_status:'collected'},key())).preparation_status,'collected');
  assert.equal(Number((await pool.query("SELECT COUNT(*) AS n FROM cash_movements WHERE reference_type='BOOKING_PAYMENT' AND reference_id=?",[deposit.booking_payment_id]))[0][0].n),1);
  assert.equal(Number((await pool.query("SELECT SUM(amount_minor) AS amount FROM cash_movements WHERE reference_type='SALE_INVOICE' AND reference_id=?",[completedBooking.invoice_id]))[0][0].amount),1500);
  await reject(bookings.deposit(cashier,booking.id,{register_id:register.id,amount_minor:1},key()),409);
});
test('linked cash exchange settles only difference and retains the refund and replacement',async()=>{
  const original=await cart('1',manager);await checkout.payment(manager,original.id,{method:'cash',amount_minor:1000},key());const sale=await checkout.complete(manager,original.id,{},key());
  const receipt=await checkout.receipt(manager,sale.invoice_id),replacement=await cart('2',manager);
  const result=await refunds.exchange(manager,{checkout_id:replacement.id,tendered_difference_minor:1200,refund:{invoice_id:sale.invoice_id,reason:'Exchange size',lines:[{invoice_line_id:receipt.lines[0].id,quantity:'1',disposition:'restock'}],payments:[{method:'cash',original_payment_id:receipt.payments[0].id,amount_minor:1000}]}},key());
  assert.equal(result.difference_minor,'1000');assert.equal(result.change_minor,'200');assert.ok(result.refund_id&&result.invoice_id);
});
test('two visitor demos are isolated; restart revokes only one visitor and preserves business records',async()=>{
  const demo=require('../../src/modules/demo/demo.service');
  const [[before]]=await pool.query('SELECT COUNT(*) AS n FROM sale_invoices WHERE store_id=1');
  const retail=await demo.start({scenario:'retail'},pool),bakeryDemo=await demo.start({scenario:'bakery'},pool);
  const retailCtx=await demo.authenticate(retail.token,pool),bakeryCtx=await demo.authenticate(bakeryDemo.token,pool);
  assert.notEqual(retailCtx.storeId,bakeryCtx.storeId);assert.ok(bakeryDemo.booking_id);
  const retailItems=await catalog.search(retailCtx,{});assert.equal(retailItems.rows.length,3);await reject(checkout.get(retailCtx,(await bakeryCtx.pool.query('SELECT id FROM checkout_sessions WHERE store_id=? LIMIT 1',[bakeryCtx.storeId]))[0][0].id),404);
  const restart=await demo.restart(retailCtx);await reject(demo.authenticate(retail.token,pool),401);assert.ok(await demo.authenticate(bakeryDemo.token,pool));assert.ok(await demo.authenticate(restart.token,pool));
  assert.equal((await pool.query('SELECT COUNT(*) AS n FROM sale_invoices WHERE store_id=1'))[0][0].n,before.n);
});
test('reports reconcile captured/refunded tenders and closing count yields exact variance',async()=>{
  const report=await require('../../src/modules/counter/reports.service').report(owner,{from:'2026-01-01',to:'2026-12-31'});assert.ok(report.sales.length&&report.refunds.length);assert.equal(report.timezone,'Asia/Karachi');
  assert.match(await require('../../src/modules/counter/reports.service').exportCsv(owner,{from:'2026-01-01',to:'2026-12-31'}),/estimated_margin/);
  const [[sum]]=await pool.query("SELECT SUM(IF(direction='in',amount_minor,-CAST(amount_minor AS SIGNED))) AS amount FROM cash_movements WHERE shift_id=?",[shift.id]);
  const expected=Number(sum.amount)+10000;const closed=await M.closeShift(cashier,shift.id,{closing_count_minor:expected,reason:'End of counter fixture shift'},key());assert.equal(Number(closed.variance_minor),0);
  await reject(M.closeShift(cashier,shift.id,{closing_count_minor:expected,reason:'Again'},key()),409);
});
