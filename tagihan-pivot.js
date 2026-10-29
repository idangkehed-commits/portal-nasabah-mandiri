/* Read-only BIFF8 PivotCache reader. No VBA, external refresh or formula execution. */
(function(global){
  'use strict';
  const required=['kocab','CIF','nama_mks','acctno','produk','nama','limit','bade','kol_Is','kol_Was','tglcair','tgl_jt_angs','hr_tgg','angsuran','total_tgg','AGF1','Saldo_AGF1'];
  function read(data,XLSX){
    const bytes=new Uint8Array(data);
    if(bytes[0]!==0xd0||bytes[1]!==0xcf||bytes[2]!==0x11||bytes[3]!==0xe0)return null;
    const cfb=XLSX.CFB.read(bytes,{type:'array'});
    const caches=cfb.FullPaths.map((path,i)=>({path,i})).filter(x=>/\/_SX_DB_CUR\/[0-9a-f]{4}$/i.test(x.path));
    if(!caches.length)return null;
    const norm=v=>String(v).trim().toLowerCase();
    function reader(content){
      const a=new Uint8Array(content),view=new DataView(a.buffer,a.byteOffset,a.byteLength);let pos=0;
      return {next(){if(pos===a.length)return null;if(pos+4>a.length)throw Error('Struktur cache Excel terpotong.');const id=view.getUint16(pos,true),len=view.getUint16(pos+2,true);pos+=4;if(pos+len>a.length)throw Error('Struktur cache Excel terpotong.');const b=a.subarray(pos,pos+len);pos+=len;return {id,b,v:new DataView(b.buffer,b.byteOffset,b.byteLength)};}};
    }
    function string(b,offset=0){
      const v=new DataView(b.buffer,b.byteOffset,b.byteLength);
      if(offset+3>b.length)throw Error('Teks cache Excel tidak lengkap.');
      const count=v.getUint16(offset,true),flags=b[offset+2];
      if(flags&0xfe)throw Error('Format teks cache Excel ini belum didukung.');
      const width=(flags&1)?2:1,start=offset+3;if(start+count*width!==b.length)throw Error('Panjang teks cache Excel tidak sesuai.');
      let text='';for(let i=0;i<count;i++)text+=String.fromCharCode(width===2?v.getUint16(start+i*2,true):b[start+i]);return text;
    }
    function value(r){
      if(!r)throw Error('Data cache Excel tidak lengkap.');
      if(r.id===0xcf&&r.b.length===0)return null;
      if(r.id===0xc9&&r.b.length===8){const n=r.v.getFloat64(0,true);if(!Number.isFinite(n))throw Error('Nominal cache Excel tidak valid.');return n;}
      if(r.id===0xcd)return string(r.b);
      if(r.id===0xca&&r.b.length===2)return Boolean(r.v.getUint16(0,true));
      if(r.id===0xcc&&r.b.length===2)return r.v.getInt16(0,true);
      if(r.id===0xce&&r.b.length===8){const y=r.v.getUint16(0,true),m=r.v.getUint16(2,true),d=r.b[4],h=r.b[5],min=r.b[6],s=r.b[7];if(y===1900&&m===1&&d===0&&h<24&&min<60&&s<60)return (h*3600+min*60+s)/86400;if(m<1||m>12||d<1||d>31||h>23||min>59||s>59)throw Error('Tanggal cache Excel tidak valid.');return (Date.UTC(y,m-1,d,h,min,s)-Date.UTC(1899,11,30))/86400000;}
      throw Error('Jenis data cache Excel ini belum didukung (record '+r.id.toString(16)+').');
    }
    // New Excel cache-validity flags override the legacy SXDB fInvalid bit.
    const bookIndex=cfb.FullPaths.findIndex(p=>/\/(Workbook|Book)$/.test(p));
    const validity=new Map();
    if(bookIndex>=0){const it=reader(cfb.FileIndex[bookIndex].content);let current=null,r;while((r=it.next()))if(r.id===0x864&&r.b.length>=12&&r.b[4]===3){if(r.b[5]===0)current=r.v.getUint32(6,true);else if(r.b[5]===0x34&&current!==null)validity.set(current,!(r.v.getUint32(6,true)&2));else if(r.b[5]===0xff)current=null;}}
    const results=[];
    for(const entry of caches){
      const it=reader(cfb.FileIndex[entry.i].content),header=it.next();
      if(header?.id!==0xc6||header.b.length<20)continue;
      const total=header.v.getInt32(0,true),id=header.v.getUint16(4,true),flags=header.v.getUint16(6,true),base=header.v.getInt16(10,true),fieldCount=header.v.getInt16(12,true);
      if(fieldCount<1||fieldCount>512||base!==fieldCount)continue;
      const fields=[];let r=it.next();if(r?.id!==0x122)continue;r=it.next();
      for(let i=0;i<fieldCount;i++){
        if(r?.id!==0xc7||r.b.length<17)throw Error('Definisi kolom cache Excel tidak sesuai.');
        const f={name:string(r.b,14),flags:r.v.getUint16(0,true),items:[],count:r.v.getUint16(12,true)};
        if(f.flags&(8|16|0x8000)||r.v.getUint16(8,true)||r.v.getUint16(10,true))throw Error('Cache dengan kolom kalkulasi atau pengelompokan belum didukung.');
        fields.push(f);r=it.next();if(r?.id===0x1bb)r=it.next();
        for(let j=0;j<f.count;j++){f.items.push(value(r));r=it.next();}
      }
      const names=fields.map(f=>norm(f.name));
      if(!required.every(h=>names.includes(norm(h))))continue;
      if(new Set(names).size!==names.length)throw Error('Nama kolom cache Excel duplikat.');
      if(!(flags&1)||!(validity.has(id)?validity.get(id):!(flags&2)))throw Error('Data detail PivotTable belum valid. Simpan ulang laporan dengan data detail yang sudah diperbarui di Excel.');
      if(total<0||total>1000000)throw Error('Jumlah baris cache Excel tidak valid.');
      const indices=required.map(h=>names.indexOf(norm(h)));const extra=fields.map((f,i)=>i).filter(i=>!indices.includes(i));indices.push(...extra);
      const account=names.indexOf('acctno'),unit=names.indexOf('mbu'),name=names.indexOf('nama');
      const rows=[];let skipped=0;
      for(let i=0;i<total;i++){
        const vals=new Array(fields.length);let offset=0,db=null;
        if(fields.some(f=>f.flags&1)){if(r?.id!==0xc8)throw Error('Baris cache Excel tidak lengkap.');db=r;r=it.next();}
        for(let c=0;c<fields.length;c++){
          const f=fields[c];
          if(f.flags&1){const width=(f.flags&0x200)?2:1;if(offset+width>db.b.length)throw Error('Indeks cache Excel terpotong.');const index=width===2?db.v.getUint16(offset,true):db.b[offset];offset+=width;if(index>=f.items.length)throw Error('Indeks cache Excel tidak valid.');vals[c]=f.items[index];}
          else{vals[c]=value(r);r=it.next();}
        }
        if(db&&offset!==db.b.length)throw Error('Lebar baris cache Excel tidak sesuai.');
        if(vals[account]==null||String(vals[account]).trim()===''){
          if(vals.every(v=>v==null||v==='')||String(vals[name]).trim().toLowerCase()==='dummy'){skipped++;continue;}
          throw Error('Ada baris detail tanpa nomor rekening. Periksa laporan sumber.');
        }
        rows.push({cells:indices.map(c=>vals[c]==null?undefined:{v:vals[c],t:typeof vals[c]==='number'?'n':typeof vals[c]==='boolean'?'b':'s',...(['posisi','tglcair'].includes(names[c])?{z:'m/d/yy'}:{})}),unit:unit>=0?String(vals[unit]||''):'',order:i});
      }
      if(r?.id!==0x0a||it.next()!==null)throw Error('Jumlah baris detail cache Excel tidak sesuai.');
      results.push({rows,headers:[...required,...extra.map(i=>fields[i].name)],sheetName:'Data laporan lengkap',source:'pivot',skipped});
    }
    if(results.length>1)throw Error('Ada lebih dari satu sumber detail tagihan. Gunakan laporan dengan satu sumber data detail.');
    return results[0]||null;
  }
  const api={read};if(typeof module!=='undefined'&&module.exports)module.exports=api;global.TagihanPivot=api;
})(typeof self!=='undefined'?self:globalThis);
