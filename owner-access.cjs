'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const consumer='9188040d-6c67-4c5b-b112-36a304b66dad';
const issuer='https://login.microsoftonline.com/'+consumer+'/v2.0';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const random=()=>crypto.randomBytes(32).toString('hex');
function validateToken(token,{keys,clientId,nonce,now=Date.now()}){
 const pieces=String(token).split('.');if(pieces.length!==3||token.length>20000)throw Error('Invalid token');
 const header=JSON.parse(Buffer.from(pieces[0],'base64url')),claims=JSON.parse(Buffer.from(pieces[1],'base64url'));
 const key=keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.use||k.use==='sig')&&(!k.alg||k.alg==='RS256'));
 if(header.alg!=='RS256'||!key||!crypto.verify('RSA-SHA256',Buffer.from(pieces[0]+'.'+pieces[1]),crypto.createPublicKey({key,format:'jwk'}),Buffer.from(pieces[2],'base64url')))throw Error('Invalid signature');
 if(claims.aud!==clientId||claims.iss!==issuer||claims.tid!==consumer||claims.nonce!==nonce||!Number.isFinite(claims.exp)||claims.exp*1000<=now||!Number.isFinite(claims.nbf)||claims.nbf*1000>now+60000||!claims.sub)throw Error('Invalid claims');
 return claims;
}
function validEndpoint(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.notify.windows.com'));}catch{return false;}}
module.exports=function ownerAccess(env=process.env,injectedPool){
 const enabled=Boolean(env.MS_OWNER_CLIENT_ID&&env.MS_OWNER_CLIENT_SECRET&&env.MS_OWNER_SUBJECT);
 const configured=Boolean(env.MS_OWNER_CLIENT_ID&&env.MS_OWNER_CLIENT_SECRET);
 const origin=env.PORTAL_PUBLIC_URL||env.RENDER_EXTERNAL_URL||'';
 const redirect=origin+'/__access/microsoft/callback';
 const cloud=env.RENDER==='true'||env.NODE_ENV==='production';
 let pool=injectedPool,ready,keysCache;
 const sessions=new Map(),states=new Map();
 async function db(){
  if(!pool){const {Pool}=require('pg'),u=new URL(env.DATABASE_URL);for(const k of ['sslmode','sslcert','sslkey','sslrootcert'])u.searchParams.delete(k);pool=new Pool({connectionString:u.toString(),ssl:{rejectUnauthorized:true},max:2});}
  if(!ready)ready=pool.query('CREATE TABLE IF NOT EXISTS portal_owner_settings (key TEXT PRIMARY KEY, value JSONB NOT NULL); CREATE TABLE IF NOT EXISTS portal_owner_push (endpoint TEXT PRIMARY KEY, subscription JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())').catch(e=>{ready=null;throw e;});await ready;return pool;
 }
 const getCookie=(req,name)=>(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';
 const cookie=(name,value,age,sameSite='Strict')=>`${name}=${value}; Path=/__access; HttpOnly; SameSite=${sameSite}; Max-Age=${age}${cloud||origin.startsWith('https:')?'; Secure':''}`;
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
 const sameOrigin=req=>{try{return new URL(req.headers.origin).origin===origin;}catch{return false;}};
 function owner(req){const key=hash(getCookie(req,'portal_owner'));const item=sessions.get(key);if(item?.until>Date.now())return item;sessions.delete(key);return null;}
 async function vapid(){const d=await db();const existing=await d.query("SELECT value FROM portal_owner_settings WHERE key='vapid'");if(existing.rows[0])return existing.rows[0].value;
  const value=require('web-push').generateVAPIDKeys();await d.query("INSERT INTO portal_owner_settings(key,value) VALUES('vapid',$1::jsonb) ON CONFLICT DO NOTHING",[JSON.stringify(value)]);return (await d.query("SELECT value FROM portal_owner_settings WHERE key='vapid'")).rows[0].value;
 }
 async function notify(){if(!enabled)return;try{const d=await db(),v=await vapid(),push=require('web-push');const rows=(await d.query('SELECT endpoint,subscription FROM portal_owner_push ORDER BY created_at DESC LIMIT 10')).rows;
  await Promise.allSettled(rows.map(async row=>{if(!validEndpoint(row.endpoint))return;try{await push.sendNotification(row.subscription,JSON.stringify({title:'Portal Nasabah',body:'Ada permintaan akses. Ketuk untuk memeriksa dan menyetujui.',url:'/__access/approvals'}),{vapidDetails:{subject:'mailto:wilmuhammad02@outlook.co.id',publicKey:v.publicKey,privateKey:v.privateKey},TTL:300,timeout:10000});}catch(e){if(e.statusCode===404||e.statusCode===410)await d.query('DELETE FROM portal_owner_push WHERE endpoint=$1',[row.endpoint]);}}));
 }catch{console.error('Notifikasi pemilik belum dapat dikirim.');}}
 async function keys(){if(!keysCache||keysCache.until<Date.now()){const r=await fetch('https://login.microsoftonline.com/consumers/discovery/v2.0/keys',{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Keys unavailable');keysCache={keys:(await r.json()).keys,until:Date.now()+3600000};}return keysCache.keys;}
 function handle(req,res,admin){
  const url=new URL(req.url,'http://localhost'),route=url.pathname;
  if(!route.startsWith('/__access/microsoft/')&&!route.startsWith('/__access/push/')&&!['/__access/owner-sw.js','/__access/owner.webmanifest','/__access/owner-icon.svg','/__access/owner/logout'].includes(route))return false;
  (async()=>{
   if(route==='/__access/owner-sw.js'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/javascript','Service-Worker-Allowed':'/__access/'});res.end(fs.readFileSync(path.join(__dirname,'owner-sw.js')));return;}
   if(route==='/__access/owner-icon.svg'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'image/svg+xml'});res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="36" fill="#12375b"/><text x="96" y="130" font-size="105" font-family="Arial" text-anchor="middle" fill="white">P</text></svg>');return;}
   if(route==='/__access/owner.webmanifest'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/manifest+json'});res.end(JSON.stringify({id:'/__access/approvals',name:'Portal Nasabah — Pemilik',short_name:'Portal Pemilik',start_url:'/__access/approvals',scope:'/__access/',display:'standalone',background_color:'#edf2f7',theme_color:'#12375b',icons:[{src:'/__access/owner-icon.svg',sizes:'any',type:'image/svg+xml'}]}));return;}
   if(route==='/__access/microsoft/login'&&req.method==='GET'){
    if(!configured||!origin.startsWith('https://'))return json(res,503,{error:'Login Microsoft belum dikonfigurasi.'});
    if(!enabled&&!admin)return json(res,403,{error:'Login admin diperlukan untuk memeriksa identitas awal.'});
    const now=Date.now();for(const[k,v]of states)if(v.until<now)states.delete(k);if(states.size>=100)return json(res,429,{error:'Coba lagi nanti.'});
    const state=random(),browser=random(),nonce=random(),verifier=random();states.set(hash(state),{browser:hash(browser),nonce,verifier,until:now+300000,setup:!enabled});
    const q=new URLSearchParams({client_id:env.MS_OWNER_CLIENT_ID,response_type:'code',redirect_uri:redirect,response_mode:'query',scope:'openid profile email',state,nonce,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account',login_hint:'wilmuhammad02@outlook.co.id'});
    res.writeHead(303,{Location:'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?'+q,'Set-Cookie':cookie('portal_owner_oauth',browser,300,'Lax')});res.end();return;
   }
   if(route==='/__access/microsoft/callback'&&req.method==='GET'){
    const state=states.get(hash(url.searchParams.get('state')||''));states.delete(hash(url.searchParams.get('state')||''));
    if(!state||state.until<Date.now()||hash(getCookie(req,'portal_owner_oauth'))!==state.browser)return json(res,403,{error:'Permintaan login kedaluwarsa. Mulai lagi.'});
    if(!url.searchParams.get('code'))return json(res,403,{error:'Login Microsoft dibatalkan.'});
    const r=await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.MS_OWNER_CLIENT_ID,client_secret:env.MS_OWNER_CLIENT_SECRET,code:url.searchParams.get('code'),grant_type:'authorization_code',redirect_uri:redirect,code_verifier:state.verifier}),signal:AbortSignal.timeout(15000)});
    if(!r.ok)return json(res,403,{error:'Login Microsoft gagal. Periksa konfigurasi aplikasi.'});
    const c=validateToken((await r.json()).id_token,{keys:await keys(),clientId:env.MS_OWNER_CLIENT_ID,nonce:state.nonce});
    // Setup only reveals the immutable subject to the already authenticated administrator.
    // It never grants access based on mutable email/username claims.
    if(state.setup)return json(res,200,{message:'Identitas berhasil diverifikasi. Pastikan ini akun pemilik, lalu pasang nilai berikut di konfigurasi server untuk mengaktifkan pembatasan.',MS_OWNER_SUBJECT:c.sub,account:c.preferred_username||c.email||'',issuer:c.iss});
    if(c.sub!==env.MS_OWNER_SUBJECT)return json(res,403,{error:'Hanya akun Microsoft pemilik yang diizinkan.'});
    const token=random();for(const[k,v]of sessions)if(v.until<Date.now())sessions.delete(k);if(sessions.size>=100)return json(res,503,{error:'Sesi penuh.'});sessions.set(hash(token),{role:'owner',until:Date.now()+30*86400000});
    res.writeHead(303,{Location:'/__access/approvals','Set-Cookie':[cookie('portal_owner',token,30*86400),cookie('portal_owner_oauth','',0,'Lax')]});res.end();return;
   }
   if(route==='/__access/owner/logout'&&req.method==='POST'){if(!sameOrigin(req))return json(res,403,{error:'Permintaan ditolak.'});sessions.delete(hash(getCookie(req,'portal_owner')));res.setHeader('Set-Cookie',cookie('portal_owner','',0));return json(res,200,{ok:true});}
   if(!enabled||!owner(req))return json(res,403,{error:'Login Microsoft pemilik diperlukan.'});
   if(route==='/__access/push/key'&&req.method==='GET')return json(res,200,{publicKey:(await vapid()).publicKey});
   if(route==='/__access/push/subscribe'&&req.method==='POST'){
    if(!sameOrigin(req)||!(req.headers['content-type']||'').startsWith('application/json'))return json(res,403,{error:'Permintaan ditolak.'});
    let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>6000)return json(res,413,{error:'Permintaan terlalu besar.'});chunks.push(chunk);}let sub;try{sub=JSON.parse(Buffer.concat(chunks));}catch{return json(res,400,{error:'Data tidak valid.'});}
    if(!validEndpoint(sub.endpoint)||typeof sub.keys?.p256dh!=='string'||typeof sub.keys?.auth!=='string'||Buffer.from(sub.keys.p256dh,'base64url').length!==65||Buffer.from(sub.keys.auth,'base64url').length!==16)return json(res,400,{error:'Langganan notifikasi tidak valid.'});
    const value={endpoint:sub.endpoint,keys:{p256dh:sub.keys.p256dh,auth:sub.keys.auth}};const d=await db();await d.query('INSERT INTO portal_owner_push(endpoint,subscription) VALUES($1,$2::jsonb) ON CONFLICT(endpoint) DO UPDATE SET subscription=EXCLUDED.subscription,created_at=now()',[sub.endpoint,JSON.stringify(value)]);
    await d.query('DELETE FROM portal_owner_push WHERE endpoint NOT IN (SELECT endpoint FROM portal_owner_push ORDER BY created_at DESC LIMIT 10)');return json(res,200,{ok:true});
   }
   if(route==='/__access/push/unsubscribe'&&req.method==='POST'){
    if(!sameOrigin(req))return json(res,403,{error:'Permintaan ditolak.'});await(await db()).query('DELETE FROM portal_owner_push');return json(res,200,{ok:true});
   }
   return json(res,404,{error:'Tidak ditemukan.'});
  })().catch(()=>{if(!res.headersSent)json(res,503,{error:'Layanan pemilik belum tersedia. Coba lagi nanti.'});else res.end();});return true;
 }
 return {enabled,configured,owner,handle,notify};
};
module.exports.validateToken=validateToken;
module.exports.validEndpoint=validEndpoint;
