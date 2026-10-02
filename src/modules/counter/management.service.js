const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const ApiError = require('../../utils/api-error');
const { id } = require('../../utils/validation');
const { signToken, credentialVersion } = require('../../utils/jwt');
const C = require('./counter-core');
const roles = ['owner','manager','cashier','inventory_clerk'];
async function context(user, pool = require('../../config/db')) {
  const [[staff]] = await pool.query('SELECT s.*,u.store_id AS user_store FROM users u LEFT JOIN store_staff s ON s.user_id=u.id AND s.store_id=u.store_id WHERE u.id=?', [user.id]);
  if (!staff || (staff.user_id && !staff.is_active)) throw new ApiError(403, 'Staff access is inactive');
  return { id:user.id, storeId:staff.user_store, role:staff.role || (user.role === 'admin' ? 'owner' : 'unassigned'), pool, registerId:null };
}
async function getSettings(ctx) {
  C.role(ctx, roles);
  const [[store]] = await ctx.pool.query('SELECT * FROM stores WHERE id=?',[ctx.storeId]);
  return { store, settings:await C.settings(ctx.pool,ctx.storeId) };
}
async function updateSettings(ctx, body, key) {
  C.role(ctx,['owner']);
  const allowed = ['return_window_days','cashier_discount_percent','manager_discount_percent','approval_threshold_minor','low_stock_threshold','cash_rounding_increment_minor','receipt_header','receipt_footer','enabled_payment_methods','notification_preferences','allow_return_window_override','session_timeout_minutes'];
  if (Object.keys(body).some(k => ![...allowed,'revision','store'].includes(k))) throw new ApiError(422,'Unsupported settings field');
  return C.transaction(ctx,'settings.update',key,body,async conn => {
    const current = await C.settings(conn,ctx.storeId);
    if (C.exact.integer(body.revision,'revision',true) !== Number(current.revision)) throw new ApiError(409,'Settings changed; refresh before saving');
    const values = { ...current, ...body };
    for (const field of ['return_window_days','cash_rounding_increment_minor','session_timeout_minutes','approval_threshold_minor']) values[field] = C.exact.integer(values[field],field,field.includes('increment') || field.includes('timeout'));
    if (values.return_window_days > 365 || values.session_timeout_minutes > 1440) throw new ApiError(422,'Settings limit exceeded');
    const cashier = C.exact.scaled(values.cashier_discount_percent), manager = C.exact.scaled(values.manager_discount_percent);
    if (cashier > manager || manager > 10000n) throw new ApiError(422,'Invalid discount limits');
    C.exact.scaled(values.low_stock_threshold,6,'low_stock_threshold');
    if (![0,1,false,true].includes(values.allow_return_window_override)) throw new ApiError(422,'Invalid return override flag');
    if (!Array.isArray(values.enabled_payment_methods) || values.enabled_payment_methods.some(m => !['cash','card','bank_transfer','wallet'].includes(m))) throw new ApiError(422,'Invalid tender methods');
    if (!values.notification_preferences || typeof values.notification_preferences !== 'object' || Array.isArray(values.notification_preferences)) throw new ApiError(422,'Invalid notification preferences');
    for (const field of ['receipt_header','receipt_footer']) if (values[field] !== null && (typeof values[field] !== 'string' || values[field].length > 500)) throw new ApiError(422,'Receipt text too long');
    await conn.query(`UPDATE store_settings SET ${allowed.map(f=>`${f}=?`).join(',')},revision=revision+1 WHERE store_id=? AND revision=?`, [...allowed.map(f => ['enabled_payment_methods','notification_preferences'].includes(f) ? JSON.stringify(values[f]) : values[f]),ctx.storeId,current.revision]);
    if (body.store) {
      const { name, timezone } = body.store;
      if (Object.keys(body.store).some(k=>!['name','timezone'].includes(k))) throw new ApiError(422,'Unsupported store field');
      if (timezone) { try { new Intl.DateTimeFormat('en',{timeZone:timezone}); } catch { throw new ApiError(422,'Invalid timezone'); } }
      await conn.query('UPDATE stores SET name=COALESCE(?,name),timezone=COALESCE(?,timezone) WHERE id=?',[name ? C.text(name,'store name',150):null,timezone || null,ctx.storeId]);
    }
    await C.audit(conn,ctx,'settings.update','store',ctx.storeId,'Owner settings change',{ fields:Object.keys(body) });
    return { settings:await C.settings(conn,ctx.storeId) };
  });
}
const preset = role => [...new Set([...require('../../config/permission-catalog').flatMap(m=>m.permissions),...require('../../../database/seeds/base-permissions').map(p=>p.permissionKey)])].filter(p => role==='owner' || (role==='manager' && !/SECURITY|GROUPS|PERMISSIONS|USER_GROUPS|IP\./.test(p)) || (role==='cashier' && /ACCESS\.(ITEMS\.READ|SALES\.(READ|CREATE)|CUSTOMERS\.(READ|CREATE)|BOOKINGS\.(READ|CREATE|UPDATE)|DASHBOARD\.READ)$/.test(p)) || (role==='inventory_clerk' && /ACCESS\.(ITEMS\.(READ|CREATE|UPDATE)|STOCK\.(READ|CREATE|UPDATE)|PURCHASES\.(READ|CREATE|UPDATE)|SETUP\.READ)$/.test(p)));
async function assignStaff(ctx, body, key) {
  C.role(ctx,['owner']);
  const userId=id(body.user_id,'user_id'); C.choice(body.role,roles,'role');
  if (body.pin !== undefined && !/^\d{4,8}$/.test(String(body.pin))) throw new ApiError(422,'PIN requires 4 to 8 digits');
  const pinHash = body.pin === undefined ? null : await bcrypt.hash(String(body.pin),12);
  return C.transaction(ctx,'staff.assign',key,{...body,pin:body.pin ? C.hash(String(body.pin)):undefined},async conn => {
    await C.row(conn,'users',ctx.storeId,userId,true);
    if (userId === ctx.id && (body.role !== 'owner' || body.is_active === false)) throw new ApiError(409,'Cannot remove your own owner access');
    const [[group]] = await conn.query('SELECT id FROM access_groups WHERE store_id=? AND code=? FOR UPDATE',[ctx.storeId,`POS_${body.role.toUpperCase()}`]);
    const groupId = group?.id || await C.insert(conn,'access_groups',{store_id:ctx.storeId,code:`POS_${body.role.toUpperCase()}`,name:`POS ${body.role}`});
    for (const permission of preset(body.role)) {
      await conn.query('INSERT INTO permissions (permission_key,module) VALUES (?,?) ON DUPLICATE KEY UPDATE permission_key=VALUES(permission_key)',[permission,permission.split('.')[1]]);
      const [[p]] = await conn.query('SELECT id FROM permissions WHERE permission_key=?',[permission]);
      await conn.query("INSERT INTO group_permissions (store_id,group_id,permission_id,effect) VALUES (?,?,?,'ALLOW') ON DUPLICATE KEY UPDATE effect='ALLOW'",[ctx.storeId,groupId,p.id]);
    }
    await conn.query('UPDATE users SET group_id=? WHERE id=? AND store_id=?',[groupId,userId,ctx.storeId]);
    await conn.query('INSERT INTO store_staff (store_id,user_id,role,is_active) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE role=VALUES(role),is_active=VALUES(is_active)',[ctx.storeId,userId,body.role,body.is_active===false ? 0:1]);
    if (pinHash) await conn.query('INSERT INTO staff_credentials (store_id,user_id,pin_hash) VALUES (?,?,?) ON DUPLICATE KEY UPDATE pin_hash=VALUES(pin_hash),failed_pin_attempts=0,locked_until=NULL,credential_revision=credential_revision+1',[ctx.storeId,userId,pinHash]);
    await C.audit(conn,ctx,'staff.assign','user',userId,'Owner staff assignment',{role:body.role});
    return {user_id:userId,role:body.role,group_id:groupId};
  });
}
async function switchPin(ctx, body) {
  C.role(ctx,roles); const userId=id(body.user_id,'user_id');
  if (!/^\d{4,8}$/.test(String(body.pin))) throw new ApiError(401,'Invalid PIN');
  const conn=await ctx.pool.getConnection();let result;
  try {
    await conn.beginTransaction();
    const user=await C.row(conn,'users',ctx.storeId,userId,true);
    const [[staff]]=await conn.query('SELECT * FROM store_staff WHERE store_id=? AND user_id=?',[ctx.storeId,userId]);
    const [[credentials]]=await conn.query('SELECT *, locked_until>NOW() AS locked FROM staff_credentials WHERE store_id=? AND user_id=? FOR UPDATE',[ctx.storeId,userId]);
    if (!staff?.is_active || !user.is_active || !credentials || credentials.locked) result=null;
    else if (!(await bcrypt.compare(String(body.pin),credentials.pin_hash))) {
      await conn.query('UPDATE staff_credentials SET failed_pin_attempts=failed_pin_attempts+1,locked_until=IF(failed_pin_attempts>=5,DATE_ADD(NOW(),INTERVAL 15 MINUTE),NULL) WHERE id=?',[credentials.id]);result=null;
    } else {
      await conn.query('UPDATE staff_credentials SET failed_pin_attempts=0,locked_until=NULL WHERE id=?',[credentials.id]);
      await C.audit(conn,ctx,'staff.switch','user',userId,'PIN switch');
      const config=await C.settings(conn,ctx.storeId);
      result={ token:signToken({id:user.id,credentialVersion:credentialVersion(user.password_hash),pinRevision:Number(credentials.credential_revision),sessionMinutes:config.session_timeout_minutes}),user:{id:user.id,username:user.username,role:staff.role,store_id:ctx.storeId} };
    }
    await conn.commit();
  } catch(e) {await conn.rollback();throw e;} finally {conn.release();}
  if (!result) throw new ApiError(401,'Invalid PIN or staff locked');return result;
}
async function approve(ctx, body, key) {
  C.role(ctx,['owner','manager']);
  const requester=id(body.requested_by,'requested_by'); if (requester===ctx.id) throw new ApiError(422,'Approver must differ from requester');
  C.choice(body.action,['checkout.discount','checkout.price','refund.window'],'approval action');
  const raw=crypto.randomBytes(32).toString('hex');
  return C.transaction(ctx,'approval.issue',key,body,async conn=>{
    await C.row(conn,'users',ctx.storeId,requester);
    const entityId=id(body.entity_id,'entity_id');const checkout=await C.row(conn,body.action==='refund.window'?'sale_invoices':'checkout_sessions',ctx.storeId,entityId,true);
    if (body.action==='refund.window' && (ctx.role!=='owner' || !(await C.settings(conn,ctx.storeId)).allow_return_window_override)) throw new ApiError(403,'Return-window override disabled');
    const limit=C.exact.integer(body.limit_minor || 0);
    if (body.action==='checkout.discount' && ctx.role==='manager') {
      const config=await C.settings(conn,ctx.storeId);
      if (BigInt(limit)*10000n > BigInt(checkout.subtotal_minor)*C.exact.scaled(config.manager_discount_percent)) throw new ApiError(403,'Discount requires owner approval');
    }
    await C.insert(conn,'approval_tokens',{store_id:ctx.storeId,token_hash:C.hash(raw),action:body.action,entity_type:body.action==='refund.window'?'sale_invoice':'checkout',entity_id:entityId,payload_hash:C.hash(body.payload),limit_minor:limit,expires_at:new Date(Date.now()+5*60000),requested_by:requester,approved_by:ctx.id,register_id:checkout.register_id || null});
    await C.audit(conn,ctx,'approval.issue','user',requester,'Single-use approval issued',{action:body.action,entity_id:entityId});
    return {approval_token:raw,expires_in_seconds:300};
  });
}
async function consumeApproval(conn,ctx,token,action,entity,payload,amount=0) {
  const [[approval]]=await conn.query('SELECT *,expires_at>NOW() AS valid FROM approval_tokens WHERE store_id=? AND token_hash=? FOR UPDATE',[ctx.storeId,C.hash(String(token || ''))]);
  if (!approval || !approval.valid || approval.used_at || approval.action!==action || Number(approval.entity_id)!==Number(entity) || approval.requested_by!==ctx.id || approval.payload_hash!==C.hash(payload) || Number(approval.limit_minor)<amount) throw new ApiError(403,'Valid action-bound approval required');
  const [[staff]]=await conn.query('SELECT role,is_active FROM store_staff WHERE store_id=? AND user_id=?',[ctx.storeId,approval.approved_by]);
  if (!staff?.is_active || !['owner','manager'].includes(staff.role)) throw new ApiError(403,'Approver no longer authorized');
  await conn.query('UPDATE approval_tokens SET used_at=NOW() WHERE id=?',[approval.id]);
  await C.audit(conn,ctx,'approval.consume','checkout',entity,'Approval consumed',{action});
}
async function register(ctx,body,key) {
  C.role(ctx,['owner','manager']);
  return C.transaction(ctx,'register.create',key,body,async conn=>{
    const location=await C.row(conn,'business_units',ctx.storeId,body.business_unit_id);
    if (!location.is_active) throw new ApiError(409,'Location inactive');
    const deviceToken=crypto.randomBytes(32).toString('hex');
    const value=await C.insert(conn,'registers',{store_id:ctx.storeId,name:C.text(body.name,'name',100),code:C.text(body.code,'code',40),business_unit_id:location.id,device_key_hash:C.hash(deviceToken)});
    await C.insert(conn,'receipt_sequences',{store_id:ctx.storeId,register_id:value});
    await C.audit(conn,ctx,'register.create','register',value,'Register created');return {...await C.row(conn,'registers',ctx.storeId,value),device_token:deviceToken};
  });
}
async function openShift(ctx,body,key) {
  C.role(ctx,['owner','manager','cashier']);
  return C.transaction(ctx,'shift.open',key,body,async conn=>{
    const register=await C.row(conn,'registers',ctx.storeId,body.register_id,true);if (!register.is_active) throw new ApiError(409,'Register inactive');
    ctx={...ctx,registerId:register.id};
    const value=await C.insert(conn,'register_shifts',{store_id:ctx.storeId,register_id:register.id,opened_by:ctx.id,opening_float_minor:C.exact.integer(body.opening_float_minor ?? 0)});
    await C.audit(conn,ctx,'shift.open','shift',value,'Opening cash float recorded');return C.row(conn,'register_shifts',ctx.storeId,value);
  });
}
async function openShiftFor(conn,ctx,registerId) {
  const [[shift]]=await conn.query("SELECT * FROM register_shifts WHERE store_id=? AND register_id=? AND status='open' FOR UPDATE",[ctx.storeId,registerId]);
  if (!shift || (shift.opened_by!==ctx.id && !['owner','manager'].includes(ctx.role))) throw new ApiError(409,'An owned open cash shift is required');return shift;
}
async function movement(conn,ctx,shift,kind,amount,key,reason,reference=null,referenceId=null) {
  return C.insert(conn,'cash_movements',{store_id:ctx.storeId,shift_id:shift.id,actor_id:ctx.id,kind,direction:['sale','paid_in'].includes(kind)?'in':'out',amount_minor:amount,idempotency_key:C.hash(key),reason,reference_type:reference,reference_id:referenceId});
}
async function cashMovement(ctx,body,key) {
  C.role(ctx,['owner','manager']);C.choice(body.kind,['paid_in','paid_out','safe_drop'],'cash movement');
  return C.transaction(ctx,'cash.move',key,body,async conn=>{
    const shift=await C.row(conn,'register_shifts',ctx.storeId,body.shift_id,true);if(shift.status!=='open')throw new ApiError(409,'Shift closed');
    const value=await movement(conn,ctx,shift,body.kind,C.exact.integer(body.amount_minor,'amount_minor',true),key,C.text(body.reason,'reason'));
    await C.audit(conn,{...ctx,registerId:shift.register_id},'cash.move','cash_movement',value,body.reason);return C.row(conn,'cash_movements',ctx.storeId,value);
  });
}
async function closeShift(ctx,shiftId,body,key) {
  C.role(ctx,['owner','manager','cashier']);
  return C.transaction(ctx,'shift.close',key,{shiftId,...body},async conn=>{
    const shift=await C.row(conn,'register_shifts',ctx.storeId,shiftId,true);if(shift.status!=='open' || (shift.opened_by!==ctx.id && !['owner','manager'].includes(ctx.role)))throw new ApiError(409,'Shift closed or owned by another cashier');
    const [[pending]]=await conn.query("SELECT COUNT(*) AS n FROM checkout_sessions c JOIN checkout_payments p ON p.checkout_id=c.id AND p.store_id=c.store_id WHERE c.store_id=? AND c.register_id=? AND c.status<>'completed' AND p.status IN ('captured','pending','awaiting_customer')",[ctx.storeId,shift.register_id]);
    if (pending.n) throw new ApiError(409,'Resolve pending checkout payments before closing');
    const [[reserved]]=await conn.query("SELECT COUNT(*) AS n FROM offline_stock_allocations WHERE store_id=? AND register_id=? AND status IN ('active','reconciling')",[ctx.storeId,shift.register_id]);
    if(reserved.n)throw new ApiError(409,'Reconcile and release offline allocations before closing');
    const [[sum]]=await conn.query("SELECT COALESCE(SUM(IF(direction='in',amount_minor,-CAST(amount_minor AS SIGNED))),0) AS net FROM cash_movements WHERE store_id=? AND shift_id=?",[ctx.storeId,shift.id]);
    const expected=BigInt(shift.opening_float_minor)+BigInt(sum.net), counted=C.exact.integer(body.closing_count_minor);
    const variance=BigInt(counted)-expected;
    await conn.query("UPDATE register_shifts SET status='closed',open_slot=NULL,closed_at=NOW(),closed_by=?,closing_count_minor=?,expected_close_minor=?,variance_minor=? WHERE id=?",[ctx.id,counted,String(expected),String(variance),shift.id]);
    await C.audit(conn,{...ctx,registerId:shift.register_id},'shift.close','shift',shift.id,C.text(body.reason,'reason'),{expected_minor:String(expected),counted_minor:counted,variance_minor:String(variance)});
    if(variance)await C.notify(conn,ctx,'cash_variance','Cash variance',`Shift ${shift.id}: ${variance} minor units`,`variance:${shift.id}`);
    return C.row(conn,'register_shifts',ctx.storeId,shift.id);
  });
}
module.exports={context,getSettings,updateSettings,preset,assignStaff,switchPin,approve,consumeApproval,register,openShift,openShiftFor,movement,cashMovement,closeShift};
