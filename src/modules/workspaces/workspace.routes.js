const router=require('express').Router();
const {randomBytes,createHash}=require('node:crypto');
const pool=require('../../config/db');
const ApiError=require('../../utils/api-error');
const asyncHandler=require('../../utils/async-handler');
const {verify,validateDocument,authorizeChanges}=require('./workspace-validation');
const digest=token=>createHash('sha256').update(token).digest('hex');
const parse=value=>typeof value==='string'?JSON.parse(value):value;
const answer=(res,data)=>res.json({success:true,data});
async function transaction(action){const conn=await pool.getConnection();try{await conn.beginTransaction();const result=await action(conn);await conn.commit();return result;}catch(error){await conn.rollback();throw error;}finally{conn.release();}}
async function accountIndex(conn,document){await conn.query('DELETE FROM browser_accounts WHERE workspace_id=?',[document.workspaceId]);for(const user of document.staff.filter(s=>!s.archived&&s.credential))await conn.query('INSERT INTO browser_accounts(email,workspace_id,user_id) VALUES(?,?,?)',[user.email.trim().toLowerCase(),document.workspaceId,user.id]);}
async function tokenFor(conn,workspaceId,userId){const token=randomBytes(32).toString('hex');await conn.query('INSERT INTO browser_sessions(token_hash,workspace_id,user_id,expires_at) VALUES(?,?,?,DATE_ADD(NOW(), INTERVAL 7 DAY))',[digest(token),workspaceId,userId]);return token;}
router.post('/signup',asyncHandler(async(req,res)=>{
  await require('../../middleware/login-limit').consumeLoginAttempt(req.ip,'workspace:signup',pool);
  const document=validateDocument(req.body.document,req.body.document?.workspaceId), user=document.staff.find(s=>s.id===req.body.userId);
  if(!user||user.role!=='Owner'||typeof req.body.password!=='string'||req.body.password.length<8||!await verify(req.body.password,user.credential))throw new ApiError(422,'Invalid owner credentials');
  const token=await transaction(async conn=>{await conn.query('INSERT INTO browser_workspaces(id,document) VALUES(?,?)',[document.workspaceId,JSON.stringify(document)]);await accountIndex(conn,document);return tokenFor(conn,document.workspaceId,user.id);});
  res.status(201);answer(res,{token,revision:1,userId:user.id,document});
}));
router.post('/signin',asyncHandler(async(req,res)=>{
  await require('../../middleware/login-limit').consumeLoginAttempt(req.ip,'workspace:signin',pool);
  if(typeof req.body.email!=='string')throw new ApiError(400,'Email is required');
  const [[account]]=await pool.query('SELECT a.user_id,w.id,w.document,w.revision FROM browser_accounts a JOIN browser_workspaces w ON w.id=a.workspace_id WHERE a.email=?',[req.body.email.trim().toLowerCase()]);
  const document=account&&parse(account.document), user=document?.staff.find(s=>s.id===account.user_id&&!s.archived);
  if(!user||!await verify(req.body.password,user.credential))throw new ApiError(401,'Email or password is incorrect');
  answer(res,{token:await tokenFor(pool,account.id,user.id),revision:account.revision,userId:user.id,document});
}));
router.use(asyncHandler(async(req,res,next)=>{
  const [scheme,token]=(req.get('Authorization')||'').split(' ');
  if(scheme!=='Bearer'||!token)throw new ApiError(401,'Sign in to the shared workspace');
  const [[row]]=await pool.query('SELECT s.user_id,w.id,w.document,w.revision FROM browser_sessions s JOIN browser_workspaces w ON w.id=s.workspace_id WHERE s.token_hash=? AND s.expires_at>NOW()',[digest(token)]);
  const document=row&&parse(row.document), user=document?.staff.find(s=>s.id===row.user_id&&!s.archived);
  if(!user)throw new ApiError(401,'Your workspace session expired');
  req.workspace={id:row.id,document,revision:row.revision,user,token};next();
}));
router.get('/current',asyncHandler(async(req,res)=>answer(res,{document:req.workspace.document,revision:req.workspace.revision,userId:req.workspace.user.id})));
router.put('/current',asyncHandler(async(req,res)=>{
  const current=req.workspace, next=validateDocument(req.body.document,current.id);
  const revision=await transaction(async conn=>{const [[row]]=await conn.query('SELECT document,revision FROM browser_workspaces WHERE id=? FOR UPDATE',[current.id]);if(req.body.revision!==row.revision)throw new ApiError(409,'Another device updated this workspace. Export your local backup before loading the shared version.');const prior=parse(row.document),liveUser=prior.staff.find(s=>s.id===current.user.id&&!s.archived);if(!liveUser)throw new ApiError(401,'Staff account is no longer active');authorizeChanges(prior,next,liveUser);await accountIndex(conn,next);await conn.query('UPDATE browser_workspaces SET document=?,revision=revision+1 WHERE id=?',[JSON.stringify(next),current.id]);return row.revision+1;});answer(res,{revision});
}));
router.post('/switch',asyncHandler(async(req,res)=>{
  await require('../../middleware/login-limit').consumeLoginAttempt(req.ip,'workspace:pin',pool);
  const user=req.workspace.document.staff.find(s=>s.id===req.body.userId&&!s.archived);
  if(!user||!await verify(req.body.pin,user.pin))throw new ApiError(401,'The PIN is incorrect');
  answer(res,{token:await tokenFor(pool,req.workspace.id,user.id),userId:user.id});
}));
router.post('/signout',asyncHandler(async(req,res)=>{await pool.query('DELETE FROM browser_sessions WHERE token_hash=?',[digest(req.workspace.token)]);answer(res,{signedOut:true});}));
// An inbox is accessible only to the explicitly configured platform owner.
router.use('/inquiries',(req,res,next)=>{const admin=(process.env.MARKETING_ADMIN_EMAIL||'').toLowerCase();if(req.workspace.user.role!=='Owner'||!admin||req.workspace.user.email.toLowerCase()!==admin)return next(new ApiError(403,'The inquiry inbox is reserved for the configured platform owner'));next();});
router.get('/inquiries',asyncHandler(async(req,res)=>{const [rows]=await pool.query('SELECT id,kind,name,email,business_name AS businessName,plan,message,status,created_at AS createdAt FROM marketing_submissions ORDER BY id DESC LIMIT 10000');answer(res,rows.map(r=>({...r,id:String(r.id)})));}));
router.patch('/inquiries/:id',asyncHandler(async(req,res)=>{await require('../marketing/marketing.service').updateStatus(req.params.id,req.body.status);answer(res,{id:req.params.id,status:req.body.status});}));
module.exports=router;
