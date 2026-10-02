const crypto=require('node:crypto');
const ApiError=require('../../utils/api-error');
const {minor}=require('../../utils/money');
const C=require('./counter-core');
const M=require('./management.service');
async function refundInTransaction(conn,ctx,body,key) {
  const invoice=await C.row(conn,'sale_invoices',ctx.storeId,body.invoice_id,true);
  const config=await C.settings(conn,ctx.storeId);
  const [[age]]=await conn.query('SELECT TIMESTAMPDIFF(DAY,created_at,NOW()) AS days FROM sale_invoices WHERE id=?',[invoice.id]);
  if(age.days>config.return_window_days) {
    const payload={...body};delete payload.approval_token;
    await M.consumeApproval(conn,ctx,body.approval_token,'refund.window',invoice.id,payload);
  }
  const reason=C.text(body.reason,'refund reason');
  if(!Array.isArray(body.lines)||!body.lines.length||body.lines.length>200)throw new ApiError(422,'Return lines required');
  const [original]=await conn.query('SELECT * FROM sale_invoice_items WHERE store_id=? AND invoice_id=? ORDER BY id',[ctx.storeId,invoice.id]);
  const credits=C.exact.allocate(minor(invoice.payable),original.map(l=>minor(l.total_price)));
  const creditById=new Map(original.map((l,i)=>[l.id,credits[i]]));
  const seen=new Set();const requested=[];
  const [[unlinked]]=await conn.query('SELECT COUNT(*) AS n FROM sale_returns s LEFT JOIN refund_notes r ON r.legacy_return_id=s.id AND r.store_id=s.store_id WHERE s.store_id=? AND s.sale_invoice_id=? AND r.id IS NULL',[ctx.storeId,invoice.id]);
  if(unlinked.n)throw new ApiError(409,'Existing account-credit returns require reconciliation before money refund');
  for(const line of body.lines) {
    const source=original.find(l=>Number(l.id)===Number(line.invoice_line_id));if(!source||seen.has(source.id))throw new ApiError(422,'Return lines must be unique original invoice lines');seen.add(source.id);
    C.choice(line.disposition,['restock','write_off'],'return disposition');
    const qty=C.exact.scaled(line.quantity),sold=C.exact.scaled(source.qty);if(!qty)throw new ApiError(422,'Return quantity must be positive');
    const [[returned]]=await conn.query("SELECT COALESCE(SUM(l.quantity),0) AS qty FROM refund_lines l JOIN refund_notes n ON n.id=l.refund_id WHERE l.store_id=? AND l.invoice_line_id=? AND n.status='completed'",[ctx.storeId,source.id]);
    const previous=C.exact.scaled(returned.qty,6)/10000n;if(previous+qty>sold)throw new ApiError(409,'Return exceeds remaining original quantity');
    const total=BigInt(creditById.get(source.id));const credit=C.exact.checked(total*(previous+qty)/sold-total*previous/sold);
    requested.push({source,qty,credit,disposition:line.disposition});
  }
  const amount=C.exact.checked(requested.reduce((sum,l)=>sum+BigInt(l.credit),0n));if(!amount)throw new ApiError(422,'Refund must have a positive money value');
  const [[collected]]=await conn.query('SELECT COALESCE(SUM(amount),0) AS amount FROM customer_payments WHERE store_id=? AND invoice_id=?',[ctx.storeId,invoice.id]);
  const [[refunded]]=await conn.query("SELECT COALESCE(SUM(amount_minor),0) AS amount FROM refund_notes WHERE store_id=? AND invoice_id=? AND status='completed'",[ctx.storeId,invoice.id]);
  if(BigInt(amount)+BigInt(refunded.amount)>BigInt(minor(collected.amount)))throw new ApiError(409,'Refund exceeds money actually collected');
  if(!Array.isArray(body.payments)||!body.payments.length||body.payments.length>10)throw new ApiError(422,'Refund payment routing required');
  const routes=body.payments.map(p=>({...p,amount_minor:C.exact.integer(p.amount_minor,'amount_minor',true)}));
  if(routes.reduce((s,p)=>s+BigInt(p.amount_minor),0n)!==BigInt(amount))throw new ApiError(422,'Refund tenders must equal original net return value');
  const [[checkout]]=await conn.query('SELECT * FROM checkout_sessions WHERE store_id=? AND invoice_id=?',[ctx.storeId,invoice.id]);
  let shift=null;
  const originals=new Map();
  for(const p of routes) {
    C.choice(p.method,['cash','card','bank_transfer','wallet'],'refund tender');
    if(p.method==='cash') {
      const registerId=body.register_id || invoice.register_id;if(!registerId)throw new ApiError(422,'Cash refund requires register_id');
      const register=await C.row(conn,'registers',ctx.storeId,registerId);ctx={...ctx,registerId:register.id};shift=await M.openShiftFor(conn,ctx,register.id);
    }
    if(checkout) {
      const payment=await C.row(conn,'checkout_payments',ctx.storeId,p.original_payment_id,true);
      if(payment.checkout_id!==checkout.id||payment.method!==p.method||!['captured','partially_refunded'].includes(payment.status))throw new ApiError(422,'Refund must route to an original captured payment');
      const used=(originals.get(payment.id)?.used || 0)+p.amount_minor;
      if(BigInt(used)+BigInt(payment.refunded_minor)>BigInt(payment.amount_minor))throw new ApiError(409,'Refund exceeds remaining original tender');originals.set(payment.id,{payment,used});
    } else {
      // Historical recorded tenders remain supported; never invent a card capture.
      const method={cash:'Cash',card:'Card',bank_transfer:'Bank Transfer',wallet:'Online'}[p.method];
      const [[paid]]=await conn.query('SELECT COALESCE(SUM(amount),0) AS amount FROM customer_payments WHERE store_id=? AND invoice_id=? AND payment_method=?',[ctx.storeId,invoice.id,method]);
      const [[prior]]=await conn.query("SELECT COALESCE(SUM(p.amount_minor),0) AS amount FROM refund_payments p JOIN refund_notes n ON n.id=p.refund_id WHERE p.store_id=? AND n.invoice_id=? AND p.method=? AND p.status='completed'",[ctx.storeId,invoice.id,p.method]);
      const requestedMethod=routes.filter(r=>r.method===p.method).reduce((s,r)=>s+BigInt(r.amount_minor),0n);
      if(requestedMethod+BigInt(prior.amount)>BigInt(minor(paid.amount)))throw new ApiError(409,'Refund exceeds original recorded tender');
    }
  }
  const items=await C.lockItems(conn,ctx,requested.map(l=>l.source.item_id),true);
  const legacy=await C.insert(conn,'sale_returns',{store_id:ctx.storeId,sale_invoice_id:invoice.id,customer_id:invoice.customer_id,return_date:new Date(),total_amount:C.exact.decimal(amount),reason});
  const refundId=await C.insert(conn,'refund_notes',{store_id:ctx.storeId,number:`RF-${crypto.randomUUID()}`,amount_minor:amount,reason,status:'completed',idempotency_key:C.hash(key),invoice_id:invoice.id,legacy_return_id:legacy,exchange_checkout_id:body.exchange_checkout_id || null,created_by:ctx.id});
  for(const line of requested) {
    await C.insert(conn,'refund_lines',{store_id:ctx.storeId,refund_id:refundId,invoice_line_id:line.source.id,item_id:line.source.item_id,quantity:C.exact.decimal(line.qty),credit_minor:line.credit,disposition:line.disposition});
    await C.insert(conn,'sale_return_items',{store_id:ctx.storeId,sale_return_id:legacy,item_id:line.source.item_id,qty:C.exact.decimal(line.qty),price:C.exact.decimal((BigInt(line.credit)*100n+line.qty/2n)/line.qty),total:C.exact.decimal(line.credit)});
  }
  const restock=new Map();for(const line of requested.filter(l=>l.disposition==='restock'))restock.set(line.source.item_id,(restock.get(line.source.item_id)||0n)+line.qty);
  for(const [itemId,qty] of [...restock].sort((a,b)=>a[0]-b[0]))await C.stock(conn,ctx,items.get(itemId),invoice.business_unit_id,qty,'REFUND',refundId,reason);
  for(let index=0;index<routes.length;index++) {
    const p=routes[index];await C.insert(conn,'refund_payments',{store_id:ctx.storeId,refund_id:refundId,original_payment_id:checkout?p.original_payment_id:null,shift_id:p.method==='cash'?shift.id:null,amount_minor:p.amount_minor,method:p.method,status:'completed',provider_reference:p.method==='cash'?null:`${checkout?'sandbox-or-recorded':'recorded'}-refund-${refundId}-${index}`,idempotency_key:C.hash(`${key}:${index}`)});
    if(p.method==='cash')await M.movement(conn,ctx,shift,'refund',p.amount_minor,`refund:${refundId}:${index}`,reason,'REFUND',refundId);
  }
  for(const {payment,used} of originals.values())await conn.query("UPDATE checkout_payments SET refunded_minor=refunded_minor+?,status=IF(refunded_minor=amount_minor,'refunded','partially_refunded') WHERE id=?",[used,payment.id]);
  await C.audit(conn,ctx,'refund.complete','refund',refundId,reason,{amount_minor:amount,invoice_id:invoice.id});
  await C.notify(conn,ctx,'refund','Refund completed',`${invoice.receipt_no}: ${amount} minor units`,`refund:${refundId}`,'info');
  return {refund_id:refundId,invoice_id:invoice.id,amount_minor:amount};
}
async function refund(ctx,body,key) { C.role(ctx,['owner','manager']);return C.transaction(ctx,'refund.complete',key,body,(conn,k)=>refundInTransaction(conn,ctx,body,k)); }
async function exchange(ctx,body,key) {
  C.role(ctx,['owner','manager']);
  return C.transaction(ctx,'exchange.complete',key,body,async(conn,k)=>{
    const replacement=await C.row(conn,'checkout_sessions',ctx.storeId,body.checkout_id,true);
    if(replacement.status!=='draft'||replacement.booking_id)throw new ApiError(409,'Exchange requires a fresh replacement cart');
    require('./checkout.service').checkoutAccess(ctx,replacement);
    const [[payments]]=await conn.query("SELECT COUNT(*) AS n FROM checkout_payments WHERE store_id=? AND checkout_id=? AND status IN ('captured','pending','awaiting_customer')",[ctx.storeId,replacement.id]);if(payments.n)throw new ApiError(409,'Replacement cart already has payments');
    if(!body.refund||!Array.isArray(body.refund.payments)||body.refund.payments.some(p=>p.method!=='cash'))throw new ApiError(422,'This recorded exchange workflow requires original cash tender');
    const returned=await refundInTransaction(conn,ctx,{...body.refund,register_id:replacement.register_id,exchange_checkout_id:replacement.id},`exchange:${k}`);
    const difference=BigInt(replacement.total_minor)-BigInt(returned.amount_minor);
    const tendered=C.exact.integer(body.tendered_difference_minor || 0);
    if((difference>0n&&BigInt(tendered)<difference)||(difference<=0n&&tendered!==0))throw new ApiError(422,'Tender only the positive exchange difference');
    const shift=await M.openShiftFor(conn,ctx,replacement.register_id);
    if(Number(replacement.total_minor)>0)await C.insert(conn,'checkout_payments',{store_id:ctx.storeId,checkout_id:replacement.id,public_id:crypto.randomUUID(),method:'cash',status:'captured',amount_minor:replacement.total_minor,tendered_minor:replacement.total_minor,recorded_by:ctx.id,idempotency_key:C.hash(`exchange-sale:${k}`),captured_at:new Date()});
    await conn.query("UPDATE checkout_sessions SET status='pending_payment',shift_id=? WHERE id=?",[shift.id,replacement.id]);
    const completed=await require('./checkout.service').completeInTransaction(conn,ctx,replacement.id);
    await C.audit(conn,{...ctx,registerId:replacement.register_id},'exchange.complete','refund',returned.refund_id,'Linked cash exchange settled',{difference_minor:String(difference)});
    return {...completed,refund_id:returned.refund_id,difference_minor:String(difference),change_minor:difference>0n?String(BigInt(tendered)-difference):String(-difference)};
  });
}
module.exports={refund,refundInTransaction,exchange};
