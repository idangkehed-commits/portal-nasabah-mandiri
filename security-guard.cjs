'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
module.exports = function createGuard(root, mode = 'public') {

  const sessions = new Map();
  const cookieName = 'project_owner_' + crypto.createHash('sha256').update(root).digest('hex').slice(0,12);
  const configVersion = cfg => crypto.createHash('sha256').update(cfg.username+':'+(cfg.direct||cfg.hash)).digest('hex');
  const cookie = (req, value, age) => cookieName+'='+value+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+age+((req.socket.encrypted || process.env.NODE_ENV==='production' || process.env.RENDER==='true')?'; Secure':'');
  function session(req,cfg) {
    const value=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
    if (!/^[a-f0-9]{64}$/.test(value)) return null;
    const key=crypto.createHash('sha256').update(value).digest('hex');const saved=sessions.get(key);
    if (!saved || saved.until<Date.now() || saved.version!==configVersion(cfg)) {sessions.delete(key);return null;}
    return {key,...saved};
  }
  function sameOrigin(req) { try {return new URL(req.headers.origin||'').host===req.headers.host;}catch{return false;} }
  function loginPage(res,status=401) {
    res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; form-action 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'"});
    res.end('<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Masuk</title><body style="font:16px system-ui;max-width:380px;margin:12vh auto;padding:20px"><h1>Masuk</h1><form method="post" action="/__security/login"><p><label>Username<br><input name="username" autocomplete="username" required maxlength="64"></label></p><p><label>Password<br><input type="password" name="password" autocomplete="current-password" required maxlength="1024"></label></p><button>Masuk</button></form></body></html>');return true;
  }

  const attempts = new Map();
  const accepted = new Map();
  const localFile = path.join(root, '.security', 'auth.json');
  let config = null;
  let configStamp = '';
  function credentials() {
    if (process.env.SECURITY_ADMIN_PASSWORD) {
      const password = process.env.SECURITY_ADMIN_PASSWORD;
      if (password.length < 16) return null;
      return { username: process.env.SECURITY_ADMIN_USER || 'admin', direct: password };
    }
    try {
      const st = fs.statSync(localFile);
      const stamp = String(st.mtimeMs);
      if (stamp !== configStamp) {
        const next = JSON.parse(fs.readFileSync(localFile, 'utf8'));
        if (!/^[a-zA-Z0-9_.@-]{1,64}$/.test(next.username) || !/^[a-f0-9]{32}$/.test(next.salt) || !/^[a-f0-9]{64}$/.test(next.hash)) return null;
        config = next; configStamp = stamp; accepted.clear();
      }
      return config;
    } catch { return null; }
  }
  function end(res, code, text) {
    res.writeHead(code, {'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
    res.end(text); return true;
  }
  function authenticated(req, cfg) {
    const header = req.headers.authorization || '';
    if (header.length > 2048 || !/^Basic [A-Za-z0-9+/]+=*$/.test(header)) return false;
    const fingerprint = crypto.createHash('sha256').update(header + ':' + (cfg.direct || cfg.hash)).digest('hex');
    if (accepted.has(fingerprint) && accepted.get(fingerprint) > Date.now()) return true;
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const colon = decoded.indexOf(':');
    const username = decoded.slice(0, colon);
    const password = decoded.slice(colon + 1);
    if (colon < 1 || username !== cfg.username || password.length > 1024) return false;
    const actual = cfg.direct ? crypto.createHash('sha256').update(password).digest() : crypto.scryptSync(password, cfg.salt, 32);
    const expected = cfg.direct ? crypto.createHash('sha256').update(cfg.direct).digest() : Buffer.from(cfg.hash, 'hex');
    const valid = crypto.timingSafeEqual(actual, expected);
    if (valid) { if (accepted.size >= 100) accepted.clear(); accepted.set(fingerprint, Date.now() + 600000); }
    return valid;
  }
  return function guard(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    let raw = (req.url || '/').split('?')[0];
    let route;
    try { route = decodeURIComponent(raw); } catch { return end(res,400,'Alamat tidak valid.'); }
    // Decode exactly once and reject residual escapes, alternate separators and Windows stream syntax.
    if (!route.startsWith('/') || /[%\\\x00-\x1f:]/.test(route) || route.split('/').some(x => x === '..' || x === '.' || /[. ]$/.test(x))) return end(res,403,'Akses ditolak.');
    if (route === '/__security/login') {
      if (req.method === 'GET') return loginPage(res,200);
      if (req.method !== 'POST') return end(res,405,'Metode tidak diizinkan.');
      if (!sameOrigin(req) || !(req.headers['content-type']||'').startsWith('application/x-www-form-urlencoded')) return end(res,403,'Permintaan ditolak.');
      const cfg=credentials();if(!cfg)return end(res,503,'Akses belum diaktifkan oleh pemilik aplikasi.');
      const ip=req.socket.remoteAddress||'unknown';const now=Date.now();
      let state=attempts.get(ip);if(state&&state.until<=now){attempts.delete(ip);state=null;}
      if(state&&state.count>=10){res.setHeader('Retry-After','60');return end(res,429,'Terlalu banyak percobaan.');}
      if(attempts.size>=10000)return end(res,429,'Coba lagi sebentar.');
      attempts.set(ip,{count:(state?.count||0)+1,until:state?.until||now+60000});
      let body='';req.on('data',chunk=>{body+=chunk;if(body.length>8192)req.destroy();});
      req.on('end',()=>{
        if(body.length>8192)return;
        const data=new URLSearchParams(body);const header='Basic '+Buffer.from((data.get('username')||'')+':'+(data.get('password')||'')).toString('base64');
        if(!authenticated({headers:{authorization:header}},cfg))return loginPage(res);
        attempts.delete(ip);for(const [key,value]of sessions)if(value.until<now)sessions.delete(key);
        if(sessions.size>=1000)return end(res,503,'Terlalu banyak sesi. Coba lagi nanti.');
        const token=crypto.randomBytes(32).toString('hex');const key=crypto.createHash('sha256').update(token).digest('hex');
        sessions.set(key,{user:cfg.username,version:configVersion(cfg),until:Date.now()+8*3600000});
        res.writeHead(303,{'Location':mode==='admin'?'/admin.html':'/','Set-Cookie':cookie(req,token,8*3600),'Cache-Control':'no-store'});res.end();
      });return true;
    }
    if (route === '/__security/logout') {
      if(req.method!=='POST'||!sameOrigin(req))return end(res,403,'Permintaan ditolak.');
      const cfg=credentials();const saved=cfg&&session(req,cfg);if(saved)sessions.delete(saved.key);
      res.writeHead(303,{'Location':'/','Set-Cookie':cookie(req,'',0),'Cache-Control':'no-store'});res.end();return true;
    }

    const parts = route.toLowerCase().split('/').filter(Boolean);
    const base = parts.at(-1) || '';
    if (parts.some(x => x.startsWith('.') || ['node_modules','vendor','sessions','backups','backup','work','outputs'].includes(x)) || /^(server|security-guard|security-setup|authenticator-gate|shared-database|convert_tagihan)\.(js|cjs|mjs)$/.test(base) || /^(package(?:-lock)?\.json|composer\.(json|lock)|render\.ya?ml|gemini\.md|agents\.md)$/.test(base) || /\.(env|config|settings|ini|pem|key|pfx|sql|sqlite3?|db|sdf|bak|log|map|py|php|vb|java|ps1|bat|cmd|zip|rar|7z|docx|xlsx?|csv)$/i.test(base)) return end(res,403,'Akses ditolak.');
    if (/\.json$/i.test(base) && base !== 'manifest.json') return end(res,403,'Akses ditolak.');
    const dataRoute = /^\/(data_(?:leads|tagihan|booking)\.js|cleaned_leads\.json)$/i.test(route);
    const protectedRoute = mode === 'private' ? !['/health','/ping'].includes(route) : mode === 'admin' ? /^\/(admin(?:[/.]|$)|api\/admin(?:\/|$))/i.test(route) : dataRoute;
    if (protectedRoute && !req.securityTotpVerified) {
      res.setHeader('Cache-Control','no-store');
      const cfg = credentials();
      if (!cfg) return end(res,503,'Akses belum diaktifkan oleh pemilik aplikasi.');
      const ip = req.socket.remoteAddress || 'unknown';
      const now = Date.now();
      let state = attempts.get(ip);
      if (state && state.until <= now) { attempts.delete(ip); state = null; }
      if (state && state.count >= 10) { res.setHeader('Retry-After','60'); return end(res,429,'Terlalu banyak percobaan. Coba lagi sebentar.'); }
      const ownerSession = session(req,cfg);
      if (!ownerSession && !authenticated(req,cfg)) {
        if (attempts.size >= 10000) return end(res,429,'Coba lagi sebentar.');
        attempts.set(ip,{count:(state?.count||0)+1,until:state?.until||now+60000});
        if ((req.headers.accept||'').includes('text/html') && !route.startsWith('/api/')) return loginPage(res);
        return end(res,401,'Silakan masuk melalui /__security/login.');
      }
      if (!['GET','HEAD','OPTIONS'].includes(req.method || 'GET')) {
        let originHost; try { originHost = new URL(req.headers.origin || '').host; } catch { return end(res,403,'Permintaan harus berasal dari aplikasi yang sama.'); }
        if (originHost !== req.headers.host) return end(res,403,'Permintaan lintas situs ditolak.');
      }
      req.securityUser = cfg.username;
    }
    if (route === '/api/admin/password' && mode === 'admin') {
      if (req.method !== 'POST') return end(res,405,'Metode tidak diizinkan.');
      if (process.env.SECURITY_ADMIN_PASSWORD) return end(res,409,'Akun hosting dikelola oleh pemilik melalui pengaturan hosting.');
      let origin;
      try { origin = new URL(req.headers.origin || '').host; } catch { return end(res,403,'Permintaan ditolak.'); }
      if (origin !== req.headers.host || !(req.headers['content-type'] || '').startsWith('application/json')) return end(res,403,'Permintaan ditolak.');
      let body='';
      req.on('data',chunk=>{body+=chunk;if(body.length>8192)req.destroy();});
      req.on('end',()=>{
        try {
          const data=JSON.parse(body); const cfg=credentials();
          if (!data || typeof data.currentPassword!=='string' || typeof data.password!=='string' || data.password.length<16 || data.password.length>1024 || !/^[a-zA-Z0-9_.@-]{1,64}$/.test(data.username)) return end(res,400,'Username tidak valid atau password kurang dari 16 karakter.');
          if (!authenticated({headers:{authorization:'Basic '+Buffer.from(cfg.username+':'+data.currentPassword).toString('base64')}},cfg)) return end(res,403,'Password saat ini tidak cocok.');
          const salt=crypto.randomBytes(16).toString('hex');
          const hash=crypto.scryptSync(data.password,salt,32).toString('hex');
          const tmp=localFile+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';
          fs.writeFileSync(tmp,JSON.stringify({username:data.username,salt,hash})+'\n',{mode:0o600,flag:'wx'});
          fs.renameSync(tmp,localFile); configStamp=''; accepted.clear(); sessions.clear();
          res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({success:true}));
        } catch { end(res,400,'Perubahan gagal. Periksa data dan coba lagi.'); }
      }); return true;
    }
    if (route === '/api/admin/session' && mode === 'admin') {
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end(JSON.stringify({username:req.securityUser})); return true;
    }
    if (!route.startsWith('/api/') && route !== '/uploads' && !route.startsWith('/uploads/')) {
      const staticRoot = mode === 'private' ? path.join(root, 'public') : root;
      const candidate = path.resolve(staticRoot, '.' + route);
      const relative = path.relative(staticRoot,candidate);
      if (relative.startsWith('..') || path.isAbsolute(relative)) return end(res,403,'Akses ditolak.');
      try {
        const real = fs.realpathSync(candidate);
        const rel = path.relative(fs.realpathSync(staticRoot),real);
        if (rel.startsWith('..') || path.isAbsolute(rel) || path.normalize(rel).toLowerCase() !== path.normalize(relative).toLowerCase()) return end(res,403,'Akses ditolak.');
      } catch { /* The existing handler produces the normal missing-file response. */ }
    }
    // Normalize the path used by the existing static handler, retaining the query.
    req.url = route + ((req.url || '').includes('?') ? '?' + req.url.split('?').slice(1).join('?') : '');
    return false;
  };
};
