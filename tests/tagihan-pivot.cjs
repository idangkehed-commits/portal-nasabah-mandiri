const assert=require('node:assert/strict'),X=require('../lib/xlsx.full.min.js');
const P=require('../tagihan-pivot.js'),C=require('../tagihan-cleaner.js');
const rec=(id,b=Buffer.alloc(0))=>{const h=Buffer.alloc(4);h.writeUInt16LE(id);h.writeUInt16LE(b.length,2);return Buffer.concat([h,b]);};
const str=s=>{const text=Buffer.from(s,'utf16le'),b=Buffer.alloc(3);b.writeUInt16LE(s.length);b[2]=1;return Buffer.concat([b,text]);};
const val=v=>v==null?rec(0xcf):typeof v==='number'?(()=>{const b=Buffer.alloc(8);b.writeDoubleLE(v);return rec(0xc9,b);})():rec(0xcd,str(v));
const headers=[...C.columns.map(c=>c[1]),'mbu','posisi','catatan'];
const staff=Array.from({length:300},(_,i)=>i?'Petugas '+i:null);
function fixture(valid=true,truncate=false){
  const h=Buffer.alloc(21);h.writeInt32LE(5);h.writeUInt16LE(2,4);h.writeUInt16LE(3,6);h.writeUInt16LE(headers.length,10);h.writeUInt16LE(headers.length,12);h.writeUInt16LE(0xffff,18);
  const pieces=[rec(0xc6,h),rec(0x122,Buffer.alloc(12))];
  headers.forEach((name,i)=>{const b=Buffer.alloc(14);if(i===2){b.writeUInt16LE(0x201);b.writeUInt16LE(staff.length,12);}pieces.push(rec(0xc7,Buffer.concat([b,str(name)])),rec(0x1bb,Buffer.alloc(2)));if(i===2)pieces.push(...staff.map(s=>val(s)));});
  const row=(id,unit,jt)=>['13131A',9000000001,299,id,'KUR','Nasabah Contoh',100,90,1,1,46000,jt,null,1000000,0,1310000000011,0,unit,46321,'catatan asli'];
  const rows=[row(1310000000001,'Bandung Rancaekek 1',20),row(1310000000002,'Bandung Rancaekek 2',5),row(1310000000003,'Bandung Rancaekek 1',5),Array(headers.length).fill(null),Array(headers.length).fill(null)];
  rows[3][5]='dummy';
  for(const row of rows){const index=Buffer.alloc(2);index.writeUInt16LE(row[2]??0);pieces.push(rec(0xc8,index));row.forEach((v,i)=>{if(i!==2)pieces.push(val(v));});}
  pieces.push(rec(0xa));let cache=Buffer.concat(pieces);if(truncate)cache=cache.subarray(0,cache.length-1);
  const meta=(sub,n)=>{const b=Buffer.alloc(12);b.writeUInt16LE(0x864);b[4]=3;b[5]=sub;b.writeUInt32LE(n,6);return rec(0x864,b);};
  const cfb=X.CFB.utils.cfb_new();X.CFB.utils.cfb_add(cfb,'Workbook',Buffer.concat([meta(0,2),meta(0x34,valid?1:3),meta(0xff,0)]));X.CFB.utils.cfb_add(cfb,'_SX_DB_CUR/0002',cache);
  return X.CFB.write(cfb,{type:'buffer'});
}
const parsed=P.read(fixture(),X),prepared=C.prepareRows(parsed,X);
assert.equal(parsed.rows.length,3);assert.equal(parsed.skipped,2);assert.equal(parsed.rows[0].cells[2].v,'Petugas 299');
assert.equal(prepared.branches.length,1);assert.equal(prepared.branches[0].count,3);assert.equal(prepared.branches[0].name,'Bandung Rancaekek');
assert.equal(prepared.reportDate,'2026-10-26');
const result=C.convertPrepared(prepared,X,['13131A']);
assert.equal(result.headers.length,20);assert.equal(result.workbook.Sheets.ALL['!cols'][17].hidden,true);assert.equal(result.workbook.Sheets.ALL['!cols'][6].hidden,false);
assert.equal(result.workbook.Sheets.ALL.T4.v,'catatan asli');
assert.throws(()=>P.read(fixture(false),X),/belum valid/);assert.throws(()=>P.read(fixture(true,true),X),/terpotong/);
assert.equal(P.read(new Uint8Array([1,2,3]),X),null);
console.log('Pivot reader: valid cache override, Unicode, wide dictionary indexes, dummy/blank exclusion, merged branch codes, hidden extra columns, report date and invalid/truncated rejection passed.');
