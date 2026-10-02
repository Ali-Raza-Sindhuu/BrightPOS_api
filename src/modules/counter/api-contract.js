const object=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const str={type:'string',minLength:1,maxLength:500};
const id={type:'integer',minimum:1};
const amount={type:'integer',minimum:0,maximum:999999999999};
const qty={type:['string','number'],description:'Positive decimal, maximum two fractional places; recipe quantities support six places'};
const bool={type:'boolean'};
const array=item=>({type:'array',minItems:1,maxItems:200,items:item});
const line=object({item_id:id,quantity:qty,unit_price_minor:amount,notes:str},['item_id','quantity']);
const refundLine=object({invoice_line_id:id,quantity:qty,disposition:{enum:['restock','write_off']}},['invoice_line_id','quantity','disposition']);
const refundTender=object({method:{enum:['cash','card','bank_transfer','wallet']},amount_minor:amount,original_payment_id:id},['method','amount_minor']);
const refund=object({invoice_id:id,register_id:id,reason:str,lines:array(refundLine),payments:array(refundTender),approval_token:str},['invoice_id','reason','lines','payments']);
const bodies={
  'patch /settings':object({revision:id,return_window_days:amount,cashier_discount_percent:qty,manager_discount_percent:qty,approval_threshold_minor:amount,low_stock_threshold:qty,cash_rounding_increment_minor:id,receipt_header:{type:['string','null'],maxLength:500},receipt_footer:{type:['string','null'],maxLength:500},enabled_payment_methods:{type:'array',items:{enum:['cash','card','bank_transfer','wallet']}},notification_preferences:{type:'object'},allow_return_window_override:{type:['integer','boolean']},session_timeout_minutes:id,store:object({name:str,timezone:str})},['revision']),
  'post /staff':object({user_id:id,role:{enum:['owner','manager','cashier','inventory_clerk']},pin:{type:'string',pattern:'^[0-9]{4,8}$'},is_active:bool},['user_id','role']),
  'post /staff/switch':object({user_id:id,pin:{type:'string',pattern:'^[0-9]{4,8}$'}},['user_id','pin']),
  'post /approvals':object({requested_by:id,action:{enum:['checkout.discount','checkout.price','refund.window']},entity_id:id,payload:{type:'object'},limit_minor:amount},['requested_by','action','entity_id','payload']),
  'post /registers':object({name:str,code:str,business_unit_id:id},['name','code','business_unit_id']),
  'post /shifts':object({register_id:id,opening_float_minor:amount},['register_id']),
  'post /shifts/:id/close':object({closing_count_minor:amount,reason:str},['closing_count_minor','reason']),
  'post /cash-movements':object({shift_id:id,kind:{enum:['paid_in','paid_out','safe_drop']},amount_minor:amount,reason:str},['shift_id','kind','amount_minor','reason']),
  'post /checkouts':object({register_id:id,customer_id:{type:['integer','null'],minimum:1}},['register_id']),
  'patch /checkouts/:id':object({revision:id,lines:array(line),discount_minor:amount,coupon_code:str,customer_id:{type:['integer','null'],minimum:1},notes:str,approval_token:str,price_approval_token:str,cash_rounding:bool},['revision','lines']),
  'post /checkouts/:id/state':object({status:{enum:['held','draft','voided']},held_name:str,reason:str},['status']),
  'post /checkouts/:id/payments':object({method:{enum:['cash','card','bank_transfer','wallet']},amount_minor:amount,tendered_minor:amount,provider_id:id,reference:str,scenario:{enum:['success','pending','fail']}},['method','amount_minor']),
  'post /checkouts/:id/complete':object({}),
  'post /payments/:id/confirm':object({outcome:{enum:['captured','failed','cancelled']}},['outcome']),
  'post /payments/:id/cancel':object({reason:str,reversal_reference:str},['reason']),
  'post /payment-providers':object({code:str,method:{enum:['card','bank_transfer','wallet']},mode:{enum:['recorded','sandbox']},is_enabled:bool},['code','method','mode']),
  'post /receipts/:id/reprint':object({reason:str},['reason']),
  'post /refunds':refund,
  'post /exchanges':object({checkout_id:id,tendered_difference_minor:amount,refund},['checkout_id','refund']),
  'post /stock-adjustments':object({business_unit_id:id,reason:{enum:['damage','waste','theft','count_correction','received']},notes:str,lines:array(object({item_id:id,quantity_delta:qty},['item_id','quantity_delta']))},['business_unit_id','reason','notes','lines']),
  'post /catalog/variants':object({item_name:str,sku:str,barcode:str,unit_id:id,base_unit_code:{enum:['piece','g','kg','ml','l']},sale_price:qty,purchase_price:qty,kind:{enum:['retail','bakery','ingredient']},variant_options:{type:'object'},product_id:id},['item_name','sku','barcode','unit_id','base_unit_code','sale_price']),
  'post /catalog/import':object({csv:{type:'string',maxLength:500000},dry_run:bool},['csv','dry_run']),
  'post /customers':object({customer_name:str,mobile_number:str,email:{type:'string',maxLength:254},notes:str,address:str,marketing_consent:bool},['customer_name']),
  'patch /customers/:id':object({customer_name:str,mobile_number:str,email:{type:'string',maxLength:254},notes:str,address:str,marketing_consent:bool}),
  'post /coupons':object({code:str,discount_type:{enum:['percent','fixed']},discount_value:qty,minimum_spend_minor:amount,maximum_uses:id,valid_from:{type:'string',format:'date-time'},valid_until:{type:['string','null'],format:'date-time'}},['code','discount_type','discount_value','valid_from']),
  'post /recipes':object({output_item_id:id,name:str,yield_quantity:qty,yield_unit:str,ingredients:array(object({item_id:id,quantity:qty,unit_code:str},['item_id','quantity','unit_code']))},['output_item_id','name','yield_quantity','yield_unit','ingredients']),
  'post /production':object({recipe_id:id,business_unit_id:id,planned_yield:qty,actual_yield:qty,reason:str},['recipe_id','business_unit_id','planned_yield','actual_yield','reason']),
  'post /bakery-orders/:id':object({size:str,flavour:str,cake_message:str,instructions:str,pickup_at:{type:'string',format:'date-time'},preparation_status:{enum:['ordered','preparing','ready','collected','cancelled']}}),
  'post /bookings':object({register_id:id,customer_id:id,lines:array(line)},['register_id','customer_id','lines']),
  'post /bookings/:id/deposits':object({register_id:id,amount_minor:amount},['register_id','amount_minor']),
  'post /bookings/:id/convert':object({register_id:id},['register_id']),
  'post /offline/allocations':object({register_id:id,device_token:str,item_id:id,quantity:qty},['register_id','device_token','item_id','quantity']),
  'post /offline/allocations/:id/release':object({confirm_device_reconciled:bool,reason:str},['confirm_device_reconciled','reason']),
  'post /offline/sync':object({register_id:id,device_token:str,client_id:{type:'string',format:'uuid'},occurred_at:{type:'string',format:'date-time'},lines:array(object({item_id:id,allocation_id:id,quantity:qty,unit_price_minor:amount},['item_id','allocation_id','quantity','unit_price_minor'])),tendered_minor:amount},['register_id','device_token','client_id','occurred_at','lines','tendered_minor']),
  'post /offline/transactions/:id/discard':object({confirm_cash_and_goods_reconciled:bool,reason:str},['confirm_cash_and_goods_reconciled','reason']),
  'post /notifications/:id/read':object({}),
};
function validate(schema,value,path='body') {
  const ApiError=require('../../utils/api-error');
  if(schema.type){const types=Array.isArray(schema.type)?schema.type:[schema.type];const actual=value===null?'null':Array.isArray(value)?'array':typeof value;if(!types.some(type=>type==='integer'?typeof value==='number'&&Number.isSafeInteger(value):type===actual))throw new ApiError(422,`${path}: invalid type`);}
  if(schema.enum&&!schema.enum.includes(value))throw new ApiError(422,`${path}: invalid choice`);
  if(typeof value==='number'&&((schema.minimum!==undefined&&value<schema.minimum)||(schema.maximum!==undefined&&value>schema.maximum)))throw new ApiError(422,`${path}: out of range`);
  if(typeof value==='string'&&((schema.maxLength!==undefined&&value.length>schema.maxLength)||(schema.minLength!==undefined&&value.length<schema.minLength)||(schema.pattern&&!new RegExp(schema.pattern).test(value))))throw new ApiError(422,`${path}: invalid text`);
  if(Array.isArray(value)&&schema.items){if(value.length<(schema.minItems || 0)||value.length>(schema.maxItems || 1000))throw new ApiError(422,`${path}: invalid array length`);value.forEach((item,index)=>validate(schema.items,item,`${path}[${index}]`));}
  if(schema.properties&&value!==null){for(const field of schema.required || [])if(value[field]===undefined)throw new ApiError(422,`${path}.${field} is required`);for(const [field,item] of Object.entries(value)){if(!schema.properties[field]&&schema.additionalProperties===false)throw new ApiError(422,`${path}.${field} is unsupported`);if(schema.properties[field])validate(schema.properties[field],item,`${path}.${field}`);}}
}
function bodySchema(prefix,method,path) {
  let body=bodies[`${method} ${path}`];
  if(prefix==='/demo'&&path==='/start')body=object({scenario:{enum:['retail','bakery']}});
  if(prefix==='/demo'&&path==='/restart')body=object({});
  if(prefix==='/demo'&&body?.properties?.register_id){body={...body,properties:{...body.properties},required:(body.required || []).filter(field=>field!=='register_id')};delete body.properties.register_id;}
  if(prefix==='/demo'&&path==='/shift/close')body=object({shift_id:id,closing_count_minor:amount,reason:str},['shift_id','closing_count_minor','reason']);
  return body;
}
function spec(routes,demoRoutes=[]) {
  const paths={};
  for(const entry of [...routes.map(r=>({...r,prefix:'/counter'})),...demoRoutes.map(r=>({...r,prefix:'/demo'}))]){
    const path=entry.prefix+entry.path.replace(/:(\w+)/g,'{$1}');const method=entry.method;
    const parameters=[...entry.path.matchAll(/:(\w+)/g)].map(match=>({name:match[1],in:'path',required:true,schema:id}));
    const write=!['get','head'].includes(method);if(write&&!['/staff/switch','/start','/restart'].includes(entry.path))parameters.push({name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:1,maxLength:100}});
    const body=bodySchema(entry.prefix,method,entry.path);
    if(method==='get'&&['/reports','/reports/export'].includes(entry.path))parameters.push(...['from','to'].map(name=>({name,in:'query',required:true,schema:{type:'string',format:'date'}})),{name:'register_id',in:'query',schema:id});
    if(method==='get'&&entry.path==='/offline/state')parameters.push({name:'register_id',in:'query',required:true,schema:id},{name:'X-Register-Device',in:'header',required:true,schema:str});
    paths[path]||={};paths[path][method]={summary:`${method.toUpperCase()} ${entry.prefix}${entry.path}`,tags:[entry.prefix.slice(1)],security:entry.path==='/start'&&entry.prefix==='/demo'?[]:[{[entry.prefix==='/demo'?'DemoBearer':'BearerAuth']:[]}],parameters,...(entry.permission?{'x-permission':entry.permission}:{}),...(body?{requestBody:{required:true,content:{'application/json':{schema:body}}}}:{}),responses:{200:{description:'Success; JSON envelope success/data/message (CSV export returns text/csv)'},201:{description:'Demo session created'},401:{description:'Authentication required'},403:{description:'Permission or operational role denied'},404:{description:'Store-scoped record not found'},409:{description:'State, stock, concurrency or idempotency conflict'},422:{description:'Validation failed'},429:{description:'Rate/capacity limit'},503:{description:'Database or configured demo unavailable'}}};
  }
  return {openapi:'3.1.0',info:{title:'BrightPOS counter and isolated demo API',version:'1.0.0',description:'Backend phase contract. Existing compatibility APIs retain their /api prefixes. Money uses integer minor units; writes require stable idempotency keys. Demo tokens work only under /api/demo. No real payment network is called.'},servers:[{url:'/api'}],paths,components:{securitySchemes:{BearerAuth:{type:'http',scheme:'bearer',bearerFormat:'JWT'},DemoBearer:{type:'http',scheme:'bearer',description:'Opaque isolated demo session token'}}}};
}
module.exports={bodies,validate,spec,bodySchema};
