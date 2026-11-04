'use strict';
const assert=require('node:assert/strict'),http=require('node:http');
const create=require('../authenticator-gate.cjs');
const secret='JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',password='test-admin-password-only';
const gate=create({ACCESS_TOTP_SECRET:secret,PORTAL_ADMIN_PASSWORD:password});
const server=http.createServer((req,res)=>{if(!gate(req,res))res.end(req.portalRole||'none');});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 async function call(path,{method='GET',cookie='',origin=base,form}={}){const r=await fetch(base+path,{method,redirect:'manual',headers:{Cookie:cookie,Origin:origin,Accept:'text/html',...(form?{'Content-Type':'application/x-www-form-urlencoded'}:{})},...(form?{body:new URLSearchParams(form).toString()}:{})});return {status:r.status,text:await r.text(),location:r.headers.get('location'),cookie:r.headers.get('set-cookie')};}
 const first=await call('/');assert.equal(first.status,200);assert(first.text.includes('name="code"'));assert(!first.text.includes('Minta persetujuan'));assert(!first.text.includes('name="password"'));
 const adminPage=await call('/__access/admin');assert(adminPage.text.includes('name="password"'));assert(!adminPage.text.includes('/__access/approvals'));
 for(const path of ['/__access/request','/__access/approvals']){const r=await call(path);assert.equal(r.status,303);assert.equal(r.location,'/');}
 for(const path of ['/__access/requests/start','/__access/requests/status','/__access/push/test','/__access/microsoft/login'])assert.equal((await call(path,{method:'POST'})).status,410);
 const worker=await call('/__access/owner-sw.js');assert.equal(worker.status,200);assert(worker.text.includes('sub.unsubscribe()'));assert(worker.text.includes('registration.unregister()'));assert(!worker.text.includes('showNotification'));
 const step=Math.floor(Date.now()/30000),code=create.codeAt(create.decodeSecret(secret),step);
 assert.equal((await call('/__access/login',{method:'POST',origin:'https://evil.test',form:{code}})).status,403);
 const viewer=await call('/__access/login',{method:'POST',form:{code}});assert.equal(viewer.status,303);assert.match(viewer.cookie,/Max-Age=1800/);const viewerCookie=viewer.cookie.split(';')[0];
 assert.equal((await call('/',{cookie:viewerCookie})).text,'viewer');
 assert.equal((await call('/__access/login',{method:'POST',form:{code}})).status,401);
 const next=create.codeAt(create.decodeSecret(secret),step+1);
 assert.equal((await call('/__access/admin',{method:'POST',form:{code:next,password:'wrong'}})).status,401);
 const admin=await call('/__access/admin',{method:'POST',form:{code:next,password}});assert.equal(admin.status,303);const adminCookie=admin.cookie.split(';')[0];assert.equal((await call('/',{cookie:adminCookie})).text,'admin');
 const realNow=Date.now;try{Date.now=()=>realNow()+31*60000;assert((await call('/',{cookie:viewerCookie})).text.includes('name="code"'));assert.equal((await call('/',{cookie:adminCookie})).text,'admin');}finally{Date.now=realNow;}
 assert.equal((await call('/__access/logout',{method:'POST',cookie:adminCookie})).status,303);assert((await call('/',{cookie:adminCookie})).text.includes('name="code"'));
 console.log('PASS: OTP-only login, replay prevention, CSRF, admin password, 30-minute viewer expiry, admin session, disabled approvals/push and worker retirement');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
