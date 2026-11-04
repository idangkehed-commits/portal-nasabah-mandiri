'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
module.exports=function createApproval({cloud,sameOrigin,createViewer,ownerAccess}){
 const requests=new Map(),limits=new Map(),ttl=5*60*1000;
 const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
 const cookieName='portal_access_request';
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));return true;};
 function page(res,admin){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; script-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});
  res.end(`<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portal Nasabah</title><link rel="manifest" href="/__access/owner.webmanifest"><meta name="theme-color" content="#12375b"><meta name="apple-mobile-web-app-capable" content="yes"><style>body{font:16px system-ui;background:#edf2f7;color:#18334d;margin:0;padding:24px}main{max-width:560px;margin:30px auto;background:white;padding:24px;border-radius:12px}button,a{font:inherit}button{padding:12px;margin:6px 8px 6px 0;border:0;border-radius:6px;background:#12375b;color:white;cursor:pointer}button:disabled{opacity:.5}article{border-top:1px solid #ddd;padding:16px 0}strong{display:block;font-size:32px;letter-spacing:5px}p{line-height:1.5}#status{white-space:pre-line}</style><main><h1>Portal Nasabah</h1>${admin?'<h2>Persetujuan akses</h2><p>Cocokkan kode dengan pengguna sebelum menyetujui. Akses diberikan selama 30 menit.</p>'+(ownerAccess?.pushEnabled?'<p>Aktifkan notifikasi untuk menerima permintaan meskipun halaman ditutup. Di iPhone, tambahkan portal ke layar utama lalu buka dari ikonnya.</p><button id="pushEnable">Aktifkan notifikasi HP</button><button id="pushDisable">Matikan semua notifikasi pemilik</button><button id="pushTest">Kirim notifikasi uji</button><p id="pushStatus" role="status"></p>':'<p>Biarkan halaman ini terbuka di HP untuk melihat permintaan baru.</p><button id="notify">Aktifkan notifikasi saat halaman terbuka</button>')+'<div id="requests"></div><a href="/">Kembali ke portal</a>':'<p>Minta persetujuan pemilik untuk membuka portal.</p><button id="request">Minta akses</button><strong id="code"></strong><p id="expiry"></p><p>Berikan kode permintaan kepada pemilik untuk dicocokkan.</p><a href="/__access/login">Masuk dengan kode akses</a>'}<p id="status" role="status" aria-live="polite"></p></main><script src="/__access/approval.js" defer></script></html>`);return true;
 }
 return function handle(req,res,session){
  const route=(req.url||'').split('?')[0],now=Date.now();
  if(!['/__access/request','/__access/approvals','/__access/approval.js'].includes(route)&&!route.startsWith('/__access/requests'))return false;
  for(const[k,v]of requests)if(v.until<=now)requests.delete(k);
  for(const[k,v]of limits)if(v.until<=now)limits.delete(k);
  if(route==='/__access/approval.js'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8'});res.end(fs.readFileSync(path.join(__dirname,'access-approval.js')));return true;}
  if(route==='/__access/request'&&req.method==='GET')return page(res,false);
  const admin=(ownerAccess?.enabled?session?.role==='owner':session?.role==='admin')&&session.until>now;
  if(route==='/__access/approvals'&&req.method==='GET'){
   if(!admin){res.writeHead(303,{Location:ownerAccess?.enabled?'/__access/microsoft/login':'/__access/admin'});res.end();return true;}return page(res,true);
  }
  if(req.method==='POST'&&!sameOrigin(req))return json(res,403,{error:'Permintaan ditolak.'});
  const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
  const key=/^[a-f0-9]{64}$/.test(token)?hash(token):'',pending=requests.get(key);
  if(route==='/__access/requests/start'&&req.method==='POST'){
   if(pending?.state==='pending')return json(res,200,{code:pending.code,until:pending.until,state:pending.state});
   const ip=req.socket.remoteAddress||'unknown',limit=limits.get(ip);
   if(limit?.count>=5||requests.size>=200||limits.size>=10000)return json(res,429,{error:'Terlalu banyak permintaan. Coba lagi satu menit.'});
   limits.set(ip,{count:(limit?.count||0)+1,until:limit?.until||now+60000});
   const next=crypto.randomBytes(32).toString('hex');let code;
   do{code=String(crypto.randomInt(100000,1000000));}while([...requests.values()].some(v=>v.code===code));
   const item={id:crypto.randomBytes(16).toString('hex'),code,until:now+ttl,state:'pending',created:now};requests.set(hash(next),item);
   void ownerAccess?.notify();
   res.setHeader('Set-Cookie',`${cookieName}=${next}; Path=/__access; HttpOnly; SameSite=Strict; Max-Age=300${cloud||req.socket.encrypted?'; Secure':''}`);
   return json(res,200,{code,until:item.until,state:item.state});
  }
  if(route==='/__access/requests/status'&&req.method==='POST'){
   if(!pending)return json(res,200,{state:'expired'});
   if(pending.state==='approved'){
    if(!createViewer(req,res))return json(res,503,{error:'Sesi penuh. Coba lagi sebentar.'});
    requests.delete(key);return json(res,200,{state:'approved'});
   }return json(res,200,{state:pending.state,code:pending.code,until:pending.until});
  }
  if(!admin)return json(res,403,{error:'Login pemilik diperlukan.'});
  if(route==='/__access/requests'&&req.method==='GET')return json(res,200,{requests:[...requests.values()].filter(v=>v.state==='pending').map(({id,code,until,created})=>({id,code,until,created}))});
  const match=route.match(/^\/__access\/requests\/([a-f0-9]{32})\/(approve|deny)$/);
  if(match&&req.method==='POST'){
   const item=[...requests.values()].find(v=>v.id===match[1]);
   if(!item||item.state!=='pending')return json(res,409,{error:'Permintaan sudah selesai atau kedaluwarsa.'});
   item.state=match[2]==='approve'?'approved':'denied';return json(res,200,{state:item.state});
  }return json(res,404,{error:'Tidak ditemukan.'});
 };
};
