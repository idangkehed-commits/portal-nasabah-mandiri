'use strict';
const crypto = require('node:crypto');
function decodeSecret(value) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const text=String(value||'').toUpperCase().replace(/[\s=-]/g,'');
  if (!/^[A-Z2-7]{32,128}$/.test(text)) throw new Error('Konfigurasi authenticator tidak valid.');
  let bits=0,buffer=0;const bytes=[];
  for(const c of text){buffer=(buffer<<5)|alphabet.indexOf(c);bits+=5;if(bits>=8){bits-=8;bytes.push((buffer>>>bits)&255);}}
  return Buffer.from(bytes);
}
function codeAt(secret,counter){
  const buffer=Buffer.alloc(8);buffer.writeBigUInt64BE(BigInt(counter));
  const hash=crypto.createHmac('sha1',secret).update(buffer).digest();const offset=hash[19]&15;
  return String((hash.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
module.exports=function createAuthenticatorGate(env=process.env){
  const cloud=env.RENDER==='true'||env.NODE_ENV==='production'||Boolean(env.RENDER_EXTERNAL_URL);
  const enabled=cloud||Boolean(env.ACCESS_TOTP_SECRET);
  let secret;try{if(enabled)secret=decodeSecret(env.ACCESS_TOTP_SECRET);}catch{}
  const sessions=new Map(),attempts=new Map();let lastUsed=-1;
  const ttl=3600000,cookieName='portal_totp_session';
  const digest=v=>crypto.createHash('sha256').update(v).digest('hex');
  function reply(res,status,text){res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8'});res.end(text);return true;}
  function page(res,status=200,message=''){
    res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"});
    res.end(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Akses Portal Nasabah</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#10243c;font:16px Arial;color:#17263b;padding:20px}main{background:white;border-radius:18px;padding:30px;max-width:420px;width:100%}h1{font-size:24px}p{line-height:1.5;color:#64748b}input{width:100%;padding:14px;border:1px solid #cbd5e1;border-radius:8px;font-size:28px;letter-spacing:8px;text-align:center;margin:12px 0}button{width:100%;padding:13px;border:0;border-radius:8px;background:#12375b;color:white;font-weight:bold}.error{color:#b91c1c}</style></head><body><main><h1>Portal Nasabah</h1><p>Masukkan kode Google Authenticator dari pemilik akses.</p>${message?'<p class="error" role="alert">'+message+'</p>':''}<form method="post" action="/__access/login"><label for="code">Kode akses 6 digit</label><input id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required autofocus><button type="submit">Buka portal</button></form><p>Sesi akses berlaku 1 jam. Kode yang sudah digunakan tidak dapat dipakai ulang.</p></main></body></html>`);return true;
  }
  const cookie=(req,value,age)=>`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${cloud||req.socket.encrypted?'; Secure':''}`;
  function sameOrigin(req){try{return new URL(req.headers.origin||'').host===req.headers.host;}catch{return false;}}
  return function gate(req,res){
    if(!enabled)return false;
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
    const route=(req.url||'/').split('?')[0];
    if(['/health','/ping'].includes(route))return false;
    if(!secret)return reply(res,503,'Akses online belum diaktifkan. Pemilik harus memasangkan Google Authenticator.');
    const now=Date.now();for(const[k,v]of sessions)if(v<=now)sessions.delete(k);for(const[k,v]of attempts)if(v.until<=now)attempts.delete(k);
    const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
    const sessionKey=/^[a-f0-9]{64}$/.test(token)?digest(token):'';
    if(route==='/__access/logout'){
      if(req.method!=='POST'||!sameOrigin(req))return reply(res,403,'Permintaan ditolak.');
      sessions.delete(sessionKey);res.writeHead(303,{'Location':'/','Set-Cookie':cookie(req,'',0)});res.end();return true;
    }
    if(route==='/__access/login'&&req.method==='POST'){
      if(!sameOrigin(req)||!(req.headers['content-type']||'').startsWith('application/x-www-form-urlencoded'))return reply(res,403,'Permintaan ditolak.');
      // Use the socket identity, not caller-supplied forwarding headers.
      const ip=req.socket.remoteAddress||'unknown',state=attempts.get(ip);
      if(state?.count>=5){res.setHeader('Retry-After','60');return reply(res,429,'Terlalu banyak percobaan. Tunggu satu menit.');}
      let body='',oversize=false;
      req.on('data',chunk=>{if(oversize)return;body+=chunk;if(Buffer.byteLength(body)>1024){oversize=true;reply(res,413,'Permintaan terlalu besar.');}});
      req.on('end',()=>{
        if(oversize)return;
        const latest=attempts.get(ip);
        if(latest?.count>=5){res.setHeader('Retry-After','60');return reply(res,429,'Terlalu banyak percobaan. Tunggu satu menit.');}
        const code=new URLSearchParams(body).get('code')||'';const step=Math.floor(Date.now()/30000);let matched=-1;
        if(/^[0-9]{6}$/.test(code))for(const n of [step,step-1,step+1])if(n>lastUsed&&crypto.timingSafeEqual(Buffer.from(codeAt(secret,n)),Buffer.from(code)))matched=n;
        if(matched<0){if(attempts.size>=10000)return reply(res,429,'Coba lagi nanti.');attempts.set(ip,{count:(latest?.count||0)+1,until:latest?.until||Date.now()+60000});page(res,401,'Kode salah, kedaluwarsa, atau sudah dipakai. Gunakan kode baru.');return;}
        if(sessions.size>=1000)return reply(res,503,'Terlalu banyak sesi. Coba lagi nanti.');
        lastUsed=matched;attempts.delete(ip);const next=crypto.randomBytes(32).toString('hex');sessions.set(digest(next),Date.now()+ttl);
        res.writeHead(303,{'Location':'/','Set-Cookie':cookie(req,next,ttl/1000)});res.end();
      });return true;
    }
    if(sessionKey&&sessions.get(sessionKey)>now){req.securityTotpVerified=true;req.securityUser='owner-code';return false;}
    if((req.method==='GET'||req.method==='HEAD')&&(req.headers.accept||'').includes('text/html'))return page(res);
    return reply(res,401,'Masukkan kode Google Authenticator melalui halaman utama.');
  };
};
module.exports.decodeSecret=decodeSecret;
module.exports.codeAt=codeAt;
