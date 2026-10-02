const crypto=require('node:crypto');
const ApiError=require('../../utils/api-error');
const {minor}=require('../../utils/money');
const C=require('./counter-core');
const M=require('./management.service');
function checkoutAccess(ctx,checkout) { if(checkout.cashier_id!==ctx.id && !['owner','manager'].includes(ctx.role))throw new ApiError(403,'Checkout belongs to another cashier'); }
async function get(ctx,value,conn=ctx.pool) {
  const checkout=await C.row(conn,'checkout_sessions',ctx.storeId,value);checkoutAccess(ctx,checkout);
  const [lines]=await conn.query('SELECT l.*,i.item_name,i.sku,i.label_barcode FROM checkout_lines l JOIN item_details i ON i.id=l.item_id AND i.store_id=l.store_id WHERE l.store_id=? AND l.checkout_id=? ORDER BY l.id',[ctx.storeId,checkout.id]);
  const [payments]=await conn.query('SELECT * FROM checkout_payments WHERE store_id=? AND checkout_id=? ORDER BY id',[ctx.storeId,checkout.id]);
  return {...checkout,lines,payments};
}
async function create(ctx,body,key) {
  C.role(ctx,['owner','manager','cashier']);
  return C.transaction(ctx,'checkout.create',key,body,async conn=>{
    const register=await C.row(conn,'registers',ctx.storeId,body.register_id,true);if(!register.is_active)throw new ApiError(409,'Register inactive');
    if(body.customer_id)await C.row(conn,'customers',ctx.storeId,body.customer_id);
    const value=await C.insert(conn,'checkout_sessions',{store_id:ctx.storeId,public_id:crypto.randomUUID(),register_id:register.id,cashier_id:ctx.id,customer_id:body.customer_id || null});
    await C.audit(conn,{...ctx,registerId:register.id},'checkout.create','checkout',value,'Draft created');return get(ctx,value,conn);
  });
}
async function editable(conn,ctx,value) {
  const checkout=await C.row(conn,'checkout_sessions',ctx.storeId,value,true);checkoutAccess(ctx,checkout);
  if(!['draft','held'].includes(checkout.status))throw new ApiError(409,'Checkout is no longer editable');
  const [[payments]]=await conn.query("SELECT COUNT(*) AS n FROM checkout_payments WHERE store_id=? AND checkout_id=? AND status IN ('captured','pending','awaiting_customer')",[ctx.storeId,checkout.id]);
  if(payments.n)throw new ApiError(409,'Resolve existing payments before editing');return checkout;
}
async function patch(ctx,value,body,key) {
  C.role(ctx,['owner','manager','cashier']);
  return C.transaction(ctx,'checkout.edit',key,{value,...body},async conn=>{
    const checkout=await editable(conn,ctx,value);const config=await C.settings(conn,ctx.storeId);
    if(checkout.booking_id)throw new ApiError(409,'Converted booking lines are immutable');
    if(C.exact.integer(body.revision,'revision',true)!==Number(checkout.revision))throw new ApiError(409,'Checkout changed; refresh');
    if(!Array.isArray(body.lines)||!body.lines.length||body.lines.length>200)throw new ApiError(422,'Provide 1 to 200 lines');
    const items=await C.lockItems(conn,ctx,body.lines.map(l=>l.item_id));
    const payload={...body};delete payload.approval_token;delete payload.price_approval_token;
    let priceOverride=false;
    const lines=body.lines.map(line=>{
      const item=items.get(Number(line.item_id));const qty=C.exact.scaled(line.quantity,2,'quantity');if(qty<=0n)throw new ApiError(422,'Quantity must be positive');
      const price=line.unit_price_minor===undefined?minor(item.sale_price):C.exact.integer(line.unit_price_minor);
      if(price!==minor(item.sale_price))priceOverride=true;
      const total=C.exact.multiply(price,C.exact.decimal(qty));
      return {item_id:item.id,quantity:C.exact.decimal(qty),unit_price_minor:price,cost_price_minor:minor(item.purchase_price),total_minor:total,notes:line.notes?C.text(line.notes,'notes'):null};
    });
    if(priceOverride && !['owner','manager'].includes(ctx.role))await M.consumeApproval(conn,ctx,body.price_approval_token,'checkout.price',checkout.id,payload);
    const subtotal=C.exact.checked(lines.reduce((sum,l)=>sum+BigInt(l.total_minor),0n));
    let discount=C.exact.integer(body.discount_minor || 0),couponId=null;
    if(body.coupon_code) {
      const [[coupon]]=await conn.query('SELECT *, (valid_from<=NOW() AND (valid_until IS NULL OR valid_until>NOW())) AS valid FROM coupons WHERE store_id=? AND code=? FOR UPDATE',[ctx.storeId,C.text(body.coupon_code,'coupon code',60)]);
      if(!coupon?.is_active||!coupon.valid||(coupon.maximum_uses!==null&&coupon.uses_count>=coupon.maximum_uses)||subtotal<Number(coupon.minimum_spend_minor))throw new ApiError(422,'Coupon is invalid, exhausted or minimum spend not reached');
      if(discount)throw new ApiError(422,'Coupon and manual discounts cannot be combined');
      discount=coupon.discount_type==='percent'?C.exact.checked(BigInt(subtotal)*C.exact.scaled(coupon.discount_value)/10000n):minor(coupon.discount_value);
      couponId=coupon.id;
    }
    if(discount>subtotal)throw new ApiError(422,'Discount exceeds subtotal');
    const limit=ctx.role==='owner'?10000n:C.exact.scaled(ctx.role==='manager'?config.manager_discount_percent:config.cashier_discount_percent);
    // Coupons are owner-configured promotions; manual discounts follow staff limits.
    if(!couponId&&BigInt(discount)*10000n>BigInt(subtotal)*limit)await M.consumeApproval(conn,ctx,body.approval_token,'checkout.discount',checkout.id,payload,discount);
    const discounts=C.exact.allocate(discount,lines.map(l=>l.total_minor));
    if(body.cash_rounding!==undefined&&typeof body.cash_rounding!=='boolean')throw new ApiError(422,'cash_rounding must be boolean');
    const net=subtotal-discount, increment=body.cash_rounding ? BigInt(config.cash_rounding_increment_minor) : 1n;
    const rounded=C.exact.checked((BigInt(net)+increment/2n)/increment*increment);
    await conn.query('DELETE FROM checkout_lines WHERE store_id=? AND checkout_id=?',[ctx.storeId,checkout.id]);
    for(let i=0;i<lines.length;i++)await C.insert(conn,'checkout_lines',{store_id:ctx.storeId,checkout_id:checkout.id,...lines[i],discount_minor:discounts[i],total_minor:lines[i].total_minor-discounts[i],discount_source:discount?(couponId?'coupon':'manual'):'none'});
    if(body.customer_id)await C.row(conn,'customers',ctx.storeId,body.customer_id);
    await conn.query('UPDATE checkout_sessions SET subtotal_minor=?,discount_minor=?,total_minor=?,rounding_minor=?,coupon_id=?,notes=?,customer_id=?,revision=revision+1 WHERE id=?',[subtotal,discount,rounded,rounded-net,couponId,body.notes?C.text(body.notes,'notes',1000):null,body.customer_id || null,checkout.id]);
    await C.audit(conn,{...ctx,registerId:checkout.register_id},'checkout.edit','checkout',checkout.id,'Server-priced cart saved',{subtotal_minor:subtotal,discount_minor:discount,price_override:priceOverride});
    return get(ctx,checkout.id,conn);
  });
}
async function transition(ctx,value,body,key) {
  C.role(ctx,['owner','manager','cashier']);C.choice(body.status,['held','draft','voided'],'checkout transition');
  return C.transaction(ctx,'checkout.transition',key,{value,...body},async conn=>{
    const checkout=await C.row(conn,'checkout_sessions',ctx.storeId,value,true);checkoutAccess(ctx,checkout);
    if(!['draft','held','pending_payment'].includes(checkout.status)||checkout.booking_id)throw new ApiError(409,'Posted, converted or voided checkout is immutable');
    const [[payments]]=await conn.query("SELECT COUNT(*) AS n FROM checkout_payments WHERE store_id=? AND checkout_id=? AND status IN ('captured','awaiting_customer','pending')",[ctx.storeId,checkout.id]);
    if(payments.n)throw new ApiError(409,'Cannot park, edit or void checkout with unresolved/captured payments');
    const reason=body.status==='voided'?C.text(body.reason,'void reason'):null;
    const name=body.status==='held'?C.text(body.held_name,'held cart name',150):null;
    await conn.query('UPDATE checkout_sessions SET status=?,held_name=?,void_reason=?,revision=revision+1 WHERE id=?',[body.status,name,reason,checkout.id]);
    await C.audit(conn,{...ctx,registerId:checkout.register_id},`checkout.${body.status}`,'checkout',checkout.id,reason || 'Cart state changed');return get(ctx,checkout.id,conn);
  });
}
async function payment(ctx,value,body,key) {
  C.role(ctx,['owner','manager','cashier']);C.choice(body.method,['cash','card','bank_transfer','wallet'],'payment method');
  const amount=C.exact.integer(body.amount_minor,'amount_minor',true);
  return C.transaction(ctx,'payment.record',key,{value,...body},async conn=>{
    const checkout=await C.row(conn,'checkout_sessions',ctx.storeId,value,true);checkoutAccess(ctx,checkout);
    if(!['draft','pending_payment'].includes(checkout.status)||!Number(checkout.total_minor))throw new ApiError(409,'Payment requires a nonempty active checkout');
    const config=await C.settings(conn,ctx.storeId);if(!config.enabled_payment_methods.includes(body.method))throw new ApiError(422,'Tender method disabled');
    if(Number(checkout.rounding_minor)!==0&&body.method!=='cash')throw new ApiError(422,'Cash-rounded checkout requires cash-only tender');
    const [[sum]]=await conn.query("SELECT COALESCE(SUM(amount_minor),0) AS amount FROM checkout_payments WHERE store_id=? AND checkout_id=? AND status IN ('captured','pending','awaiting_customer')",[ctx.storeId,checkout.id]);
    if(BigInt(sum.amount)+BigInt(amount)>BigInt(checkout.total_minor))throw new ApiError(422,'Payment exceeds remaining balance');
    let status='captured', provider=null,reference=null,tendered=null,change=0,shift=null;
    if(body.method==='cash') {
      shift=await M.openShiftFor(conn,ctx,checkout.register_id);tendered=C.exact.integer(body.tendered_minor ?? amount);
      if(tendered<amount)throw new ApiError(422,'Cash tendered is below payment amount');change=tendered-amount;
    } else {
      provider=await C.row(conn,'payment_providers',ctx.storeId,body.provider_id);
      if(!provider.is_enabled||provider.method!==body.method)throw new ApiError(422,'Provider disabled or method mismatch');
      if(provider.mode==='sandbox') {C.choice(body.scenario || 'success',['success','pending','fail'],'sandbox scenario');status=body.scenario==='pending'?'awaiting_customer':body.scenario==='fail'?'failed':'captured';reference=`sandbox-${crypto.randomUUID()}`;}
      else reference=C.text(body.reference,'recorded payment reference',191);
    }
    const paymentId=await C.insert(conn,'checkout_payments',{store_id:ctx.storeId,public_id:crypto.randomUUID(),checkout_id:checkout.id,recorded_by:ctx.id,method:body.method,status,amount_minor:amount,tendered_minor:tendered,change_minor:change,provider_id:provider?.id || null,provider_reference:reference,idempotency_key:C.hash(key),captured_at:status==='captured'?new Date():null});
    await conn.query("UPDATE checkout_sessions SET status='pending_payment',shift_id=COALESCE(?,shift_id),revision=revision+1 WHERE id=?",[shift?.id || null,checkout.id]);
    await C.audit(conn,{...ctx,registerId:checkout.register_id},'payment.record','payment',paymentId,'Tender recorded',{method:body.method,status,amount_minor:amount,mode:provider?.mode || 'cash'});
    if(status!=='captured')await C.notify(conn,ctx,'unresolved_payment','Payment needs attention',`Checkout ${checkout.id}, payment ${paymentId}: ${status}`,`payment:${paymentId}`);
    return C.row(conn,'checkout_payments',ctx.storeId,paymentId);
  });
}
async function confirm(ctx,value,body,key) {
  C.role(ctx,['owner','manager','cashier']);C.choice(body.outcome,['captured','failed','cancelled'],'payment outcome');
  return C.transaction(ctx,'payment.confirm',key,{value,...body},async conn=>{
    // Lock checkout first, matching payment/completion lock order.
    const original=await C.row(conn,'checkout_payments',ctx.storeId,value);
    const checkout=await C.row(conn,'checkout_sessions',ctx.storeId,original.checkout_id,true);checkoutAccess(ctx,checkout);
    const payment=await C.row(conn,'checkout_payments',ctx.storeId,value,true);
    if(!['pending','awaiting_customer'].includes(payment.status))throw new ApiError(409,'Payment has already resolved');
    const provider=await C.row(conn,'payment_providers',ctx.storeId,payment.provider_id);
    if(provider.mode!=='sandbox')throw new ApiError(409,'Only sandbox confirmations supported');
    await conn.query('UPDATE checkout_payments SET status=?,captured_at=IF(?=\'captured\',NOW(),NULL) WHERE id=?',[body.outcome,body.outcome,payment.id]);
    await C.insert(conn,'payment_events',{store_id:ctx.storeId,payment_id:payment.id,event_key:C.hash(key),event_type:body.outcome,payload_hash:C.hash(body),redacted_payload:JSON.stringify({outcome:body.outcome}),processed_at:new Date()});
    await C.audit(conn,ctx,'payment.confirm','payment',payment.id,'Authenticated sandbox confirmation',{outcome:body.outcome});return C.row(conn,'checkout_payments',ctx.storeId,payment.id);
  });
}
async function cancelPayment(ctx,value,body,key) {
  C.role(ctx,['owner','manager','cashier']);
  return C.transaction(ctx,'payment.cancel',key,{value,...body},async conn=>{
    const original=await C.row(conn,'checkout_payments',ctx.storeId,value);
    const checkout=await C.row(conn,'checkout_sessions',ctx.storeId,original.checkout_id,true);checkoutAccess(ctx,checkout);
    if(['completed','voided'].includes(checkout.status))throw new ApiError(409,'Posted checkout requires a receipt refund');
    const payment=await C.row(conn,'checkout_payments',ctx.storeId,value,true);
    if(!['pending','awaiting_customer','captured'].includes(payment.status))throw new ApiError(409,'Tender is already resolved/cancelled');
    if(payment.provider_reference?.startsWith('booking-advance-'))throw new ApiError(409,'Allocated booking deposits cannot be cancelled');
    if(payment.provider_id) {
      const provider=await C.row(conn,'payment_providers',ctx.storeId,payment.provider_id);
      if(provider.mode==='recorded'&&payment.status==='captured') {C.role(ctx,['owner','manager']);C.text(body.reversal_reference,'recorded tender reversal reference',191);}
    }
    const reason=C.text(body.reason,'cancellation reason');
    await conn.query("UPDATE checkout_payments SET status='cancelled' WHERE id=?",[payment.id]);
    const [[active]]=await conn.query("SELECT COUNT(*) AS n FROM checkout_payments WHERE store_id=? AND checkout_id=? AND status IN ('captured','pending','awaiting_customer')",[ctx.storeId,checkout.id]);
    if(!active.n)await conn.query("UPDATE checkout_sessions SET status='draft',shift_id=NULL,revision=revision+1 WHERE id=?",[checkout.id]);
    await C.audit(conn,{...ctx,registerId:checkout.register_id},'payment.cancel','payment',payment.id,reason,{reversal_reference:body.reversal_reference || null});return C.row(conn,'checkout_payments',ctx.storeId,payment.id);
  });
}
async function completeInTransaction(conn,ctx,value) {
  const checkout=await C.row(conn,'checkout_sessions',ctx.storeId,value,true);checkoutAccess(ctx,checkout);
  if(checkout.status==='completed')return {checkout_id:checkout.id,invoice_id:checkout.invoice_id};
  if(!['draft','pending_payment'].includes(checkout.status))throw new ApiError(409,'Checkout cannot be completed');
  const register=await C.row(conn,'registers',ctx.storeId,checkout.register_id);ctx={...ctx,registerId:register.id};
  const [lines]=await conn.query('SELECT * FROM checkout_lines WHERE store_id=? AND checkout_id=? ORDER BY id',[ctx.storeId,checkout.id]);if(!lines.length)throw new ApiError(422,'Empty checkout');
  const [payments]=await conn.query('SELECT * FROM checkout_payments WHERE store_id=? AND checkout_id=? ORDER BY id FOR UPDATE',[ctx.storeId,checkout.id]);
  if(payments.some(p=>['pending','awaiting_customer'].includes(p.status))||payments.filter(p=>p.status==='captured').reduce((a,p)=>a+BigInt(p.amount_minor),0n)!==BigInt(checkout.total_minor))throw new ApiError(409,'Captured payments must equal checkout total');
  let shift=null;
  if(payments.some(p=>p.status==='captured'&&p.method==='cash'&&!p.provider_reference?.startsWith('booking-advance-'))) {shift=await M.openShiftFor(conn,ctx,register.id);if(Number(checkout.shift_id)!==Number(shift.id))throw new ApiError(409,'Cash belongs to a different shift');}
  if(checkout.coupon_id) {
    const coupon=await C.row(conn,'coupons',ctx.storeId,checkout.coupon_id,true);
    const [[valid]]=await conn.query('SELECT (valid_from<=NOW() AND (valid_until IS NULL OR valid_until>NOW())) AS valid FROM coupons WHERE id=?',[coupon.id]);
    if(!coupon.is_active||!valid.valid||(coupon.maximum_uses!==null&&coupon.uses_count>=coupon.maximum_uses))throw new ApiError(409,'Coupon no longer available');
    await conn.query('UPDATE coupons SET uses_count=uses_count+1 WHERE id=?',[coupon.id]);
  }
  const items=await C.lockItems(conn,ctx,lines.map(l=>l.item_id));
  const invoiceId=await C.insert(conn,'sale_invoices',{store_id:ctx.storeId,customer_id:checkout.customer_id,business_unit_id:register.business_unit_id,description:checkout.notes,discount:C.exact.decimal(checkout.discount_minor),sub_total:C.exact.decimal(checkout.subtotal_minor),payable:C.exact.decimal(checkout.total_minor),status:'paid',register_id:register.id,shift_id:shift?.id || null,cashier_id:checkout.cashier_id});
  const quantities=new Map();
  for(const line of lines) {
    await C.insert(conn,'sale_invoice_items',{store_id:ctx.storeId,invoice_id:invoiceId,item_id:line.item_id,qty:line.quantity,unit_price:C.exact.decimal(line.unit_price_minor),total_price:C.exact.decimal(line.total_minor),cost_price_minor:line.cost_price_minor,discount_minor:line.discount_minor});
    quantities.set(line.item_id,(quantities.get(line.item_id)||0n)+C.exact.scaled(line.quantity,6)/10000n);
  }
  for(const [itemId,quantity] of [...quantities].sort((a,b)=>a[0]-b[0]))await C.stock(conn,ctx,items.get(itemId),register.business_unit_id,-quantity,'SALE_INVOICE',invoiceId,'Checkout completion');
  await conn.query('INSERT INTO receipt_sequences (store_id,register_id) VALUES (?,?) ON DUPLICATE KEY UPDATE id=id',[ctx.storeId,register.id]);
  const [[sequence]]=await conn.query('SELECT * FROM receipt_sequences WHERE store_id=? AND register_id=? FOR UPDATE',[ctx.storeId,register.id]);
  const number=`POS-${ctx.storeId}-${register.id}-${sequence.next_value}`;
  await conn.query('UPDATE receipt_sequences SET next_value=next_value+1 WHERE id=?',[sequence.id]);
  await conn.query('UPDATE sale_invoices SET receipt_no=? WHERE id=?',[number,invoiceId]);
  for(const p of payments.filter(p=>p.status==='captured')) {
    await C.insert(conn,'customer_payments',{store_id:ctx.storeId,invoice_id:invoiceId,customer_id:checkout.customer_id,amount:C.exact.decimal(p.amount_minor),payment_date:new Date(),payment_method:{cash:'Cash',card:'Card',bank_transfer:'Bank Transfer',wallet:'Online'}[p.method],remarks:`counter payment ${p.id}`});
    if(p.method==='cash'&&!p.provider_reference?.startsWith('booking-advance-'))await M.movement(conn,ctx,shift,'sale',p.amount_minor,`sale:${p.id}`,'Checkout collection','SALE_INVOICE',invoiceId);
  }
  if(checkout.booking_id) {
    const booking=await C.row(conn,'bookings',ctx.storeId,checkout.booking_id,true);
    await C.insert(conn,'booking_invoice_links',{store_id:ctx.storeId,booking_id:booking.id,invoice_id:invoiceId});
    await conn.query("UPDATE bookings SET booking_status='Completed' WHERE id=?",[booking.id]);
  }
  await conn.query("UPDATE checkout_sessions SET status='completed',invoice_id=?,completed_at=NOW(),revision=revision+1 WHERE id=?",[invoiceId,checkout.id]);
  await C.audit(conn,ctx,'checkout.complete','sale_invoice',invoiceId,'Sale, payments, stock and receipt committed',{receipt_no:number,total_minor:checkout.total_minor});
  return {checkout_id:checkout.id,invoice_id:invoiceId,receipt_no:number};
}
async function complete(ctx,value,body,key) { C.role(ctx,['owner','manager','cashier']);return C.transaction(ctx,'checkout.complete',key,{value,...body},conn=>completeInTransaction(conn,ctx,value)); }
async function receipt(ctx,value) {
  const invoice=await C.row(ctx.pool,'sale_invoices',ctx.storeId,value);
  if(!['owner','manager'].includes(ctx.role)&&invoice.cashier_id!==ctx.id)throw new ApiError(403,'Receipt belongs to another cashier');
  const [lines]=await ctx.pool.query('SELECT s.*,i.item_name,i.sku,i.label_barcode FROM sale_invoice_items s LEFT JOIN item_details i ON i.id=s.item_id AND i.store_id=s.store_id WHERE s.store_id=? AND invoice_id=? ORDER BY s.id',[ctx.storeId,invoice.id]);
  const [[checkout]]=await ctx.pool.query('SELECT * FROM checkout_sessions WHERE store_id=? AND invoice_id=?',[ctx.storeId,invoice.id]);
  const [payments]=checkout?await ctx.pool.query('SELECT * FROM checkout_payments WHERE store_id=? AND checkout_id=?',[ctx.storeId,checkout.id]):[[]];
  const [refunds]=await ctx.pool.query('SELECT * FROM refund_notes WHERE store_id=? AND invoice_id=?',[ctx.storeId,invoice.id]);
  return {invoice,lines,payments,refunds,rounding_minor:checkout?.rounding_minor || 0,store:await M.getSettings(ctx),paper_widths_mm:[58,80],lookup_code:invoice.receipt_no};
}
module.exports={create,get,patch,transition,payment,confirm,cancelPayment,complete,completeInTransaction,receipt,checkoutAccess};
