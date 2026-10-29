'use strict';
importScripts('lib/xlsx.full.min.js','lib/jszip.min.js','tagihan-pivot.js?v=20261029_branches','tagihan-cleaner.js?v=20261029_auto');
let prepared=null;
const safeName=value=>String(value).replace(/[<>:"/\\|?*\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim();
self.onmessage=async event=>{
  try{
    const message=event.data;
    if(message.type==='load'){
      prepared=null;
      const pivot=TagihanPivot.read(message.data,XLSX);
      prepared=pivot?TagihanCleaner.prepareRows(pivot,XLSX):TagihanCleaner.prepare(XLSX.read(message.data,{type:'array',cellNF:true,cellDates:false}),XLSX);
      self.postMessage({type:'loaded',branches:prepared.branches,count:prepared.rows.length,columns:prepared.headers.length,reportDate:prepared.reportDate});
    }else if(message.type==='export'){
      if(!prepared)throw Error('Unggah laporan terlebih dahulu.');
      const codes=new Set(message.codes),branches=prepared.branches.filter(b=>codes.has(b.code));
      if(!branches.length||branches.length!==codes.size)throw Error('Pilihan cabang tidak valid.');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(message.date)||new Date(message.date+'T00:00:00Z').toISOString().slice(0,10)!==message.date)throw Error('Lengkapi tanggal laporan.');
      const date=message.date.split('-').reverse().join('-');
      const zip=new JSZip();let single=null,filename='',completed=0;
      const usedNames=new Set();
      for(const branch of branches){
        self.postMessage({type:'progress',completed,total:branches.length,name:branch.name});
        const converted=TagihanCleaner.convertPrepared(prepared,XLSX,[branch.code]);
        const bytes=await TagihanCleaner.write(converted,XLSX,JSZip);
        filename='RaportMU '+date+' '+safeName(branch.name)+'.xlsx';
        if(usedNames.has(filename))filename='RaportMU '+date+' '+safeName(branch.name)+' '+safeName(branch.code)+'.xlsx';
        usedNames.add(filename);
        if(branches.length===1)single=bytes;else zip.file(filename,bytes);
        completed++;
      }
      const bytes=single||await zip.generateAsync({type:'uint8array',compression:'STORE'});
      self.postMessage({type:'ready',data:bytes.buffer,filename:single?filename:'RaportMU '+date+' '+branches.length+' Cabang.zip',mime:single?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/zip',files:branches.length},[bytes.buffer]);
    }
  }catch(error){self.postMessage({type:'error',message:error.message||'Laporan tidak dapat diproses.'});}
};
