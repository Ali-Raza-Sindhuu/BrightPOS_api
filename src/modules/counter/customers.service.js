const ApiError=require('../../utils/api-error');
const C=require('./counter-core');
async function save(ctx,value,body,key) {
  C.role(ctx,['owner','manager','cashier']);
  const allowed=['customer_name','mobile_number','email','notes','marketing_consent','address'];
  if(Object.keys(body).some(k=>!allowed.includes(k)))throw new ApiError(422,'Unsupported customer field');
  return C.transaction(ctx,value?'customer.update':'customer.create',key,{value,...body},async conn=>{
    const current=value?await C.row(conn,'customers',ctx.storeId,value,true):{};
    const data={...current,...body};const name=C.text(data.customer_name,'customer_name',150);
    if(data.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))throw new ApiError(422,'Invalid customer email');
    const fields={customer_name:name,mobile_number:data.mobile_number?C.text(data.mobile_number,'mobile_number',20):null,email:data.email || null,notes:data.notes?C.text(data.notes,'notes',2000):null,address:data.address?C.text(data.address,'address',1000):null,marketing_consent:data.marketing_consent===true||data.marketing_consent===1?1:0};
    if(body.marketing_consent!==undefined&&![true,false,0,1].includes(body.marketing_consent))throw new ApiError(422,'Consent must be boolean');
    let customerId=value;
    if(value)await conn.query(`UPDATE customers SET ${Object.keys(fields).map(k=>`${k}=?`).join(',')} WHERE id=? AND store_id=?`,[...Object.values(fields),value,ctx.storeId]);
    else customerId=await C.insert(conn,'customers',{store_id:ctx.storeId,...fields});
    await C.audit(conn,ctx,value?'customer.update':'customer.create','customer',customerId,'Customer profile saved',{fields:Object.keys(body)});return C.row(conn,'customers',ctx.storeId,customerId);
  });
}
async function history(ctx,value) {
  C.role(ctx,['owner','manager','cashier']);const customer=await C.row(ctx.pool,'customers',ctx.storeId,value);
  const [invoices]=await ctx.pool.query('SELECT id,receipt_no,payable,created_at FROM sale_invoices WHERE store_id=? AND customer_id=? ORDER BY id DESC LIMIT 200',[ctx.storeId,customer.id]);
  const [refunds]=await ctx.pool.query('SELECT n.* FROM refund_notes n JOIN sale_invoices i ON i.id=n.invoice_id AND i.store_id=n.store_id WHERE n.store_id=? AND i.customer_id=? ORDER BY n.id DESC LIMIT 200',[ctx.storeId,customer.id]);
  const [bookings]=await ctx.pool.query('SELECT b.*,d.size,d.flavour,d.cake_message,d.pickup_at,d.preparation_status FROM bookings b LEFT JOIN bakery_order_details d ON d.booking_id=b.id AND d.store_id=b.store_id WHERE b.store_id=? AND b.customer_id=? ORDER BY b.id DESC LIMIT 200',[ctx.storeId,customer.id]);
  return {customer,invoices,refunds,bookings};
}
module.exports={save,history};
