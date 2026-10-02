require('../src/config/load-environment');
const {getDatabaseOptions}=require('../src/config/database');
const {loadMigrations,runMigrations}=require('./lib/migrations');
const {validateSchema}=require('./lib/schema');
async function setupDemo() {
  const options=getDatabaseOptions();const database=process.env.DEMO_DB_NAME;
  if(!/^brightpos_demo(?:_test)?$/.test(database || '')||database===options.database)throw new Error('Configure a separate explicit brightpos_demo database; business database refused');
  const conn=await require('mysql2/promise').createConnection({...options,database});
  try {await runMigrations(conn,loadMigrations());console.log('[demo] Verified isolated database',await validateSchema(conn));}finally{await conn.end();}
}
if(require.main===module)setupDemo().catch(e=>{console.error('[demo]',e.message);process.exitCode=1;});
module.exports={setupDemo};
