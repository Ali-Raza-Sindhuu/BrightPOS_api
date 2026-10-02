const crypto=require('node:crypto');
const mysql=require('mysql2/promise');
const ApiError=require('../../utils/api-error');
const {getDatabaseOptions}=require('../../config/database');
const C=require('../counter/counter-core');
const M=require('../counter/management.service');
const checkout=require('../counter/checkout.service');
let demoPool;
function getPool() {
  const options=getDatabaseOptions();const database=process.env.DEMO_DB_NAME;
  if(!database||!/^brightpos_demo(?:_test)?$/.test(database)||database===options.database)throw new ApiError(503,'Demo database has not been explicitly configured');
  if(!demoPool)demoPool=mysql.createPool({...options,database,connectionLimit:3,queueLimit:30,waitForConnections:true,dateStrings:true});return demoPool;
}
async function start(body,pool=getPool()) {
  const scenario=C.choice(body.scenario || 'retail',['retail','bakery'],'demo scenario');
  // An advisory lock makes the persistent capacity guard safe across processes.
  const conn=await pool.getConnection();let token,createdStore;
  try {
    const [[lock]]=await conn.query("SELECT GET_LOCK('brightpos:demo:capacity',5) AS acquired");if(!lock.acquired)throw new ApiError(503,'Demo is busy; retry shortly');
    const [[capacity]]=await conn.query("SELECT COUNT(*) AS n FROM demo_sessions WHERE status='active' AND expires_at>NOW()");if(capacity.n>=50)throw new ApiError(429,'Demo capacity reached; try later');
    token=crypto.randomBytes(32).toString('hex');const suffix=crypto.randomBytes(8).toString('hex');
    await conn.beginTransaction();
    const storeId=await C.insert(conn,'stores',{name:scenario==='bakery'?'Bright Bakery Demo':'Bright Retail Demo',code:`DEMO_${suffix}`,purpose:'demo'});
    createdStore=storeId;
    await C.insert(conn,'store_settings',{store_id:storeId,enabled_payment_methods:JSON.stringify(['cash','card','bank_transfer','wallet']),notification_preferences:JSON.stringify({in_app:true})});
    const location=await C.insert(conn,'business_units',{store_id:storeId,name:`Demo ${suffix}`,code:`D${suffix}`,type:'Shop'});
    const unit=await C.insert(conn,'item_units',{store_id:storeId,unit_name:`Demo pieces ${suffix}`});
    const user=await C.insert(conn,'users',{store_id:storeId,full_name:'Demo Visitor',username:`demo_${suffix}`,password_hash:await require('bcryptjs').hash(crypto.randomBytes(32).toString('hex'),10),role:'user'});
    await C.insert(conn,'store_staff',{store_id:storeId,user_id:user,role:'manager'});
    const register=await C.insert(conn,'registers',{store_id:storeId,name:'Demo Counter',code:'DEMO',business_unit_id:location,device_key_hash:C.hash(crypto.randomBytes(32).toString('hex'))});
    await C.insert(conn,'receipt_sequences',{store_id:storeId,register_id:register});
    const customer=await C.insert(conn,'customers',{store_id:storeId,customer_name:'Sample Customer',mobile_number:'03000000000'});
    const ctx={pool,id:user,storeId,role:'manager',registerId:register,demo:true};
    const names=scenario==='bakery'?[['Butter Croissant',25000,12000],['Chocolate Cake',250000,130000],['Sourdough Loaf',45000,22000]]:[['Everyday T-shirt',150000,80000],['Cotton Tote Bag',60000,25000],['Notebook',35000,15000]];
    const itemIds=[];
    for(let index=0;index<names.length;index++) {
      const [name,price,cost]=names[index];const product=await C.insert(conn,'products',{store_id:storeId,name,kind:scenario==='bakery'?'bakery':'retail'});
      const item=await C.insert(conn,'item_details',{store_id:storeId,item_name:name,product_id:product,sku:`DEMO-${index+1}`,label_barcode:`D${suffix}${index+1}`,item_unit_id:unit,base_unit_code:'piece',sale_price:C.exact.decimal(price),purchase_price:C.exact.decimal(cost),variant_options:JSON.stringify(index===0&&scenario==='retail'?{size:'M',colour:'Blue'}:{})});
      itemIds.push(item);await C.stock(conn,ctx,{id:item,item_unit_id:unit,item_name:name},location,2000n,'DEMO_SEED',storeId,'Disposable demo opening stock');
    }
    const provider=await C.insert(conn,'payment_providers',{store_id:storeId,code:'SANDBOX_CARD',method:'card',mode:'sandbox',is_enabled:1,configuration:JSON.stringify({})});
    await C.insert(conn,'demo_sessions',{store_id:storeId,session_hash:C.hash(token),scenario,expires_at:new Date(Date.now()+8*60*60000),last_seen_at:new Date(),visitor_user_id:user,register_id:register});
    await conn.commit();
    const shift=await M.openShift(ctx,{register_id:register,opening_float_minor:500000},`demo:${suffix}:shift`);
    // A real completed sample sale proves the same transactional backend path.
    const sample=await checkout.create(ctx,{register_id:register,customer_id:customer},`demo:${suffix}:sample`);
    await checkout.patch(ctx,sample.id,{revision:1,customer_id:customer,lines:[{item_id:itemIds[0],quantity:'1'}]},`demo:${suffix}:lines`);
    await checkout.payment(ctx,sample.id,{method:'cash',amount_minor:names[0][1]},`demo:${suffix}:pay`);
    await checkout.complete(ctx,sample.id,{},`demo:${suffix}:complete`);
    let booking=null;
    if(scenario==='bakery') {
      booking=await require('../counter/booking.service').create(ctx,{register_id:register,customer_id:customer,lines:[{item_id:itemIds[1],quantity:'1'}]},`demo:${suffix}:booking`);
      await require('../counter/stock-bakery.service').bakeryOrder(ctx,booking.id,{size:'8 inch',flavour:'Chocolate',cake_message:'Happy Birthday!',pickup_at:new Date(Date.now()+86400000).toISOString()},`demo:${suffix}:details`);
      await require('../counter/booking.service').deposit(ctx,booking.id,{register_id:register,amount_minor:100000},`demo:${suffix}:deposit`);
    }
    return {token,scenario,store_id:storeId,register_id:register,shift_id:shift.id,customer_id:customer,provider_id:provider,item_ids:itemIds,booking_id:booking?.id || null,sandbox:true,session_expires_in_seconds:28800,guided_steps:['Search a sample product','Create and hold a cart','Record cash or sandbox split payment','Complete the sale','Inspect receipt, stock and shift',...(booking?['Prepare the sample cake order','Convert its deposit and collect the balance']:[])],next:'/demo'};
  } catch(error) {await conn.rollback();if(createdStore)await conn.query("UPDATE demo_sessions SET status='expired' WHERE store_id=?",[createdStore]);throw error;} finally {await conn.query("SELECT RELEASE_LOCK('brightpos:demo:capacity')");conn.release();}
}
async function authenticate(token,pool=getPool()) {
  if(!/^[a-f0-9]{64}$/.test(token || ''))throw new ApiError(401,'Invalid demo session');
  const [[session]]=await pool.query("SELECT s.*,u.is_active FROM demo_sessions s JOIN stores t ON t.id=s.store_id JOIN users u ON u.id=s.visitor_user_id AND u.store_id=s.store_id WHERE s.session_hash=? AND s.status='active' AND s.expires_at>NOW() AND t.purpose='demo' AND t.is_active=1",[C.hash(token)]);
  if(!session?.is_active)throw new ApiError(401,'Demo session expired; restart demo');
  await pool.query('UPDATE demo_sessions SET last_seen_at=NOW() WHERE id=?',[session.id]);
  return {pool,id:session.visitor_user_id,storeId:session.store_id,role:'manager',registerId:session.register_id,demo:true,session};
}
async function restart(ctx) {
  // Expire only this visitor. A fresh isolated store keeps append-only history
  // intact and avoids destructive reset of another visitor's or shop data.
  await ctx.pool.query("UPDATE demo_sessions SET status='expired' WHERE id=? AND store_id=?",[ctx.session.id,ctx.storeId]);
  return start({scenario:ctx.session.scenario},ctx.pool);
}
async function closePool() {if(demoPool){await demoPool.end();demoPool=null;}}
module.exports={getPool,start,authenticate,restart,closePool};
