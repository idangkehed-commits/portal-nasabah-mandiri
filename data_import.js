/* File imports are read in the browser. No database upload request is sent. */
(() => {
  'use strict';
  let modal, pending;
  function refresh(){populateSgpDropdown();populateTagihanPetugasDropdown();updateUI();updateTagihanUI();updateTagihanTabBadge();updateBookingUI();updateBookingTabBadge();}
  function init(){
    modal=document.createElement('div');modal.id='dataImportModal';modal.hidden=true;
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Impor Data Nasabah');
    modal.style='position:fixed;inset:0;z-index:90;background:#10243cbb;padding:20px;overflow:auto;font:14px/1.5 Arial;color:#17263b';
    modal.innerHTML=`<section style="max-width:620px;margin:5vh auto;background:white;padding:24px;border-radius:16px"><h2 style="font-size:22px;font-weight:bold">Impor Data Nasabah</h2><p>Data dibaca dan disimpan di browser perangkat ini. Tidak dikirim sebagai database ke server.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin:18px 0"><button type="button" id="importPipelineExcel">Excel Pipeline</button><button type="button" id="importTagihanExcel">Excel Tagihan</button><button type="button" id="importBookingExcel">Excel Booking</button></div><hr><h3 style="font-weight:bold;margin-top:16px">Salinan lengkap database lokal</h3><p>Impor berkas salinan .json yang memuat Pipeline, Tagihan, dan seluruh riwayat fasilitas Booking. Data kunjungan dan tindak lanjut yang sudah ada tetap tersimpan.</p><label for="localDatabaseFile" style="display:block;margin:12px 0">Pilih berkas salinan database</label><input id="localDatabaseFile" type="file" accept=".json,application/json"><p id="databaseImportPreview" role="status" style="margin:16px 0;white-space:pre-line"></p><div style="display:flex;gap:10px"><button type="button" id="applyLocalDatabase" disabled>Impor ke browser ini</button><button type="button" id="closeDataImport">Tutup</button></div></section>`;
    modal.querySelectorAll('button').forEach(b=>b.style='border:1px solid #cbd5e1;border-radius:8px;padding:9px 12px;background:#e0f2fe;color:#12375b;font-weight:bold;cursor:pointer');
    document.body.append(modal);
    for(const [id,open] of [['importPipelineExcel',openUploadModal],['importTagihanExcel',openUploadTagihanModal],['importBookingExcel',openModalUploadBooking]])document.getElementById(id).onclick=()=>{modal.hidden=true;open();};
    document.getElementById('closeDataImport').onclick=()=>modal.hidden=true;
    document.getElementById('localDatabaseFile').onchange=async e=>{
      pending=null;const btn=document.getElementById('applyLocalDatabase'),message=document.getElementById('databaseImportPreview');btn.disabled=true;message.textContent='';
      const file=e.target.files[0];if(!file)return;
      try{
        if(file.size>25*1024*1024)throw Error('Ukuran berkas melebihi 25 MB.');
        const parsed=JSON.parse(await file.text());
        if(parsed.format!=='portal-nasabah-backup-v1')throw Error('Format salinan database tidak dikenali.');
        for(const key of ['pipeline','tagihan','booking'])if(!Array.isArray(parsed[key])||parsed[key].some(r=>!r||typeof r!=='object'||Array.isArray(r)||typeof r.nama!=='string'))throw Error('Data '+key+' tidak valid.');
        if(parsed.booking.some(r=>!Array.isArray(r.fasilitas)))throw Error('Riwayat fasilitas booking tidak valid.');
        pending=parsed;
        message.textContent=`Siap diimpor:\nPipeline: ${parsed.pipeline.length} nasabah\nTagihan: ${parsed.tagihan.length} rekening\nBooking: ${parsed.booking.length} debitur / ${parsed.booking.reduce((n,r)=>n+r.fasilitas.length,0)} riwayat fasilitas.\nIsi ketiga database akan diganti dengan salinan ini.`;btn.disabled=false;
      }catch(err){message.textContent=err.message;}
    };
    document.getElementById('applyLocalDatabase').onclick=()=>{
      if(!pending)return;
      const sets=[[STORAGE_KEY,pending.pipeline],[TAGIHAN_STORAGE_KEY,pending.tagihan],[BOOKING_STORAGE_KEY,pending.booking]];
      const old=sets.map(([key])=>[key,localStorage.getItem(key)]);
      try{
        for(const [key,rows]of sets)localStorage.setItem(key,JSON.stringify(rows));
      }catch(err){for(const[key,value]of old){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{}}document.getElementById('databaseImportPreview').textContent='Penyimpanan browser tidak cukup. Impor dibatalkan; data lama dipertahankan.';return;}
      dbNasabah=pending.pipeline;dbTagihan=pending.tagihan;dbBooking=pending.booking;
      refresh();document.getElementById('databaseImportPreview').textContent=`Impor berhasil dan tersimpan di browser ini. Pipeline ${dbNasabah.length}, Tagihan ${dbTagihan.length}, Booking ${dbBooking.length}.`;
      pending=null;document.getElementById('applyLocalDatabase').disabled=true;
      showToast('Database lokal berhasil diimpor ke browser ini.','success');
    };
  }
  window.openDataImport=()=>{if(!modal)init();modal.hidden=false;};
})();
