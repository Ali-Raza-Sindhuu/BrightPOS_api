const crypto = require('node:crypto');
const ApiError = require('../../utils/api-error');
const exact = require('../../utils/exact');
const { id } = require('../../utils/validation');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
const hash = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonical(value))).digest('hex');
function text(value, label, max = 500) { if (typeof value !== 'string' || !value.trim() || value.length > max) throw new ApiError(422, `${label} is required (maximum ${max} characters)`); return value.trim(); }
function choice(value, values, label) { if (!values.includes(value)) throw new ApiError(422, `Invalid ${label}`); return value; }
function role(ctx, roles) { if (!roles.includes(ctx.role)) throw new ApiError(403, 'This operation requires a different staff role'); }
async function row(conn, table, store, value, lock = false) {
  if (!/^[a-z_]+$/.test(table)) throw new Error('Invalid internal table');
  const [[result]] = await conn.query(`SELECT * FROM ${table} WHERE store_id=? AND id=?${lock ? ' FOR UPDATE' : ''}`, [store, id(value, `${table} id`)]);
  if (!result) throw new ApiError(404, 'Record not found in this store');
  return result;
}
async function insert(conn, table, values) {
  const keys = Object.keys(values);
  if (![table, ...keys].every(key => /^[a-z_]+$/.test(key))) throw new Error('Invalid internal identifier');
  const [result] = await conn.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`, Object.values(values).map(value => value === undefined ? null : value));
  return result.insertId;
}
async function audit(conn, ctx, action, entity, entityId, reason, after) {
  await insert(conn, 'audit_events', { store_id: ctx.storeId, actor_id: ctx.id, register_id: ctx.registerId || null, action, entity_type: entity, entity_id: entityId || null, reason: reason || null, after_data: after ? JSON.stringify(after) : null });
}
async function notify(conn, ctx, type, title, body, key, severity = 'warning') {
  const [[config]]=await conn.query('SELECT notification_preferences FROM store_settings WHERE store_id=?',[ctx.storeId]);
  const preferences=typeof config?.notification_preferences==='string'?JSON.parse(config.notification_preferences):config?.notification_preferences;
  if(preferences?.in_app===false||preferences?.[type]===false)return;
  await conn.query('INSERT INTO notifications (store_id, type, severity, title, body, recipient_role, dedupe_key) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE body=VALUES(body), read_at=NULL', [ctx.storeId, type, severity, title, body, 'owner', key]);
}
async function transaction(ctx, action, key, payload, work) {
  key = text(key, 'Idempotency-Key', 100);
  const conn = await ctx.pool.getConnection();
  const digest = hash({ actor: ctx.id, payload });
  try {
    await conn.beginTransaction();
    await conn.query("INSERT INTO idempotency_requests (store_id,action,request_key,payload_hash,expires_at) VALUES (?,?,?,?,DATE_ADD(NOW(), INTERVAL 30 DAY)) ON DUPLICATE KEY UPDATE id=id", [ctx.storeId, action, key, digest]);
    const [[request]] = await conn.query('SELECT * FROM idempotency_requests WHERE store_id=? AND action=? AND request_key=? FOR UPDATE', [ctx.storeId, action, key]);
    if (request.payload_hash !== digest) throw new ApiError(409, 'Idempotency key was used with a different request');
    if (request.status === 'succeeded') { await conn.commit(); return typeof request.response_body === 'string' ? JSON.parse(request.response_body) : request.response_body; }
    const result = await work(conn, key);
    await conn.query("UPDATE idempotency_requests SET status='succeeded', response_status=200, response_body=? WHERE id=?", [JSON.stringify(result), request.id]);
    await conn.commit(); return result;
  } catch (error) {
    await conn.rollback();
    if (error.stockBlocked) {
      // Autocommit on the released transaction keeps alerts after rollback.
      await audit(conn, ctx, 'stock.blocked', 'item', error.itemId, error.message);
      await notify(conn, ctx, 'blocked_stock', 'Stock operation blocked', error.message, `blocked:${error.itemId}:${ctx.id}`);
    }
    throw error;
  } finally { conn.release(); }
}
async function settings(conn, store) { const [[value]] = await conn.query('SELECT * FROM store_settings WHERE store_id=?', [store]); if (!value) throw new ApiError(409, 'Store settings missing'); return value; }
async function lockItems(conn, ctx, ids,allowInactive=false) {
  const unique = [...new Set(ids.map(value => id(value, 'item_id')))].sort((a,b) => a-b);
  if (!unique.length || unique.length > 200) throw new ApiError(422, 'Provide 1 to 200 items');
  const [items] = await conn.query(`SELECT * FROM item_details WHERE store_id=? AND id IN (${unique.map(() => '?')}) ORDER BY id FOR UPDATE`, [ctx.storeId, ...unique]);
  if (items.length !== unique.length || items.some(item => (!allowInactive&&!item.is_enable) || !item.item_unit_id)) throw new ApiError(422, 'Items must belong to this store, have inventory units and be active for new sales');
  return new Map(items.map(item => [item.id, item]));
}
async function stock(conn, ctx, item, location, delta, reference, referenceId, reason) {
  delta = BigInt(delta);
  if (!delta) return;
  await row(conn, 'business_units', ctx.storeId, location);
  const [[balance]] = await conn.query('SELECT * FROM inventory WHERE store_id=? AND item_id=? AND unit_id=? AND business_unit_id=? FOR UPDATE', [ctx.storeId, item.id, item.item_unit_id, location]);
  const available = balance ? exact.scaled(balance.quantity) : 0n;
  const [[reserved]] = await conn.query("SELECT COALESCE(SUM(allocated_quantity-consumed_quantity),0) AS quantity FROM offline_stock_allocations WHERE store_id=? AND item_id=? AND business_unit_id=? AND status IN ('active','reconciling')", [ctx.storeId, item.id, location]);
  const reservedQty = exact.scaled(reserved.quantity, 6) / 10000n;
  if (available + delta < 0n || (delta < 0n && available + delta < reservedQty)) {
    const error = new ApiError(409, 'Insufficient unreserved stock'); error.stockBlocked = true; error.itemId = item.id; throw error;
  }
  if (balance) await conn.query('UPDATE inventory SET quantity=? WHERE id=?', [exact.decimal(available + delta), balance.id]);
  else await insert(conn, 'inventory', { store_id:ctx.storeId,item_id:item.id,unit_id:item.item_unit_id,business_unit_id:location,quantity:exact.decimal(delta) });
  await insert(conn, 'item_stock', { store_id:ctx.storeId,business_unit_id:location,item_id:item.id,type:reference==='PRODUCTION'?'PRODUCTION':reference==='REFUND'?'SALES_RETURN':reference==='STOCK_ADJUSTMENT'?'ADJUSTMENT':delta < 0n ? 'SALE' : 'OPENING',qty:exact.decimal(delta),ref_type:reference,ref_id:referenceId,created_by:ctx.id,register_id:ctx.registerId || null,reason });
  const config = await settings(conn, ctx.storeId);
  if ((available + delta) * 10000n <= exact.scaled(config.low_stock_threshold, 6)) await notify(conn, ctx, 'low_stock', 'Low stock', `${item.item_name}: ${exact.decimal(available + delta)} remaining`, `low:${item.id}:${location}`);
}
module.exports = { exact, hash, text, choice, role, row, insert, audit, notify, transaction, settings, lockItems, stock };
