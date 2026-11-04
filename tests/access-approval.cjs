'use strict';
const assert=require('node:assert/strict'),http=require('node:http');
const factory=require('../authenticator-gate.cjs');
const secret='JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',password='test-admin-password-only';
const gate=factory({ACCESS_TOTP_SECRET:secret,PORTAL_ADMIN_PASSWORD:password});
const server=http.createServer((req,res)=>{if(!gate(req,res)){res.end(req.portalRole||'none');}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 async function call(path,{cookie='',method='POST',origin=base,body}={}){const r=await fetch(base+path,{method,redirect:'manual',headers:{Origin:origin,Cookie:cookie,...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body});return {status:r.status,text:await r.text(),cookie:r.headers.get('set-cookie'),location:r.headers.get('location')};}
 const cookie=r=>r.cookie.split(';')[0];
 assert.equal((await call('/__access/requests/start',{origin:'https://evil.example'})).status,403);
 assert.equal((await call('/__access/requests',{method:'GET'})).status,403);
 const start=await call('/__access/requests/start');const requester=cookie(start);assert.equal(start.status,200);
 assert.equal(JSON.parse((await call('/__access/requests/status')).text).state,'expired');
 const code=factory.codeAt(factory.decodeSecret(secret),Math.floor(Date.now()/30000));
 const login=await call('/__access/admin',{body:new URLSearchParams({password,code}).toString()});assert.equal(login.status,303);const admin=cookie(login);
 const list=JSON.parse((await call('/__access/requests',{method:'GET',cookie:admin})).text);assert.equal(list.requests.length,1);assert.equal(list.requests[0].code,JSON.parse(start.text).code);
 const route='/__access/requests/'+list.requests[0].id+'/approve';
 assert.equal((await call(route,{cookie:requester})).status,403);
 assert.equal((await call(route,{cookie:admin,origin:'https://evil.example'})).status,403);
 assert.equal((await call(route,{cookie:admin})).status,200);
 assert.equal(JSON.parse((await call('/__access/requests/status')).text).state,'expired');
 const accepted=await call('/__access/requests/status',{cookie:requester});assert.equal(JSON.parse(accepted.text).state,'approved');assert.match(accepted.cookie,/HttpOnly/);assert.match(accepted.cookie,/Max-Age=1800/);
 assert.equal((await call('/',{method:'GET',cookie:cookie(accepted)})).text,'viewer');
 assert.equal((await call('/__access/requests',{method:'GET',cookie:cookie(accepted)})).status,403);
 assert.equal(JSON.parse((await call('/__access/requests/status',{cookie:requester})).text).state,'expired');
 const next=await call('/__access/requests/start');const pending=JSON.parse((await call('/__access/requests',{method:'GET',cookie:admin})).text).requests[0];
 await call('/__access/requests/'+pending.id+'/deny',{cookie:admin});const denied=await call('/__access/requests/status',{cookie:cookie(next)});assert.equal(JSON.parse(denied.text).state,'denied');assert.equal(denied.cookie,null);
 const third=await call('/__access/requests/start');const originalNow=Date.now;try{Date.now=()=>originalNow()+301000;assert.equal(JSON.parse((await call('/__access/requests/status',{cookie:cookie(third)})).text).state,'expired');}finally{Date.now=originalNow;}
 console.log('PASS: owner authentication, CSRF, browser binding, viewer-only role, 30-minute session, single redemption, denial and expiry');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
