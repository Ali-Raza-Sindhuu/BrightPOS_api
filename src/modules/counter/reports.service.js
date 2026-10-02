const ApiError=require('../../utils/api-error');
const C=require('./counter-core');
function dateBoundary(date,timeZone) {
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date)throw new ApiError(422,'Invalid report date');
  const target=Date.parse(`${date}T00:00:00Z`);let value=target;
  const formatter=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  for(let i=0;i<4;i++) {
    const parts=Object.fromEntries(formatter.formatToParts(new Date(value)).map(p=>[p.type,p.value]));
    const local=Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);const next=value+target-local;if(next===value)break;value=next;
  }
  return new Date(value);
}
async function report(ctx,query) {
  C.role(ctx,['owner','manager']);
  const [[store]]=await ctx.pool.query('SELECT timezone FROM stores WHERE id=?',[ctx.storeId]);
  const from=dateBoundary(query.from,store.timezone);dateBoundary(query.to,store.timezone);
  const next=new Date(`${query.to}T00:00:00Z`);next.setUTCDate(next.getUTCDate()+1);
  const to=dateBoundary(next.toISOString().slice(0,10),store.timezone);if(to<=from||to-from>367*86400000)throw new ApiError(422,'Report range must be ordered and no longer than a year');
  const register=query.register_id?require('../../utils/validation').id(query.register_id):null;
  const params=[ctx.storeId,from,to,...(register?[register]:[])];const registerFilter=register?' AND register_id=?':'';
  const [sales]=await ctx.pool.query(`SELECT cashier_id,register_id,shift_id,COUNT(*) AS invoices,SUM(payable) AS gross_collected FROM sale_invoices WHERE store_id=? AND created_at>=? AND created_at<?${registerFilter} GROUP BY cashier_id,register_id,shift_id ORDER BY register_id,cashier_id`,params);
  const [tenders]=await ctx.pool.query(`SELECT p.method,SUM(p.amount_minor) AS captured_minor,SUM(p.change_minor) AS change_minor FROM checkout_payments p JOIN checkout_sessions c ON c.id=p.checkout_id AND c.store_id=p.store_id WHERE p.store_id=? AND c.completed_at>=? AND c.completed_at<? AND c.status='completed'${register?' AND c.register_id=?':''} AND p.status IN ('captured','partially_refunded','refunded') GROUP BY p.method`,params);
  const [refunds]=await ctx.pool.query(`SELECT p.method,SUM(p.amount_minor) AS refunded_minor FROM refund_payments p JOIN refund_notes n ON n.id=p.refund_id AND n.store_id=p.store_id JOIN sale_invoices i ON i.id=n.invoice_id AND i.store_id=n.store_id WHERE p.store_id=? AND n.created_at>=? AND n.created_at<? AND p.status='completed'${register?' AND i.register_id=?':''} GROUP BY p.method`,params);
  const [shifts]=await ctx.pool.query(`SELECT id,register_id,opened_by,status,opening_float_minor,expected_close_minor,closing_count_minor,variance_minor FROM register_shifts WHERE store_id=? AND opened_at>=? AND opened_at<?${registerFilter} ORDER BY id`,params);
  const [[margin]]=await ctx.pool.query(`SELECT CAST(COALESCE(SUM(l.total_price-IF(i.register_id IS NULL,COALESCE(l.discount_minor,0)/100,0)),0) AS DECIMAL(18,2)) AS line_revenue,COALESCE(SUM(l.qty*l.cost_price_minor),0) AS cost_minor,COUNT(*)-COUNT(l.cost_price_minor) AS lines_without_cost FROM sale_invoice_items l JOIN sale_invoices i ON i.id=l.invoice_id AND i.store_id=l.store_id WHERE l.store_id=? AND i.created_at>=? AND i.created_at<?${register?' AND i.register_id=?':''}`,params);
  const revenue=require('../../utils/money').minor(margin.line_revenue);const cost=C.exact.scaled(margin.cost_minor,2)/100n;
  return {timezone:store.timezone,from:from.toISOString(),to_exclusive:to.toISOString(),sales,tenders,refunds,shifts,estimated_margin:{sale_line_revenue_minor:revenue,cost_minor:String(cost),gross_margin_minor:String(BigInt(revenue)-cost),lines_without_cost:Number(margin.lines_without_cost),scope:'Sale lines with stored cost; refunds and overhead excluded'}};
}
async function reconcile(ctx) {
  C.role(ctx,['owner','manager','inventory_clerk']);
  const [rows]=await ctx.pool.query('SELECT v.item_id,v.business_unit_id,v.quantity AS balance,COALESCE(m.quantity,0) AS ledger_quantity,v.quantity-COALESCE(m.quantity,0) AS difference FROM inventory v LEFT JOIN (SELECT store_id,item_id,business_unit_id,SUM(qty) AS quantity FROM item_stock GROUP BY store_id,item_id,business_unit_id) m ON m.store_id=v.store_id AND m.item_id=v.item_id AND m.business_unit_id=v.business_unit_id WHERE v.store_id=? AND ABS(v.quantity-COALESCE(m.quantity,0))>0.000001 ORDER BY v.item_id LIMIT 500',[ctx.storeId]);
  return {differences:rows,automatic_repairs:false};
}
async function exportCsv(ctx,query) {
  const data=await report(ctx,query),cell=require('./catalog.service').cell;
  const rows=[['section','field','value']];
  for(const section of ['sales','tenders','refunds','shifts'])data[section].forEach((record,index)=>Object.entries(record).forEach(([field,value])=>rows.push([`${section}:${index+1}`,field,value])));
  Object.entries(data.estimated_margin).forEach(([field,value])=>rows.push(['estimated_margin',field,value]));
  rows.push(['period','timezone',data.timezone],['period','from',data.from],['period','to_exclusive',data.to_exclusive]);
  return rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
module.exports={dateBoundary,report,reconcile,exportCsv};
