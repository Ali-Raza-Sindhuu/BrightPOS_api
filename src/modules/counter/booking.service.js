const crypto=require('node:crypto');
const ApiError=require('../../utils/api-error');
const {minor}=require('../../utils/money');
const C=require('./counter-core');
const M=require('./management.service');
async function create(ctx,body,key) {
  C.role(ctx,['owner','manager','cashier']);
  return C.transaction(ctx,'booking.create',key,body,async conn=>{
    const register=await C.row(conn,'registers',ctx.storeId,body.register_id);if(!register.is_active)throw new ApiError(409,'Register inactive');
    const customer=await C.row(conn,'customers',ctx.storeId,body.customer_id);
    if(!Array.isArray(body.lines)||!body.lines.length||body.lines.length>100)throw new ApiError(422,'Booking lines required');
    const items=await C.lockItems(conn,ctx,body.lines.map(l=>l.item_id));
    const lines=body.lines.map(l=>{const item=items.get(Number(l.item_id)),qty=C.exact.scaled(l.quantity);if(!qty)throw new ApiError(422,'Positive quantity required');return {item_id:item.id,qty:C.exact.decimal(qty),unit_price:item.sale_price,total_price:C.exact.decimal(C.exact.multiply(minor(item.sale_price),C.exact.decimal(qty)))};});
    const subtotal=C.exact.checked(lines.reduce((s,l)=>s+BigInt(minor(l.total_price)),0n));
    const value=await C.insert(conn,'bookings',{store_id:ctx.storeId,business_unit_id:register.business_unit_id,customer_id:customer.id,booking_date:new Date(),sub_total:C.exact.decimal(subtotal),payable:C.exact.decimal(subtotal),paid:'0.00',to_be_paid:C.exact.decimal(subtotal)});
    for(const l of lines)await C.insert(conn,'booking_items',{store_id:ctx.storeId,booking_id:value,...l});
    await C.audit(conn,{...ctx,registerId:register.id},'booking.create','booking',value,'Server-priced booking created');return C.row(conn,'bookings',ctx.storeId,value);
  });
}
async function deposit(ctx,value,body,key) {
  C.role(ctx,['owner','manager','cashier']);
  return C.transaction(ctx,'booking.deposit',key,{value,...body},async conn=>{
    const booking=await C.row(conn,'bookings',ctx.storeId,value,true);
    const [[converted]]=await conn.query('SELECT id FROM checkout_sessions WHERE store_id=? AND booking_id=?',[ctx.storeId,booking.id]);if(converted||booking.booking_status==='Rejected')throw new ApiError(409,'Booking cannot accept another deposit');
    const register=await C.row(conn,'registers',ctx.storeId,body.register_id);if(register.business_unit_id!==booking.business_unit_id)throw new ApiError(422,'Deposit register must belong to booking location');
    const shift=await M.openShiftFor(conn,ctx,register.id),amount=C.exact.integer(body.amount_minor,'amount_minor',true);
    const [[paid]]=await conn.query('SELECT COALESCE(SUM(amount),0) AS amount FROM booking_payments WHERE store_id=? AND booking_id=?',[ctx.storeId,booking.id]);
    const total=minor(paid.amount)+amount;if(total>minor(booking.payable))throw new ApiError(422,'Deposit exceeds booking balance');
    const payment=await C.insert(conn,'booking_payments',{store_id:ctx.storeId,booking_id:booking.id,customer_id:booking.customer_id,amount:C.exact.decimal(amount),payment_method:'cash',payment_date:new Date(),remarks:'Counter booking deposit'});
    await M.movement(conn,ctx,shift,'sale',amount,`deposit:${payment}`,'Booking deposit','BOOKING_PAYMENT',payment);
    await conn.query('UPDATE bookings SET paid=?,to_be_paid=?,payment_status=? WHERE id=?',[C.exact.decimal(total),C.exact.decimal(minor(booking.payable)-total),total===minor(booking.payable)?'Paid':'Partial',booking.id]);
    await C.audit(conn,{...ctx,registerId:register.id},'booking.deposit','booking',booking.id,'Cash deposit recorded once',{amount_minor:amount});return {booking_id:booking.id,booking_payment_id:payment,paid_minor:total};
  });
}
async function convert(ctx,value,body,key) {
  C.role(ctx,['owner','manager','cashier']);
  return C.transaction(ctx,'booking.convert',key,{value,...body},async conn=>{
    const booking=await C.row(conn,'bookings',ctx.storeId,value,true);if(booking.booking_status==='Rejected')throw new ApiError(409,'Booking rejected');
    const [[link]]=await conn.query('SELECT invoice_id FROM booking_invoice_links WHERE store_id=? AND booking_id=?',[ctx.storeId,booking.id]);if(link)return {invoice_id:link.invoice_id,booking_id:booking.id};
    const [[existing]]=await conn.query('SELECT id FROM checkout_sessions WHERE store_id=? AND booking_id=?',[ctx.storeId,booking.id]);if(existing)return {checkout_id:existing.id,booking_id:booking.id};
    const register=await C.row(conn,'registers',ctx.storeId,body.register_id);if(!register.is_active||register.business_unit_id!==booking.business_unit_id)throw new ApiError(422,'Booking register/location mismatch');
    const [lines]=await conn.query('SELECT * FROM booking_items WHERE store_id=? AND booking_id=? ORDER BY id',[ctx.storeId,booking.id]);if(!lines.length)throw new ApiError(422,'Booking has no lines');
    const items=await C.lockItems(conn,ctx,lines.map(l=>l.item_id));
    const weights=lines.map(l=>minor(l.total_price)),subtotal=weights.reduce((s,x)=>s+x,0),total=minor(booking.payable);if(total>subtotal)throw new ApiError(409,'Booking totals require reconciliation');
    const discounts=C.exact.allocate(subtotal-total,weights);
    const checkout=await C.insert(conn,'checkout_sessions',{store_id:ctx.storeId,public_id:crypto.randomUUID(),booking_id:booking.id,register_id:register.id,cashier_id:ctx.id,customer_id:booking.customer_id,subtotal_minor:subtotal,discount_minor:subtotal-total,total_minor:total});
    for(let i=0;i<lines.length;i++)await C.insert(conn,'checkout_lines',{store_id:ctx.storeId,checkout_id:checkout,item_id:lines[i].item_id,quantity:lines[i].qty,unit_price_minor:minor(lines[i].unit_price),cost_price_minor:minor(items.get(lines[i].item_id).purchase_price),discount_minor:discounts[i],total_minor:weights[i]-discounts[i]});
    const [payments]=await conn.query('SELECT * FROM booking_payments WHERE store_id=? AND booking_id=? ORDER BY id',[ctx.storeId,booking.id]);
    for(const p of payments) {
      if(p.payment_method!=='cash')throw new ApiError(409,'Noncash legacy deposit requires recorded-tender reconciliation before counter conversion');
      await C.insert(conn,'checkout_payments',{store_id:ctx.storeId,checkout_id:checkout,public_id:crypto.randomUUID(),method:'cash',status:'captured',amount_minor:minor(p.amount),recorded_by:ctx.id,idempotency_key:`booking-${p.id}`,provider_reference:`booking-advance-${p.id}`,captured_at:p.payment_date});
    }
    if(payments.length)await conn.query("UPDATE checkout_sessions SET status='pending_payment' WHERE id=?",[checkout]);
    await C.audit(conn,{...ctx,registerId:register.id},'booking.convert','booking',booking.id,'Deposit linked to one checkout');return {checkout_id:checkout,booking_id:booking.id};
  });
}
module.exports={create,deposit,convert};
