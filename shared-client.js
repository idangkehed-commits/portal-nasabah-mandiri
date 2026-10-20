/* Online admin: explicit publishing, shared dataset, and build notifications. */
(() => {
 if(!window.__PORTAL_SERVER_AUTHENTICATED__)return;
 let version=null,build='',busy=false,dirty=false,loaded=false;
 const bar=document.createElement('section');bar.style='padding:12px 20px;background:#e0f2fe;color:#12375b;font:14px Arial;display:flex;gap:12px;align-items:center;flex-wrap:wrap';
 bar.innerHTML='<b>Administrator</b><span id="sharedStatus">Memeriksa database bersama...</span><button id="publishShared" type="button" disabled style="padding:8px;border-radius:8px;background:#12375b;color:white">Terbitkan data ke semua pengguna</button><button id="reloadShared" type="button" style="padding:8px;border:1px solid #12375b;border-radius:8px">Muat data server</button><button id="reloadVersion" type="button" hidden>Versi aplikasi baru tersedia - muat ulang</button>';
 document.body.prepend(bar);
 const status=t=>document.getElementById('sharedStatus').textContent=t;
 async function api(path,options={}){const r=await fetch('/api/portal/'+path,{cache:'no-store',...options});if(r.status===401){location.href='/__access/admin';throw Error('Sesi berakhir.');}const result=await r.json();if(!r.ok)throw Error(result.error||'Permintaan gagal.');return result;}
 function refresh(){populateSgpDropdown();populateTagihanPetugasDropdown();updateUI();updateTagihanUI();updateTagihanTabBadge();updateBookingUI();updateBookingTabBadge();}
 async function load(){if(busy)return;if(dirty&&!confirm('Ganti perubahan lokal yang belum diterbitkan dengan data server?'))return;busy=true;try{const result=await api('data');version=result.version;build=result.build;if(result.data){dbNasabah=result.data.pipeline;dbTagihan=result.data.tagihan;dbBooking=result.data.booking;refresh();status('Data server versi '+version+' dimuat.');}else{status('Database server kosong. Impor data lalu terbitkan.');}dirty=false;loaded=true;document.getElementById('publishShared').disabled=false;}catch(err){status(err.message);}finally{busy=false;}}
 document.getElementById('publishShared').onclick=async()=>{
  if(busy||version===null)return;
  if(!confirm(`Terbitkan ke database bersama? Pipeline ${dbNasabah.length}, Tagihan ${dbTagihan.length}, Booking ${dbBooking.length}. Semua pengguna akan menerima pembaruan ini.`))return;
  busy=true;document.getElementById('publishShared').disabled=true;
  try{const result=await api('data',{method:'PUT',headers:{'content-type':'application/json','if-match':String(version)},body:JSON.stringify({format:'portal-nasabah-backup-v1',pipeline:dbNasabah,tagihan:dbTagihan,booking:dbBooking})});version=result.version;dirty=false;status('Berhasil diterbitkan: versi '+version+'. Semua pengguna akan memperbarui otomatis.');}catch(err){status(err.message);}finally{busy=false;document.getElementById('publishShared').disabled=false;}
 };
 document.getElementById('reloadShared').onclick=load;document.getElementById('reloadVersion').onclick=()=>{if(!dirty||confirm('Ada perubahan lokal belum diterbitkan. Tetap muat ulang aplikasi?'))location.reload();};
 document.addEventListener('input',event=>{if(loaded&&event.target.closest('#dataImportModal,#modalUpload,#modalUploadTagihan,#modalUploadBooking'))dirty=true;});
 for(const name of ['saveDatabase','saveTagihanDatabase','saveBookingDatabase']){const original=window[name];if(typeof original==='function')window[name]=function(...args){if(loaded)dirty=true;return original.apply(this,args);};}
 load();setInterval(async()=>{if(document.hidden)return;try{const meta=await api('meta');if(build&&meta.build!==build)document.getElementById('reloadVersion').hidden=false;if(loaded&&meta.version!==version)status('Data server diperbarui. Klik Muat data server untuk mengambil versi terbaru.');}catch(err){status(err.message);}},60000);
})();
