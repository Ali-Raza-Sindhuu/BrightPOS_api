const storage=require('../utils/request-context');
function legacyContext(){const ctx=storage.getStore();return ctx&&['POST','PUT','PATCH','DELETE'].includes(ctx.request.method)&&!/^\/api\/(counter|demo)(\/|$)/.test(ctx.request.originalUrl)?ctx:null;}
async function auditCommit(conn,ctx) {
  const req=ctx.request;
  const fields=Object.keys(req.body || {}).filter(field=>!/password|secret|token|pin|credential/i.test(field)).slice(0,30);
  const resource=req.originalUrl.split('?')[0].split('/')[2] || 'request';
  const entityId=Number(req.params?.id);const user=ctx.user;
  await conn.query('INSERT INTO audit_events (store_id,actor_id,action,entity_type,entity_id,reason,after_data) VALUES (?,?,?,?,?,?,?)',[user.storeId,user.id,`legacy.${req.method.toLowerCase()}.${resource}`,'legacy_request',Number.isSafeInteger(entityId)&&entityId>0?entityId:null,'Authorized legacy API write',JSON.stringify({request_id:req.id,path:req.originalUrl.split('?')[0],fields})]);
}
function auditedPool(pool) {
  const acquire=pool.getConnection.bind(pool),query=pool.query.bind(pool);
  pool.getConnection=async function(){
    const conn=await acquire();
    if(!conn._brightposAuditInstalled){
      const commit=conn.commit.bind(conn);
      conn.commit=async function(){const ctx=legacyContext();if(ctx)await auditCommit(conn,ctx);return commit();};
      conn._brightposAuditInstalled=true;
    }
    return conn;
  };
  pool.query=async function(sql,...args){
    const ctx=legacyContext();const statement=typeof sql==='string'?sql:sql.sql;
    // Direct CRUD writes receive the same transaction-bound audit guarantee.
    // Infrastructure/audit writes are excluded to prevent recursive auditing.
    if(!ctx||!/^\s*(INSERT|UPDATE|DELETE)\b/i.test(statement)||/\b(audit_events|notifications|auth_login_limits|access_ip_logs)\b/i.test(statement))return query(sql,...args);
    const conn=await pool.getConnection();
    try{await conn.beginTransaction();const result=await conn.query(sql,...args);await conn.commit();return result;}catch(error){await conn.rollback();throw error;}finally{conn.release();}
  };
  return pool;
}
module.exports=auditedPool;
