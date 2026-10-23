'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const build=crypto.createHash('sha256');
for(const name of ['ksm.html','ksm-api.cjs','mobile.css','mobile.js','index.html','sppk.html','app.js','viewer.html','viewer.js','shared-client.js','data_import.js','form_manual.js','surat_sp.js']){try{build.update(fs.readFileSync(path.join(__dirname,name)));}catch{}}
const buildId=build.digest('hex').slice(0,16);
function validate(data){
 if(!data||data.format!=='portal-nasabah-backup-v1')throw Error('Format database tidak valid.');
 for(const key of ['pipeline','tagihan','booking'])if(!Array.isArray(data[key])||data[key].length>100000||data[key].some(r=>!r||typeof r!=='object'||Array.isArray(r)||typeof r.nama!=='string'||typeof r.id!=='string'))throw Error('Data '+key+' tidak valid.');
 if(data.booking.some(r=>!Array.isArray(r.fasilitas)))throw Error('Fasilitas Booking tidak valid.');
 return {format:data.format,pipeline:data.pipeline,tagihan:data.tagihan,booking:data.booking};
}
module.exports=function sharedDatabase(env=process.env,injectedPool){
 let pool=injectedPool,ready;
 async function db(){
  if(!pool){if(!env.DATABASE_URL)throw Error('Database bersama belum dikonfigurasi.');const {Pool}=require('pg');const url=new URL(env.DATABASE_URL);for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(key);pool=new Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:true},max:3,connectionTimeoutMillis:15000,idleTimeoutMillis:10000});}
  if(!ready)ready=pool.query('CREATE TABLE IF NOT EXISTS portal_snapshots (version BIGSERIAL PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), payload JSONB NOT NULL)').catch(err=>{ready=null;throw err;});
  await ready;return pool;
 }
 const ksmApi=require('./ksm-api.cjs')(db);
 function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
 return function api(req,res){
  if(ksmApi(req,res))return true;
  const route=(req.url||'').split('?')[0];if(!route.startsWith('/api/portal/'))return false;
  if(!req.securityTotpVerified){json(res,401,{error:'Silakan login.'});return true;}
  const role=req.portalRole||'viewer';
  if(req.method==='GET'&&route==='/api/portal/session'){json(res,200,{role,build:buildId});return true;}
  if(req.method==='GET'&&route==='/api/portal/build'){json(res,200,{build:buildId});return true;}
  if(req.method==='PUT'&&route==='/api/portal/data'){
   if(role!=='admin'){json(res,403,{error:'Hanya admin boleh memperbarui data.'});return true;}
   let origin;try{origin=new URL(req.headers.origin||'').host;}catch{}
   if(origin!==req.headers.host||!(req.headers['content-type']||'').startsWith('application/json')){json(res,403,{error:'Permintaan ditolak.'});return true;}
   let body='',oversize=false;req.on('data',chunk=>{if(oversize)return;body+=chunk;if(Buffer.byteLength(body)>25*1024*1024){oversize=true;json(res,413,{error:'Berkas melebihi 25 MB.'});}});
   req.on('end',async()=>{if(oversize)return;let data;try{data=validate(JSON.parse(body));}catch{json(res,400,{error:'Isi database tidak valid.'});return;}
    let client;try{
     client=await(await db()).connect();await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(66712345)');
     const prior=await client.query('SELECT version FROM portal_snapshots ORDER BY version DESC LIMIT 1');const version=String(prior.rows[0]?.version||0);
     if(req.headers['if-match']!==version){await client.query('ROLLBACK');json(res,409,{error:'Data server sudah berubah. Muat ulang sebelum menerbitkan.'});return;}
     const result=await client.query('INSERT INTO portal_snapshots(payload) VALUES($1::jsonb) RETURNING version,created_at',[JSON.stringify(data)]);
     await client.query('DELETE FROM portal_snapshots WHERE version NOT IN (SELECT version FROM portal_snapshots ORDER BY version DESC LIMIT 5)');await client.query('COMMIT');
     json(res,200,{version:String(result.rows[0].version),updatedAt:result.rows[0].created_at,counts:{pipeline:data.pipeline.length,tagihan:data.tagihan.length,booking:data.booking.length}});
    }catch{if(client)try{await client.query('ROLLBACK');}catch{}json(res,503,{error:'Database belum tersedia. Periksa konfigurasi server.'});}finally{client?.release();}
   });return true;
  }
  if(req.method==='GET'&&(route==='/api/portal/data'||route==='/api/portal/meta')){
   (async()=>{try{const result=await(await db()).query('SELECT version,created_at'+(route.endsWith('/data')?',payload':'')+' FROM portal_snapshots ORDER BY version DESC LIMIT 1');const row=result.rows[0];json(res,200,{version:String(row?.version||0),updatedAt:row?.created_at||null,build:buildId,...(route.endsWith('/data')?{data:row?.payload||null}:{})});}catch{json(res,503,{error:'Database bersama belum tersedia.'});}})();return true;
  }
  json(res,req.method==='GET'?404:403,{error:'Akses tidak diizinkan.'});return true;
 };
};
module.exports.validate=validate;
