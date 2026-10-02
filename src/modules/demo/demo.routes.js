const router=require('express').Router();
const asyncHandler=require('../../utils/async-handler');
const ApiError=require('../../utils/api-error');
const service=require('./demo.service');
const checkout=require('../counter/checkout.service');
const C=require('../counter/counter-core');
const apiContract=require('../counter/api-contract');
const key=req=>req.get('Idempotency-Key');
const contract=[{method:'post',path:'/start'}];
router.post('/start',asyncHandler(async(req,res)=>{const body=req.body===undefined?{}:req.body;apiContract.validate(apiContract.bodySchema('/demo','post','/start'),body);await require('../../middleware/login-limit').consumeLoginAttempt(req.ip,'demo:start',service.getPool());res.status(201).json({success:true,data:await service.start(body)});}));
router.use(asyncHandler(async(req,res,next)=>{const [scheme,token]=(req.get('Authorization') || '').split(' ');if(scheme!=='Bearer')throw new ApiError(401,'Demo bearer token required');req.demo=await service.authenticate(token);next();}));
function route(method,path,fn){contract.push({method,path});router[method](path,asyncHandler(async(req,res)=>{const schema=apiContract.bodySchema('/demo',method,path);if(schema)apiContract.validate(schema,req.body===undefined?{}:req.body);res.json({success:true,data:await fn(req)});}));}
route('get','/session',async req=>{const [[provider]]=await req.demo.pool.query('SELECT id FROM payment_providers WHERE store_id=? AND is_enabled=1 LIMIT 1',[req.demo.storeId]);return {scenario:req.demo.session.scenario,store_id:req.demo.storeId,register_id:req.demo.registerId,provider_id:provider?.id || null,sandbox:true,expires_at:req.demo.session.expires_at};});
route('post','/restart',async req=>{await require('../../middleware/login-limit').consumeLoginAttempt(req.ip,'demo:start',req.demo.pool);return service.restart(req.demo);});
route('get','/catalog',req=>require('../counter/catalog.service').search(req.demo,req.query));
route('get','/checkouts',async req=>{const [rows]=await req.demo.pool.query('SELECT * FROM checkout_sessions WHERE store_id=? ORDER BY id DESC LIMIT 50',[req.demo.storeId]);return {rows};});
route('post','/checkouts',req=>checkout.create(req.demo,{...req.body,register_id:req.demo.registerId},key(req)));
route('get','/checkouts/:id',req=>checkout.get(req.demo,req.params.id));
route('patch','/checkouts/:id',req=>checkout.patch(req.demo,req.params.id,req.body,key(req)));
route('post','/checkouts/:id/state',req=>checkout.transition(req.demo,req.params.id,req.body,key(req)));
route('post','/checkouts/:id/payments',req=>checkout.payment(req.demo,req.params.id,req.body,key(req)));
route('post','/checkouts/:id/complete',req=>checkout.complete(req.demo,req.params.id,req.body,key(req)));
route('post','/payments/:id/confirm',req=>checkout.confirm(req.demo,req.params.id,req.body,key(req)));
route('post','/payments/:id/cancel',req=>checkout.cancelPayment(req.demo,req.params.id,req.body,key(req)));
route('get','/receipts/:id',req=>checkout.receipt(req.demo,req.params.id));
route('post','/refunds',req=>require('../counter/refund.service').refund(req.demo,{...req.body,register_id:req.demo.registerId},key(req)));
route('get','/stock',async req=>{const [rows]=await req.demo.pool.query('SELECT v.item_id,i.item_name,v.quantity FROM inventory v JOIN item_details i ON i.id=v.item_id WHERE v.store_id=? ORDER BY v.item_id',[req.demo.storeId]);return {rows};});
route('get','/shift',async req=>{const [rows]=await req.demo.pool.query('SELECT * FROM register_shifts WHERE store_id=? AND register_id=? ORDER BY id DESC',[req.demo.storeId,req.demo.registerId]);return {rows};});
route('post','/shift/close',req=>require('../counter/management.service').closeShift(req.demo,req.body.shift_id,req.body,key(req)));
route('get','/reports',req=>require('../counter/reports.service').report(req.demo,req.query));
route('get','/customers',async req=>{const [rows]=await req.demo.pool.query('SELECT id,customer_name FROM customers WHERE store_id=?',[req.demo.storeId]);return {rows};});
route('get','/bakery-orders',async req=>{const [rows]=await req.demo.pool.query('SELECT * FROM bakery_order_details WHERE store_id=? ORDER BY id',[req.demo.storeId]);return {rows};});
route('post','/bakery-orders/:id',req=>require('../counter/stock-bakery.service').bakeryOrder(req.demo,req.params.id,req.body,key(req)));
route('post','/bookings/:id/deposits',req=>require('../counter/booking.service').deposit(req.demo,req.params.id,{...req.body,register_id:req.demo.registerId},key(req)));
route('post','/bookings/:id/convert',req=>require('../counter/booking.service').convert(req.demo,req.params.id,{register_id:req.demo.registerId},key(req)));
// No staff, settings, provider configuration, uploads, legacy APIs or arbitrary
// reset routes are mounted for a visitor.
module.exports=router;
module.exports.contract=contract;
