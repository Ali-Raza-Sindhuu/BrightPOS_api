const crypto=require('node:crypto');
const ApiError=require('../../utils/api-error');
const {minor}=require('../../utils/money');
const C=require('./counter-core');
const M=require('./management.service');
const checkoutService=require('./checkout.service');
async function device(conn,ctx,registerId,token,lock=false) {
  const register=await C.row(conn,'registers',ctx.storeId,registerId,lock);
  if(!register.is_active||!register.device_key_hash||register.device_key_hash!==C.hash(String(token || '')))throw new ApiError(403,'Invalid register device credential');return register;
}
async function allocation(ctx,body,key) {
  C.role(ctx,['owner','manager']);
  return C.transaction(ctx,'offline.allocate',key,{...body,device_token:C.hash(String(body.device_token || ''))},async conn=>{
    const register=await device(conn,ctx,body.register_id,body.device_token,true);await M.openShiftFor(conn,ctx,register.id);
    const items=await C.lockItems(conn,ctx,[body.item_id]),item=items.get(Number(body.item_id));
    const qty=C.exact.scaled(body.quantity);if(!qty)throw new ApiError(422,'Allocation must be positive');
    const [[inventory]]=await conn.query('SELECT quantity FROM inventory WHERE store_id=? AND item_id=? AND business_unit_id=? AND unit_id=? FOR UPDATE',[ctx.storeId,item.id,register.business_unit_id,item.item_unit_id]);
    const [[reserved]]=await conn.query("SELECT COALESCE(SUM(allocated_quantity-consumed_quantity),0) AS qty FROM offline_stock_allocations WHERE store_id=? AND item_id=? AND business_unit_id=? AND status IN ('active','reconciling')",[ctx.storeId,item.id,register.business_unit_id]);
    if((inventory?C.exact.scaled(inventory.quantity):0n)-C.exact.scaled(reserved.qty,6)/10000n<qty)throw new ApiError(409,'Allocation exceeds unreserved stock');
    const value=await C.insert(conn,'offline_stock_allocations',{store_id:ctx.storeId,public_id:crypto.randomUUID(),register_id:register.id,item_id:item.id,business_unit_id:register.business_unit_id,allocated_quantity:C.exact.decimal(qty),expires_at:new Date(Date.now()+8*60*60000)});
    await C.audit(conn,{...ctx,registerId:register.id},'offline.allocate','allocation',value,'Offline stock reserved',{item_id:item.id,quantity:body.quantity});
    return {...await C.row(conn,'offline_stock_allocations',ctx.storeId,value),unit_price_minor:minor(item.sale_price)};
  });
}
async function release(ctx,value,body,key) {
  C.role(ctx,['owner','manager']);
  return C.transaction(ctx,'offline.release',key,{value,...body},async conn=>{
    const original=await C.row(conn,'offline_stock_allocations',ctx.storeId,value);await C.lockItems(conn,ctx,[original.item_id]);
    const allocation=await C.row(conn,'offline_stock_allocations',ctx.storeId,value,true);
    if(allocation.status==='released')throw new ApiError(409,'Allocation already released');
    if(body.confirm_device_reconciled!==true)throw new ApiError(422,'Confirm the device queue is reconciled before releasing reserved stock');
    const [[pending]]=await conn.query("SELECT COUNT(*) AS n FROM offline_transactions WHERE store_id=? AND register_id=? AND status IN ('queued','processing','conflict','failed') AND COALESCE(error_code,'')<>'DISCARDED_RECONCILED'",[ctx.storeId,allocation.register_id]);
    if(pending.n)throw new ApiError(409,'Resolve pending/conflicting device transactions first');
    await conn.query("UPDATE offline_stock_allocations SET status='released',released_at=NOW() WHERE id=?",[allocation.id]);
    await C.audit(conn,ctx,'offline.release','allocation',allocation.id,C.text(body.reason,'release reason'));return C.row(conn,'offline_stock_allocations',ctx.storeId,value);
  });
}
async function sync(ctx,body,key) {
  C.role(ctx,['owner','manager','cashier']);
  const register=await device(ctx.pool,ctx,body.register_id,body.device_token);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.client_id || ''))throw new ApiError(422,'client_id must be UUID');
  if(!Array.isArray(body.lines)||!body.lines.length||body.lines.length>100)throw new ApiError(422,'Offline lines required');
  const occurred=new Date(body.occurred_at);if(!Number.isFinite(occurred.getTime())||occurred.getTime()>Date.now()+60000)throw new ApiError(422,'Invalid offline occurrence time');
  const payload={...body};delete payload.device_token;
  const digest=C.hash({actor:ctx.id,payload});key=C.text(key,'Idempotency-Key',100);
  await ctx.pool.query('INSERT INTO offline_transactions (store_id,register_id,client_id,idempotency_key,payload_hash,payload,occurred_at) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id',[ctx.storeId,register.id,body.client_id,C.hash(key),digest,JSON.stringify(payload),occurred]);
  const [[queued]]=await ctx.pool.query('SELECT * FROM offline_transactions WHERE store_id=? AND register_id=? AND client_id=?',[ctx.storeId,register.id,body.client_id]);
  if(!queued||queued.payload_hash!==digest||queued.idempotency_key!==C.hash(key))throw new ApiError(409,'Offline identity reused with changed content or request key');
  if(queued.error_code==='DISCARDED_RECONCILED')throw new ApiError(409,'Manager reconciled and discarded this offline transaction');
  if(queued.status==='synced')return {transaction_id:queued.id,invoice_id:queued.invoice_id,status:'synced'};
  try {
    return await C.transaction(ctx,'offline.sync',key,payload,async conn=>{
      await C.row(conn,'registers',ctx.storeId,register.id,true);
      const queue=await C.row(conn,'offline_transactions',ctx.storeId,queued.id,true);
      if(queue.error_code==='DISCARDED_RECONCILED')throw new ApiError(409,'Offline transaction has been discarded after reconciliation');
      if(queue.status==='synced')return {transaction_id:queue.id,invoice_id:queue.invoice_id,status:'synced'};
      const shift=await M.openShiftFor(conn,ctx,register.id);
      const items=await C.lockItems(conn,ctx,body.lines.map(l=>l.item_id));
      const used=new Map();let total=0n;const lines=[];
      for(const line of body.lines) {
        const item=items.get(Number(line.item_id));const qty=C.exact.scaled(line.quantity);if(!qty)throw new ApiError(422,'Offline quantity must be positive');
        const price=C.exact.integer(line.unit_price_minor);if(price!==minor(item.sale_price))throw new ApiError(409,'Offline price changed; manager reconciliation required');
        const allocation=await C.row(conn,'offline_stock_allocations',ctx.storeId,line.allocation_id,true);
        if(allocation.register_id!==register.id||allocation.item_id!==item.id||allocation.status!=='active'||occurred.getTime()>new Date(`${allocation.expires_at.replace(' ','T')}Z`).getTime()||occurred.getTime()<new Date(`${allocation.created_at.replace(' ','T')}Z`).getTime()-1000)throw new ApiError(409,'Invalid or expired offline allowance');
        const consumed=(used.get(allocation.id)||0n)+qty;
        if(consumed+C.exact.scaled(allocation.consumed_quantity,6)/10000n>C.exact.scaled(allocation.allocated_quantity,6)/10000n)throw new ApiError(409,'Offline stock allowance exhausted');used.set(allocation.id,consumed);
        const lineTotal=C.exact.multiply(price,C.exact.decimal(qty));total+=BigInt(lineTotal);lines.push({item_id:item.id,quantity:C.exact.decimal(qty),unit_price_minor:price,cost_price_minor:minor(item.purchase_price),total_minor:lineTotal});
      }
      const amount=C.exact.checked(total),tendered=C.exact.integer(body.tendered_minor);if(!amount||tendered<amount)throw new ApiError(422,'Offline cash tender is insufficient');
      for(const [allocationId,quantity] of [...used].sort((a,b)=>a[0]-b[0]))await conn.query('UPDATE offline_stock_allocations SET consumed_quantity=consumed_quantity+? WHERE id=?',[C.exact.decimal(quantity),allocationId]);
      const checkoutId=await C.insert(conn,'checkout_sessions',{store_id:ctx.storeId,public_id:crypto.randomUUID(),register_id:register.id,cashier_id:ctx.id,shift_id:shift.id,status:'pending_payment',subtotal_minor:amount,total_minor:amount,notes:`Offline ${body.client_id}`});
      for(const line of lines)await C.insert(conn,'checkout_lines',{store_id:ctx.storeId,checkout_id:checkoutId,...line});
      await C.insert(conn,'checkout_payments',{store_id:ctx.storeId,checkout_id:checkoutId,public_id:crypto.randomUUID(),recorded_by:ctx.id,method:'cash',status:'captured',amount_minor:amount,tendered_minor:tendered,change_minor:tendered-amount,captured_at:new Date(),idempotency_key:C.hash(`offline:${key}`)});
      const completed=await checkoutService.completeInTransaction(conn,ctx,checkoutId);
      await conn.query("UPDATE offline_transactions SET status='synced',invoice_id=?,synced_at=NOW(),error_code=NULL,attempts=attempts+1 WHERE id=?",[completed.invoice_id,queue.id]);
      await C.audit(conn,{...ctx,registerId:register.id},'offline.sync','offline_transaction',queue.id,'Offline cash transaction synced once');
      return {transaction_id:queue.id,invoice_id:completed.invoice_id,status:'synced'};
    });
  } catch(error) {
    await ctx.pool.query("UPDATE offline_transactions SET status=?,error_code=?,attempts=attempts+1 WHERE id=? AND status<>'synced' AND COALESCE(error_code,'')<>'DISCARDED_RECONCILED'",[error.statusCode===409?'conflict':'failed',error.statusCode===409?'OFFLINE_CONFLICT':'OFFLINE_FAILED',queued.id]);
    await C.notify(ctx.pool,ctx,'offline_conflict','Offline sync needs attention',`Device transaction ${queued.id} did not sync`,`offline:${queued.id}`);throw error;
  }
}
async function discard(ctx,value,body,key) {
  C.role(ctx,['owner','manager']);
  return C.transaction(ctx,'offline.discard',key,{value,...body},async conn=>{
    const transaction=await C.row(conn,'offline_transactions',ctx.storeId,value,true);
    if(!['conflict','failed'].includes(transaction.status)||transaction.error_code==='DISCARDED_RECONCILED')throw new ApiError(409,'Only unresolved failed/conflicting transactions can be reconciled');
    if(body.confirm_cash_and_goods_reconciled!==true)throw new ApiError(422,'Confirm cash and goods were reconciled before discarding');
    await conn.query("UPDATE offline_transactions SET status='failed',error_code='DISCARDED_RECONCILED' WHERE id=?",[transaction.id]);
    await C.audit(conn,ctx,'offline.discard','offline_transaction',transaction.id,C.text(body.reason,'reconciliation reason'));
    return {transaction_id:transaction.id,status:'discarded',error_code:'DISCARDED_RECONCILED'};
  });
}
async function state(ctx,registerId,token) {
  C.role(ctx,['owner','manager','cashier']);const register=await device(ctx.pool,ctx,registerId,token);await M.openShiftFor(ctx.pool,ctx,register.id);
  const [allocations]=await ctx.pool.query("SELECT * FROM offline_stock_allocations WHERE store_id=? AND register_id=? AND status IN ('active','reconciling') ORDER BY id",[ctx.storeId,register.id]);
  const [transactions]=await ctx.pool.query('SELECT id,client_id,status,error_code,attempts,invoice_id,occurred_at,synced_at FROM offline_transactions WHERE store_id=? AND register_id=? ORDER BY id DESC LIMIT 100',[ctx.storeId,register.id]);
  return {register_id:register.id,allowed_offline_tender:'cash',allocations,transactions};
}
module.exports={device,allocation,release,sync,discard,state};
