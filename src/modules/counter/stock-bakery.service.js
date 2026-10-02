const ApiError=require('../../utils/api-error');
const {minor}=require('../../utils/money');
const C=require('./counter-core');
async function adjustment(ctx,body,key) {
  C.role(ctx,['owner','manager','inventory_clerk']);C.choice(body.reason,['damage','waste','theft','count_correction','received'],'adjustment reason');
  return C.transaction(ctx,'stock.adjust',key,body,async(conn,k)=>{
    const location=await C.row(conn,'business_units',ctx.storeId,body.business_unit_id);if(!location.is_active)throw new ApiError(409,'Location inactive');
    if(!Array.isArray(body.lines)||!body.lines.length||body.lines.length>200)throw new ApiError(422,'Adjustment lines required');
    const items=await C.lockItems(conn,ctx,body.lines.map(l=>l.item_id));
    if(items.size!==body.lines.length)throw new ApiError(422,'Duplicate adjustment items');
    const notes=C.text(body.notes,'adjustment notes');
    const value=await C.insert(conn,'stock_adjustments',{store_id:ctx.storeId,business_unit_id:location.id,created_by:ctx.id,reason:body.reason,notes,status:'posted',posted_at:new Date(),idempotency_key:C.hash(k)});
    for(const line of [...body.lines].sort((a,b)=>a.item_id-b.item_id)) {
      const qty=C.exact.scaled(line.quantity_delta,2,'quantity_delta',true);if(!qty)throw new ApiError(422,'Adjustment quantity cannot be zero');
      if(['damage','waste','theft'].includes(body.reason)&&qty>0n)throw new ApiError(422,'Loss adjustments must reduce stock');
      if(body.reason==='received'&&qty<0n)throw new ApiError(422,'Received adjustments must increase stock');
      const item=items.get(Number(line.item_id));
      await C.insert(conn,'stock_adjustment_lines',{store_id:ctx.storeId,adjustment_id:value,item_id:item.id,quantity_delta:C.exact.decimal(qty),cost_minor:minor(item.purchase_price)});
      await C.stock(conn,ctx,item,location.id,qty,'STOCK_ADJUSTMENT',value,notes);
    }
    await C.audit(conn,ctx,'stock.adjust','stock_adjustment',value,notes,{reason:body.reason});return C.row(conn,'stock_adjustments',ctx.storeId,value);
  });
}
const units={g:{dimension:'mass',factor:1n},kg:{dimension:'mass',factor:1000n},ml:{dimension:'volume',factor:1n},l:{dimension:'volume',factor:1000n},piece:{dimension:'count',factor:1n}};
function conversion(from,to) {
  if(!units[from]||!units[to]||units[from].dimension!==units[to].dimension)throw new ApiError(422,'Incompatible ingredient units');
  return C.exact.decimal(units[from].factor*1000000000n/units[to].factor,9);
}
async function recipe(ctx,body,key) {
  C.role(ctx,['owner','manager','inventory_clerk']);
  return C.transaction(ctx,'recipe.create',key,body,async conn=>{
    if(!Array.isArray(body.ingredients)||!body.ingredients.length||body.ingredients.length>100)throw new ApiError(422,'Recipe ingredients required');
    const items=await C.lockItems(conn,ctx,[body.output_item_id,...body.ingredients.map(l=>l.item_id)]);
    const output=items.get(Number(body.output_item_id));
    if(!output.base_unit_code||body.yield_unit!==output.base_unit_code)throw new ApiError(422,'Yield unit must match finished-product stock base unit');
    const yieldQty=C.exact.scaled(body.yield_quantity,6,'yield_quantity');if(!yieldQty)throw new ApiError(422,'Recipe yield must be positive');
    if(new Set(body.ingredients.map(l=>Number(l.item_id))).size!==body.ingredients.length||body.ingredients.some(l=>Number(l.item_id)===output.id))throw new ApiError(422,'Ingredients must be unique and differ from output');
    const [[latest]]=await conn.query('SELECT COALESCE(MAX(version),0) AS version FROM recipe_versions WHERE store_id=? AND output_item_id=?',[ctx.storeId,output.id]);
    const value=await C.insert(conn,'recipe_versions',{store_id:ctx.storeId,output_item_id:output.id,name:C.text(body.name,'recipe name',150),version:Number(latest.version)+1,yield_quantity:C.exact.decimal(yieldQty,6),yield_unit:body.yield_unit});
    for(const line of body.ingredients) {
      const item=items.get(Number(line.item_id)),qty=C.exact.scaled(line.quantity,6,'ingredient quantity');if(!qty)throw new ApiError(422,'Ingredient quantity must be positive');
      const factor=conversion(line.unit_code,item.base_unit_code);
      await C.insert(conn,'recipe_ingredients',{store_id:ctx.storeId,recipe_id:value,ingredient_item_id:item.id,quantity:C.exact.decimal(qty,6),unit_code:line.unit_code,to_stock_unit_factor:factor,cost_minor:minor(item.purchase_price)});
    }
    await C.audit(conn,ctx,'recipe.create','recipe',value,'Versioned recipe created');return C.row(conn,'recipe_versions',ctx.storeId,value);
  });
}
async function production(ctx,body,key) {
  C.role(ctx,['owner','manager','inventory_clerk']);
  return C.transaction(ctx,'production.complete',key,body,async(conn,k)=>{
    const recipe=await C.row(conn,'recipe_versions',ctx.storeId,body.recipe_id,true);if(!recipe.is_active)throw new ApiError(409,'Recipe inactive');
    const planned=C.exact.scaled(body.planned_yield),actual=C.exact.scaled(body.actual_yield);if(!planned)throw new ApiError(422,'Planned yield must be positive');
    await C.row(conn,'business_units',ctx.storeId,body.business_unit_id);
    const [ingredients]=await conn.query('SELECT * FROM recipe_ingredients WHERE store_id=? AND recipe_id=? ORDER BY ingredient_item_id',[ctx.storeId,recipe.id]);
    const items=await C.lockItems(conn,ctx,[recipe.output_item_id,...ingredients.map(l=>l.ingredient_item_id)]);
    const denominator=1000000000000000n*C.exact.scaled(recipe.yield_quantity,6);
    const inputs=ingredients.map(l=>{
      const numerator=C.exact.scaled(l.quantity,6)*C.exact.scaled(l.to_stock_unit_factor,9)*planned*1000000n;
      // planned is hundredths; output conversion yields stock hundredths.
      if(numerator%denominator)throw new ApiError(422,'Ingredient stock precision insufficient; use grams/ml as stock base units');
      const qty=numerator/denominator;if(!qty)throw new ApiError(422,'Ingredient consumption rounds to zero');
      const item=items.get(l.ingredient_item_id);
      if(conversion(l.unit_code,item.base_unit_code)!==l.to_stock_unit_factor)throw new ApiError(409,'Ingredient base unit changed; create a new recipe version');
      return {item,qty,unit:item.base_unit_code,cost:C.exact.multiply(minor(item.purchase_price),C.exact.decimal(qty))};
    });
    const totalCost=C.exact.checked(inputs.reduce((s,l)=>s+BigInt(l.cost),0n));
    const value=await C.insert(conn,'production_runs',{store_id:ctx.storeId,recipe_id:recipe.id,business_unit_id:body.business_unit_id,created_by:ctx.id,planned_yield:C.exact.decimal(planned),actual_yield:C.exact.decimal(actual),status:'completed',completed_at:new Date(),total_cost_minor:totalCost,idempotency_key:C.hash(k)});
    for(const input of inputs) {
      await C.stock(conn,ctx,input.item,body.business_unit_id,-input.qty,'PRODUCTION',value,'Recipe ingredient consumption');
      await C.insert(conn,'production_inputs',{store_id:ctx.storeId,production_id:value,item_id:input.item.id,consumed_quantity:C.exact.decimal(input.qty),unit_code:input.unit,cost_minor:input.cost});
    }
    if(actual) {
      const output=items.get(recipe.output_item_id);
      await C.stock(conn,ctx,output,body.business_unit_id,actual,'PRODUCTION',value,'Finished bakery yield');
      await C.insert(conn,'production_outputs',{store_id:ctx.storeId,production_id:value,item_id:output.id,produced_quantity:C.exact.decimal(actual),unit_code:recipe.yield_unit,cost_minor:totalCost});
    }
    const reason=C.text(body.reason,'production reason');await C.audit(conn,ctx,'production.complete','production',value,reason,{planned_yield:body.planned_yield,actual_yield:body.actual_yield,total_cost_minor:totalCost});
    if(actual<planned)await C.notify(conn,ctx,'production_waste','Production yield below plan',`Production ${value}: ${C.exact.decimal(planned-actual)} units below planned yield`,`production:${value}`);
    return C.row(conn,'production_runs',ctx.storeId,value);
  });
}
async function bakeryOrder(ctx,bookingId,body,key) {
  C.role(ctx,['owner','manager','cashier']);
  return C.transaction(ctx,'bakery.order',key,{bookingId,...body},async conn=>{
    const booking=await C.row(conn,'bookings',ctx.storeId,bookingId,true);
    const [[current]]=await conn.query('SELECT * FROM bakery_order_details WHERE store_id=? AND booking_id=? FOR UPDATE',[ctx.storeId,booking.id]);
    const status=body.preparation_status || current?.preparation_status || 'ordered';
    const transitions={ordered:['ordered','preparing','cancelled'],preparing:['preparing','ready','cancelled'],ready:['ready','collected'],collected:[],cancelled:[]};
    if(current&&!transitions[current.preparation_status].includes(status))throw new ApiError(409,'Invalid bakery preparation transition');
    if(!current&&status!=='ordered')throw new ApiError(422,'New bakery order starts ordered');
    if(status==='cancelled') {
      const [[posted]]=await conn.query('SELECT EXISTS(SELECT 1 FROM checkout_sessions WHERE store_id=? AND booking_id=?) OR EXISTS(SELECT 1 FROM booking_invoice_links WHERE store_id=? AND booking_id=?) AS linked',[ctx.storeId,booking.id,ctx.storeId,booking.id]);
      const [[paid]]=await conn.query('SELECT COALESCE(SUM(amount),0) AS amount FROM booking_payments WHERE store_id=? AND booking_id=?',[ctx.storeId,booking.id]);
      if(posted.linked||minor(paid.amount)>0)throw new ApiError(409,'Paid or converted order requires receipt settlement/refund before cancellation');
      await conn.query("UPDATE bookings SET booking_status='Rejected' WHERE id=?",[booking.id]);
    }
    if(status==='collected') {
      const [[link]]=await conn.query('SELECT invoice_id FROM booking_invoice_links WHERE store_id=? AND booking_id=?',[ctx.storeId,booking.id]);if(!link)throw new ApiError(409,'Convert booking to sale before handover');
      const invoice=await C.row(conn,'sale_invoices',ctx.storeId,link.invoice_id);
      const [[paid]]=await conn.query('SELECT COALESCE(SUM(amount),0) AS amount FROM customer_payments WHERE store_id=? AND invoice_id=?',[ctx.storeId,invoice.id]);
      const [[returned]]=await conn.query("SELECT COALESCE(SUM(amount_minor),0) AS amount FROM refund_notes WHERE store_id=? AND invoice_id=? AND status='completed'",[ctx.storeId,invoice.id]);
      if(minor(paid.amount)-Number(returned.amount)<minor(invoice.payable))throw new ApiError(409,'Settle balance and reconcile any refunds before bakery handover');
    }
    const pickup=body.pickup_at || current?.pickup_at;if(!pickup||!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d{3}Z|Z)?$/.test(pickup)||!Number.isFinite(Date.parse(pickup)))throw new ApiError(422,'Valid pickup timestamp required');
    const values={size:body.size ?? current?.size ?? null,flavour:body.flavour ?? current?.flavour ?? null,cake_message:body.cake_message ?? current?.cake_message ?? null,instructions:body.instructions ?? current?.instructions ?? null};
    for(const [field,max] of Object.entries({size:80,flavour:100,cake_message:255,instructions:2000}))if(values[field]!==null)values[field]=C.text(values[field],field,max);
    let value=current?.id;
    if(current)await conn.query('UPDATE bakery_order_details SET size=?,flavour=?,cake_message=?,instructions=?,pickup_at=?,preparation_status=?,handed_over_at=? WHERE id=?',[...Object.values(values),new Date(pickup),status,status==='collected'?new Date():null,current.id]);
    else value=await C.insert(conn,'bakery_order_details',{store_id:ctx.storeId,booking_id:booking.id,...values,pickup_at:new Date(pickup),preparation_status:status});
    await C.audit(conn,ctx,'bakery.order','booking',booking.id,'Bakery order updated',{status});return C.row(conn,'bakery_order_details',ctx.storeId,value);
  });
}
module.exports={adjustment,conversion,recipe,production,bakeryOrder};
