'use strict';
(()=>{
 const status=document.getElementById('status'),admin=!!document.getElementById('requests');
 const pushStatus=document.getElementById('pushStatus')||status;
 const seen=new Set();let running=false;
 async function api(url,method='POST'){const r=await fetch(url,{method,credentials:'same-origin',cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Permintaan gagal.');return d;}
 async function poll(){
  if(running)return;running=true;
  try{
   if(admin){
    const d=await api('/__access/requests','GET'),root=document.getElementById('requests');root.replaceChildren();
    for(const item of d.requests){
     if(!seen.has(item.id)){seen.add(item.id);if(document.getElementById('notify')&&'Notification'in window&&Notification.permission==='granted')try{new Notification('Permintaan akses Portal Nasabah',{body:'Kode '+item.code,tag:item.id});}catch{}}
     const card=document.createElement('article'),code=document.createElement('strong'),time=document.createElement('p');code.textContent=item.code;time.textContent='Berlaku sampai '+new Date(item.until).toLocaleTimeString('id-ID');card.append(code,time);
     for(const[action,label]of [['approve','Setujui'],['deny','Tolak']]){const b=document.createElement('button');b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await api('/__access/requests/'+item.id+'/'+action);await poll();card.remove();}catch(e){status.textContent=e.message;b.disabled=false;}};card.append(b);}root.append(card);
    }status.textContent=d.requests.length?'':'Belum ada permintaan akses.';
   }else{
    const d=await api('/__access/requests/status');
    if(d.state==='approved'){location.replace('/');return;}
    const pending=d.state==='pending';document.getElementById('request').disabled=pending;
    document.getElementById('code').textContent=pending?d.code:'';
    document.getElementById('expiry').textContent=pending?'Berlaku sampai '+new Date(d.until).toLocaleTimeString('id-ID'):'';
    status.textContent=pending?'Menunggu persetujuan pemilik…':d.state==='denied'?'Permintaan ditolak. Anda dapat meminta akses kembali.':'Klik Minta akses untuk membuat permintaan baru.';
   }
  }catch(e){status.textContent=e.message;}finally{running=false;}
 }
 if(admin&&document.getElementById('notify'))document.getElementById('notify').onclick=async()=>{if(!('Notification'in window)){status.textContent='Notifikasi tidak didukung. Permintaan tetap tampil di halaman ini.';return;}try{const p=await Notification.requestPermission();status.textContent=p==='granted'?'Notifikasi aktif selama halaman ini berjalan.':'Permintaan tetap dapat dilihat di halaman ini.';}catch{status.textContent='Gunakan daftar permintaan di halaman ini.';}};
 if(!admin)document.getElementById('request').onclick=async()=>{try{await api('/__access/requests/start');await poll();}catch(e){status.textContent=e.message;}};
 if(document.getElementById('pushEnable'))document.getElementById('pushEnable').onclick=async()=>{
  const button=document.getElementById('pushEnable');button.disabled=true;
  try{
   if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw Error('HP ini belum mendukung notifikasi web. Di iPhone, tambahkan portal ke layar utama dan buka dari ikon portal.');
   pushStatus.textContent='Memeriksa izin notifikasi situs...';
   const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();if(permission!=='granted')throw Error(permission==='denied'?'Izin notifikasi situs ini diblokir Chrome. Buka ikon pengaturan di samping alamat portal > Izin > Notifikasi > Izinkan. Izin aplikasi Chrome di Android saja belum cukup.':'Izin notifikasi situs belum diberikan. Tekan Aktifkan notifikasi HP dan pilih Izinkan saat diminta Chrome.');
   pushStatus.textContent='Izin situs aktif. Menghubungkan HP ke layanan notifikasi...';
   const key=await api('/__access/push/key','GET');
   const registration=await navigator.serviceWorker.register('/__access/owner-sw.js',{scope:'/__access/'});
   if(!registration.active)await new Promise((resolve,reject)=>{const worker=registration.installing||registration.waiting;if(!worker)return reject(Error('Notifikasi belum siap. Coba lagi.'));const timeout=setTimeout(()=>reject(Error('Notifikasi belum siap. Coba lagi.')),15000);worker.addEventListener('statechange',()=>{if(worker.state==='activated'){clearTimeout(timeout);resolve();}});});
   const bytes=Uint8Array.from(atob(key.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
   const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
   pushStatus.textContent='HP terdaftar di browser. Menyimpan perangkat ke portal...';
   const response=await fetch('/__access/push/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(subscription)});const data=await response.json();if(!response.ok)throw Error(data.error||'Notifikasi belum tersimpan.');
   pushStatus.textContent='Notifikasi HP aktif. Halaman ini boleh ditutup. Pengiriman tetap bergantung pada koneksi dan pengaturan notifikasi HP.';
  }catch(e){pushStatus.textContent=(e.name&&e.name!=='Error'?e.name+': ':'')+e.message;}finally{button.disabled=false;}
 };
 if(document.getElementById('pushDisable'))document.getElementById('pushDisable').onclick=async()=>{try{await api('/__access/push/unsubscribe');const registration=await navigator.serviceWorker.getRegistration('/__access/');const subscription=await registration?.pushManager.getSubscription();await subscription?.unsubscribe();pushStatus.textContent='Notifikasi semua perangkat pemilik sudah dimatikan.';}catch(e){pushStatus.textContent=e.message;}};
 if(document.getElementById('ownerLogout'))document.getElementById('ownerLogout').onclick=async()=>{try{await api('/__access/owner/logout');location.replace('/__access/approvals');}catch(e){pushStatus.textContent=e.message;}};
 async function phoneRegistration(){
  if(!('serviceWorker'in navigator)||!('Notification'in window)||Notification.permission!=='granted')throw Error('Izin notifikasi belum aktif. Tekan Aktifkan notifikasi HP dan periksa izin Chrome pada pengaturan Android.');
  const registration=await navigator.serviceWorker.getRegistration('/__access/');
  if(!registration?.active)throw Error('Notifikasi belum siap. Tekan Aktifkan notifikasi HP lagi.');
  return registration;
 }
 if(document.getElementById('pushLocal'))document.getElementById('pushLocal').onclick=async()=>{try{const r=await phoneRegistration();await r.showNotification('Uji tampilan Portal Nasabah',{body:'Ini uji langsung dari HP, bukan kiriman server.',tag:'portal-local-test',data:{url:'/__access/approvals'}});pushStatus.textContent='Uji tampilan dijalankan. Tarik panel notifikasi Android. Jika tidak ada, periksa Pengaturan Android > Aplikasi > Chrome > Notifikasi, serta izin notifikasi situs ini di Chrome.';}catch(e){pushStatus.textContent=e.message;}};
 if(document.getElementById('pushTest'))document.getElementById('pushTest').onclick=async()=>{const b=document.getElementById('pushTest');b.disabled=true;try{
  const registration=await phoneRegistration(),subscription=await registration.pushManager.getSubscription();
  if(!subscription)throw Error('HP ini belum terdaftar. Tekan Aktifkan notifikasi HP terlebih dahulu.');
  const response=await fetch('/__access/push/test',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint})});
  const d=await response.json();if(!response.ok)throw Error(d.error||'Uji gagal.');
  pushStatus.textContent=d.sent?'Layanan push menerima kiriman khusus untuk HP ini. Ini belum memastikan tampil di Android. Jika belum muncul, coba Uji tampilan di HP ini.':'Kiriman ke HP ini belum berhasil. Tekan Aktifkan notifikasi HP untuk mendaftarkan ulang perangkat, lalu coba lagi.';
 }catch(e){pushStatus.textContent=e.message;}finally{b.disabled=false;}};
 async function showPhoneStatus(){
  if(!document.getElementById('pushEnable'))return;
  try{
   if(!('Notification'in window)||!('serviceWorker'in navigator)){pushStatus.textContent='Browser ini tidak mendukung notifikasi web.';return;}
   if(Notification.permission==='denied'){pushStatus.textContent='Notifikasi situs ini diblokir Chrome. Buka ikon pengaturan di samping alamat portal > Izin > Notifikasi > Izinkan. Izin aplikasi di Android saja belum cukup.';return;}
   if(Notification.permission!=='granted'){pushStatus.textContent='Notifikasi situs belum diizinkan. Tekan Aktifkan notifikasi HP.';return;}
   const r=await navigator.serviceWorker.getRegistration('/__access/'),sub=await r?.pushManager.getSubscription();
   if(!sub){pushStatus.textContent='Izin situs sudah aktif, tetapi HP belum didaftarkan. Tekan Aktifkan notifikasi HP.';return;}
   const response=await fetch('/__access/push/status',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})});const data=await response.json();if(!response.ok)throw Error(data.error||'Status belum dapat diperiksa.');
   pushStatus.textContent=data.registered?'Notifikasi HP ini terdaftar di portal. Gunakan Uji tampilan di HP ini untuk memeriksa tampilan Android.':'HP terdaftar di browser tetapi belum tersimpan di portal. Tekan Aktifkan notifikasi HP untuk menyambungkan kembali.';
  }catch(e){pushStatus.textContent=e.message;}
 }
 showPhoneStatus();poll();setInterval(poll,4000);
})();
