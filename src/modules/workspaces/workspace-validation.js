const { pbkdf2, timingSafeEqual } = require('node:crypto');
const { promisify, isDeepStrictEqual } = require('node:util');
const ApiError = require('../../utils/api-error');
const derive = promisify(pbkdf2);
const tables = ['products','categories','customers','orders','orderItems','payments','stockMovements','staff','settings','outlets','shifts','cashEntries','suppliers','purchaseOrders','reports','activity','notifications','drafts'];
async function verify(password, credential) {
  if (typeof password !== 'string' || password.length > 200 || !Array.isArray(credential?.hash) || credential.hash.length !== 32 || !Array.isArray(credential.salt) || credential.salt.length !== 16) return false;
  const hash = await derive(password, Buffer.from(credential.salt), 210000, 32, 'sha256');
  return timingSafeEqual(hash, Buffer.from(credential.hash));
}
function validateDocument(document, workspaceId) {
  if (!document || document.workspaceId !== workspaceId || document.version !== 2) throw new ApiError(422,'Invalid workspace document');
  for (const table of tables) {
    const rows=document[table];
    if (!Array.isArray(rows) || rows.length > 100000 || rows.some(row => !row || typeof row.id !== 'string' || row.id.length > 100 || row.workspaceId !== workspaceId) || new Set(rows.map(row=>row.id)).size !== rows.length) throw new ApiError(422,`Invalid ${table} records`);
  }
  if (document.settings.length !== 1 || !document.staff.some(s=>s.role==='Owner'&&!s.archived)) throw new ApiError(422,'A workspace needs settings and an active owner');
  for (const p of document.products) if (['price','cost','stock','lowStock'].some(k=>!Number.isSafeInteger(p[k])||p[k]<0)) throw new ApiError(422,'Invalid product amounts');
  for (const user of document.staff) if (!['Owner','Manager','Cashier'].includes(user.role) || (user.credential && typeof user.email !== 'string')) throw new ApiError(422,'Invalid staff record');
  for (const order of document.orders) if (!['Paid','Partial','Refunded','Void'].includes(order.status) || !Number.isSafeInteger(order.total) || order.total < 0 || !Array.isArray(order.items)) throw new ApiError(422,'Invalid order');
  for (const key of Object.keys(document)) if (!tables.includes(key) && !['version','workspaceId','createdAt'].includes(key)) delete document[key];
  return document;
}
const without=(row,keys)=>Object.fromEntries(Object.entries(row).filter(([k])=>!keys.includes(k)));
function authorizeChanges(previous, next, user) {
  if (user.role === 'Owner') return;
  const deny=()=>{throw new ApiError(403,'Your role cannot synchronize these changes');};
  // A member may update their own name/password/PIN but never their role or another member.
  if (previous.staff.length!==next.staff.length) deny();
  for(const staff of previous.staff){const updated=next.staff.find(s=>s.id===staff.id);if(!updated||!isDeepStrictEqual(without(staff,staff.id===user.id?['name','credential','pin','updatedAt']:[]),without(updated,staff.id===user.id?['name','credential','pin','updatedAt']:[])))deny();}
  const locked=user.role==='Manager'?['settings','outlets']:['settings','outlets','categories','suppliers','purchaseOrders','reports'];
  for(const table of locked) if(!isDeepStrictEqual(previous[table],next[table]))deny();
  // Managers can archive records; permanent deletion remains owner-only.
  for(const table of ['products','customers','orders'])for(const row of previous[table])if(!next[table].some(v=>v.id===row.id))deny();
  if(user.role!=='Cashier')return;
  if(previous.products.length!==next.products.length)deny();
  const priorOrders=new Map(previous.orders.map(o=>[o.id,o]));
  const newOrders=next.orders.filter(o=>!priorOrders.has(o.id));
  for(const order of newOrders)if(order.cashierId!==user.id||!['Paid','Partial'].includes(order.status))deny();
  for(const order of previous.orders){const after=next.orders.find(o=>o.id===order.id);if(!isDeepStrictEqual(without(order,['paid','due','status','methodIds']),without(after,['paid','due','status','methodIds']))||['Refunded','Void'].includes(after.status)&&after.status!==order.status)deny();}
  for(const product of previous.products){const after=next.products.find(p=>p.id===product.id);if(!isDeepStrictEqual(without(product,['stock']),without(after,['stock'])))deny();const sold=newOrders.flatMap(o=>o.items).filter(i=>i.productId===product.id).reduce((n,i)=>n+i.quantity,0);if(after.stock!==product.stock-sold)deny();}
  for(const table of ['orderItems','payments','stockMovements','activity'])for(const row of previous[table]){const after=next[table].find(v=>v.id===row.id);if(!after||!isDeepStrictEqual(row,after))deny();}
}
module.exports={tables,verify,validateDocument,authorizeChanges};
