'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),crypto=require('node:crypto');
const create=require('../owner-access.cjs');let storedKey,subscriptions=new Map(),sent=[];
const pool={async query(sql,args=[]){
 if(sql.startsWith('CREATE TABLE'))return {rows:[]};
 if(sql.startsWith('SELECT value'))return {rows:storedKey?[{value:storedKey}]:[]};
 if(sql.startsWith('INSERT INTO portal_owner_settings')){storedKey??=JSON.parse(args[0]);return {rows:[]};}
 if(sql.startsWith('INSERT INTO portal_owner_push')){subscriptions.set(args[0],JSON.parse(args[1]));return {rows:[]};}
 if(sql.startsWith('SELECT endpoint'))return {rows:[...subscriptions].map(([endpoint,subscription])=>({endpoint,subscription}))};
 if(sql==='DELETE FROM portal_owner_push'){subscriptions.clear();return {rows:[]};}
 if(sql.startsWith('DELETE FROM portal_owner_push WHERE endpoint=$1')){subscriptions.delete(args[0]);return {rows:[]};}
 if(sql.startsWith('DELETE FROM portal_owner_push WHERE endpoint NOT IN'))return {rows:[]};
 throw Error('Unexpected query');
}};
const push={generateVAPIDKeys:()=>require('web-push').generateVAPIDKeys(),async sendNotification(sub,body){sent.push({sub,body:JSON.parse(body)});}};
const access=create({PORTAL_PUBLIC_URL:'https://portal.example'},pool,{webPush:push});assert.equal(access.enabled,false);assert.equal(access.pushEnabled,true);
const server=http.createServer((req,res)=>{if(!access.handle(req,res,req.headers.cookie==='role=admin')){res.statusCode=404;res.end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const call=(path,{method='GET',cookie='role=admin',origin='https://portal.example',data}={})=>fetch(base+path,{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
 assert.equal((await call('/__access/push/key',{cookie:'role=viewer'})).status,403);
 const publicKey=(await (await call('/__access/push/key')).json()).publicKey;assert(publicKey);
 assert.equal((await (await call('/__access/push/key')).json()).publicKey,publicKey);
 const sub={endpoint:'https://fcm.googleapis.com/fcm/send/test-only',keys:{p256dh:crypto.randomBytes(65).toString('base64url'),auth:crypto.randomBytes(16).toString('base64url')}};
 assert.equal((await call('/__access/push/subscribe',{method:'POST',cookie:'role=viewer',data:sub})).status,403);
 assert.equal((await call('/__access/push/subscribe',{method:'POST',origin:'https://evil.test',data:sub})).status,403);
 assert.equal((await call('/__access/push/subscribe',{method:'POST',data:{...sub,endpoint:'https://localhost/admin'}})).status,400);
 assert.equal((await call('/__access/push/subscribe',{method:'POST',data:sub})).status,200);assert.equal(subscriptions.size,1);
 assert.equal((await (await call('/__access/push/test',{method:'POST'})).json()).sent,1);assert.match(sent[0].body.body,/uji/);
 assert.equal((await call('/__access/push/test',{method:'POST'})).status,429);
 await access.notify();assert.equal(sent.length,2);assert(!sent[1].body.body.includes('uji'));
 const afterRestart=create({PORTAL_PUBLIC_URL:'https://portal.example'},pool,{webPush:push});await afterRestart.notify();assert.equal(sent.length,3);
 assert.equal((await call('/__access/push/unsubscribe',{method:'POST',origin:'https://evil.test'})).status,403);
 assert.equal((await call('/__access/push/unsubscribe',{method:'POST'})).status,200);assert.equal(subscriptions.size,0);
 await access.notify();assert.equal(sent.length,3);
 console.log('PASS: admin-only enrollment, CSRF, endpoint validation, stable keys, persisted subscriptions after restart, test notifications, rate limit and unsubscribe');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
