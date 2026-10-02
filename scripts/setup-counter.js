require('../src/config/load-environment');
const pool=require('../src/config/db');
const catalog=require('../database/seeds/all-permissions');
async function setup(conn) {
  await conn.beginTransaction();
  try {
    const [before]=await conn.query('SELECT permission_key FROM permissions');
    const existing=new Set(before.map(p=>p.permission_key));
    const added=catalog.filter(p=>!existing.has(p.permissionKey));
    for(const p of catalog)await conn.query('INSERT IGNORE INTO permissions (permission_key,module,description) VALUES (?,?,?)',[p.permissionKey,p.module,p.description]);
    // Extend existing active owners only. Existing DENY records and existing
    // restricted rights are preserved; no credentials or staff roles change.
    const legacyKeys=new Set(require('../database/seeds/base-permissions').map(p=>p.permissionKey));
    for(const p of catalog.filter(p=>!legacyKeys.has(p.permissionKey)))await conn.query("INSERT IGNORE INTO group_permissions (group_id,permission_id,effect,store_id) SELECT DISTINCT g.id,p.id,'ALLOW',g.store_id FROM users u JOIN store_staff s ON s.user_id=u.id AND s.store_id=u.store_id JOIN access_groups g ON g.id=u.group_id AND g.store_id=u.store_id JOIN permissions p ON p.permission_key=? WHERE s.role='owner' AND s.is_active=1 AND u.is_active=1 AND g.is_active=1",[p.permissionKey]);
    await conn.commit();return {added_permissions:added.length};
  } catch(error){await conn.rollback();throw error;}
}
if(require.main===module)(async()=>{const conn=await pool.getConnection();try{console.log('[counter:setup]',JSON.stringify(await setup(conn)));}finally{conn.release();await pool.end();}})().catch(error=>{console.error('[counter:setup]',error.message);process.exitCode=1;});
module.exports={setup};
