/* Surat Peringatan: salinan data booking untuk surat, tanpa mengubah database. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => Number(n).toLocaleString('id-ID', {minimumFractionDigits:2, maximumFractionDigits:2});
  const words = n => {
    const a = ['', 'satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan','sepuluh','sebelas'];
    if (n < 12) return a[n];
    if (n < 20) return words(n-10)+' belas';
    if (n < 100) return words(Math.floor(n/10))+' puluh '+words(n%10);
    if (n < 200) return 'seratus '+words(n-100);
    if (n < 1000) return words(Math.floor(n/100))+' ratus '+words(n%100);
    if (n < 2000) return 'seribu '+words(n-1000);
    for (const [base,label] of [[1e12,'triliun'],[1e9,'miliar'],[1e6,'juta'],[1000,'ribu']]) {
      if (n >= base) return words(Math.floor(n/base))+' '+label+' '+words(n%base);
    }
    return '';
  };
  const spelling = cents => (words(Math.floor(cents/100)) || 'nol').trim().replace(/\s+/g,' ')+' rupiah'+(cents%100 ? ' '+words(cents%100).trim()+' sen' : '');
  const dateText = value => value ? new Date(value+'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : '[tanggal]';
  const fields = [
    ['nama','Nama nasabah','text',true],['alamat','Alamat nasabah','textarea',true],
    ['rekening','Rekening pinjaman','text',true],['produk','Jenis kredit','text',true],
    ['pk','Nomor perjanjian kredit','text',false],['tglPk','Tanggal PK (sesuai data)','text',false],
    ['nomor','Nomor surat','text',true],['tanggal','Tanggal surat','date',true],
    ['posisi','Tanggal posisi tunggakan','date',true],['hari','Hari menunggak','number',true],
    ['pokok','Tunggakan pokok (Rp)','number',true],['bunga','Tunggakan bunga (Rp)','number',true],
    ['denda','Tunggakan denda (Rp)','number',true],
    ['unit','Cabang / unit penandatangan','text',true],['alamatUnit','Alamat kantor pada kop','textarea',true],
    ['pejabat','Nama penandatangan','text',true],['jabatan','Jabatan','text',true]
  ];
  const defaults = level => level === '3' ? {unit:'Area Bandung Surapati',alamatUnit:'Jl. Surapati No. 2\nBandung 40115, Indonesia',pejabat:'Bayu Anggoro',jabatan:'Area Head'} : {unit:'KCP Bandung Jamsostek',alamatUnit:'Jl. PH.H Mustofa No. 39, Neglasari\nKec. Cibeunying Kaler, Kota Bandung 40124',pejabat:'',jabatan:'Mikro Banking Manager'};
  let selected = null;
  let previousLevel = '1';
  const css = `
    #spModal{position:fixed;inset:0;z-index:80;background:#10243cbb;overflow:auto;padding:20px;color:#17263b}
    #spModal[hidden]{display:none} .sp-shell{max-width:1240px;margin:auto;background:#f1f5f9;border-radius:16px;padding:20px}
    .sp-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:15px}.sp-grid{display:grid;grid-template-columns:minmax(280px,380px) minmax(0,1fr);gap:20px}
    .sp-form{background:white;padding:16px;border-radius:12px}.sp-form label{display:block;font:600 12px Arial;margin:12px 0 5px}.sp-form input,.sp-form select,.sp-form textarea{width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:9px;font:14px Arial;background:white;color:#17263b}.sp-form textarea{min-height:70px}.sp-btn{padding:9px 14px;border-radius:8px;background:#12375b;color:white;font:600 13px Arial;cursor:pointer;border:0}.sp-muted{font:12px/1.5 Arial;color:#64748b}.sp-preview{overflow:auto;background:#dce3eb;padding:16px}.sp-paper{width:210mm;min-height:297mm;box-sizing:border-box;background:white;color:black;padding:20mm 22mm;font:11pt/1.25 Arial;margin:auto}.sp-paper p{margin:0 0 12px}.sp-paper li{margin-bottom:10px;text-align:justify}.sp-paper ol{padding-left:20px}.sp-kop{display:flex;justify-content:space-between;gap:20px;min-height:100px;margin-bottom:-5mm}.sp-kop > .sp-meta{position:relative;top:4mm}.sp-meta{border-collapse:collapse;align-self:flex-start;font:inherit}.sp-meta td{padding:0;vertical-align:top;text-align:left}.sp-meta td:first-child{padding-right:16px;white-space:nowrap}.sp-meta td:nth-child(2){width:14px;min-width:14px}.sp-meta td:last-child{overflow-wrap:anywhere}.sp-facility{margin-bottom:12px}.sp-brand{position:relative;left:9mm;top:-5mm;flex-shrink:0;width:220px;font:8pt/1.2 Arial}.sp-brand img{display:block;width:220px;height:auto;margin-bottom:8px}.sp-table{margin:12px 0 12px 24px;border-collapse:collapse;width:90%}.sp-table td{padding:2px 5px}.sp-table td:last-child{text-align:right;white-space:nowrap}.sp-table tr:last-child{border-top:1px solid black}.sp-sign{margin-top:20px}.sp-sign-name{margin-top:65px;font-weight:bold}.sp-total{padding:12px;background:#e0f2fe;margin-top:12px;font-weight:bold}
    @media(max-width:950px){.sp-grid{grid-template-columns:1fr}#spModal{padding:8px}.sp-shell{padding:12px}}
  `;
  function data() {
    const d = {level:document.getElementById('spLevel').value};
    fields.forEach(([key]) => d[key] = document.getElementById('sp_'+key).value.trim());
    d.cents = ['pokok','bunga','denda'].reduce((s,k) => s+Math.round(Number(d[k] || 0)*100),0);
    return d;
  }
  function sheet(d) {
    const e = key => esc(d[key]);
    const total = money(d.cents/100);
    const roman = {1:'I',2:'II',3:'III'}[d.level];
    const reminder = d.level === '3' ? '<li>Bahwa meskipun kami telah menyampaikan peringatan kepada Saudara sebagaimana surat-surat kami terdahulu, ternyata Saudara mengabaikan peringatan kami tersebut, terbukti sampai dengan saat ini Saudara belum juga melunasi tunggakan fasilitas kredit Saudara.</li>' : '';
    const detail = d.level === '3' ? `<b>Rp ${total} (${esc(spelling(d.cents))}).</b>` : `Rp ${total}, dengan rincian sebagai berikut:<table class="sp-table"><tr><td>a. Tunggakan Pokok</td><td>Rp ${money(d.pokok)}</td></tr><tr><td>b. Tunggakan Bunga</td><td>Rp ${money(d.bunga)}</td></tr><tr><td>c. Tunggakan Denda</td><td>Rp ${money(d.denda)}</td></tr><tr><td>Total Tunggakan</td><td>Rp ${total}</td></tr></table>`;
    return `<article class="sp-paper"><div class="sp-kop"><table class="sp-meta"><tbody><tr><td>Nomor</td><td>:</td><td>${e('nomor')}</td></tr><tr><td>Tanggal</td><td>:</td><td>${esc(dateText(d.tanggal))}</td></tr><tr><td>Lampiran</td><td>:</td><td>-</td></tr></tbody></table><div class="sp-brand">${window.ADVIS_MANDIRI_LOGO_BASE64 ? `<img src="${window.ADVIS_MANDIRI_LOGO_BASE64}" alt="Mandiri">` : '<b>mandiri</b><br>'}PT Bank Mandiri (Persero) Tbk<br>${e('unit')}<br>${e('alamatUnit').replace(/\n/g,'<br>')}</div></div><p>Kepada Yth.<br>Bapak/Ibu ${e('nama')}<br>${e('alamat').replace(/\n/g,'<br>')}</p><p><b>Perihal : <u>Surat Peringatan ${roman} Kredit Segmen Mikro</u></b></p><p>Dengan hormat,</p><p>Sehubungan dengan fasilitas Kredit Segmen Mikro yang telah Bapak/Ibu/Saudara terima berdasarkan pencatatan dan administrasi kami dengan ini kami ingatkan:</p><table class="sp-meta sp-facility"><tbody><tr><td>Jenis kredit</td><td>:</td><td>${e('produk')}</td></tr><tr><td>No. rekening pinjaman</td><td>:</td><td>${e('rekening')}</td></tr>${d.pk ? '<tr><td>No. PK</td><td>:</td><td>'+e('pk')+'</td></tr>' : ''}${d.tglPk ? '<tr><td>Tanggal PK</td><td>:</td><td>'+e('tglPk')+'</td></tr>' : ''}</tbody></table><ol>${reminder}<li>Bahwa sampai dengan tanggal ${esc(dateText(d.posisi))} Bapak/Ibu/Sdr. telah menunggak pembayaran angsuran kredit selama <b>${e('hari')} hari.</b></li><li>Jumlah kewajiban yang harus Bapak/Ibu/Sdr. lunasi sampai dengan tanggal tersebut adalah sebesar ${detail}</li><li>Jumlah kewajiban tersebut harus segera Bapak/Ibu/Sdr. lunasi. Jumlah tersebut di atas akan bertambah sesuai dengan penambahan hari sejak tanggal Surat Peringatan ini.</li></ol><p>Apabila Bapak/Ibu/Sdr. telah melaksanakan kewajiban tersebut, surat ini harap dianggap sebagai pemberitahuan dan dapat diabaikan.</p><p>Demikian kami sampaikan untuk mendapat perhatian Bapak/Ibu/Saudara sepenuhnya.</p><div class="sp-sign">Hormat kami,<br><br><b>PT BANK MANDIRI (PERSERO) Tbk.</b><br>${e('unit')}<div class="sp-sign-name"><u>${e('pejabat') || '[Nama penandatangan]'}</u><br>${e('jabatan')}</div></div></article>`;
  }
  function preview() {
    const d = data();
    document.getElementById('spPreview').innerHTML = sheet(d);
    document.getElementById('spTotal').textContent = 'Total tunggakan: Rp '+money(d.cents/100);
  }
  function applyFacility() {
    const index = document.getElementById('spFacility').value;
    const f = selected?.fasilitas?.[Number(index)];
    if (!f || index === '') return;
    for (const [key,value] of Object.entries({rekening:f.rekPjm,produk:f.jenisKredit,pk:f.noPk,tglPk:f.tglPk})) document.getElementById('sp_'+key).value = value || '';
    preview();
  }
  function chooseDebtor(deb) {
    selected = deb;
    const select = document.getElementById('spFacility');
    select.innerHTML = '<option value="">Pilih fasilitas kredit</option>';
    (deb.fasilitas || []).forEach((f,i) => { const opt = document.createElement('option'); opt.value=i; opt.textContent=[f.jenisKredit,f.rekPjm,f.tglPk].filter(Boolean).join(' / '); select.append(opt); });
    document.getElementById('sp_nama').value = deb.nama || '';
    document.getElementById('sp_alamat').value = [deb.alamat,deb.kelurahan,deb.kecamatan,deb.kota,deb.kodePos].filter(Boolean).join(', ');
    ['rekening','produk','pk','tglPk'].forEach(k => document.getElementById('sp_'+k).value='');
    if ((deb.fasilitas || []).length === 1) { select.value='0'; applyFacility(); }
    preview();
  }
  function search() {
    const q = document.getElementById('spSearch').value.trim().toLowerCase();
    const results = document.getElementById('spResults'); results.replaceChildren();
    if (q.length < 2) return;
    const rows = typeof dbBooking !== 'undefined' ? dbBooking : [];
    rows.filter(d => [d.nama,d.cif,...(d.fasilitas || []).map(f => f.rekPjm)].join(' ').toLowerCase().includes(q)).slice(0,20).forEach(d => {
      const b = document.createElement('button'); b.type='button'; b.className='sp-btn'; b.style='display:block;margin:5px 0;width:100%;text-align:left'; b.textContent=d.nama+' / CIF '+(d.cif || '-'); b.onclick=() => { chooseDebtor(d); results.replaceChildren(); }; results.append(b);
    });
    if (!results.children.length) results.textContent='Tidak ditemukan. Pilih Input manual untuk membuat surat.';
  }
  function valid() {
    const form = document.getElementById('spForm');
    if (!form.reportValidity()) return false;
    for (const [key,,type,required] of fields) {
      const el = document.getElementById('sp_'+key);
      if (required && !el.value.trim()) { el.focus(); return false; }
    }
    return true;
  }
  async function output(pdf) {
    if (!valid()) return;
    const d = data();
    const filename = ('SP-'+d.level+'-'+d.nama+'-'+d.tanggal).replace(/[\\/:*?"<>|]/g,'_');
    if (!pdf) {
      const w = window.open('','_blank');
      if (!w) { alert('Izinkan jendela pop-up untuk mencetak surat.'); return; }
      w.document.write('<!doctype html><html><head><title>'+esc(filename)+'</title><style>'+css+'body{margin:0}@page{size:A4;margin:0}@media print{.sp-paper{margin:0}}</style></head><body>'+sheet(d)+'</body></html>');
      w.document.close();
      await Promise.all(Array.from(w.document.images).map(img => img.decode().catch(()=>{})));
      w.focus(); w.print(); return;
    }
    if (typeof html2pdf !== 'function') { alert('Pustaka PDF tidak tersedia. Gunakan Cetak dan pilih Simpan sebagai PDF.'); return; }
    const button = document.getElementById('spPdf'); button.disabled=true; button.textContent='Membuat PDF...';
    const host = document.createElement('div'); host.innerHTML=sheet(d); host.firstElementChild.style.minHeight='296mm'; document.body.append(host);
    try {
      await Promise.all(Array.from(host.querySelectorAll('img')).map(img => img.decode().catch(()=>{})));
      await html2pdf().set({margin:0,filename:filename+'.pdf',image:{type:'jpeg',quality:0.98},html2canvas:{scale:2,scrollX:0,scrollY:0},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},pagebreak:{mode:['css','legacy']}}).from(host.firstElementChild).save();
    } catch(error) { console.error('SP PDF:',error); alert('PDF gagal dibuat. Gunakan Cetak dan pilih Simpan sebagai PDF.'); }
    finally { host.remove(); button.disabled=false; button.textContent='Unduh PDF'; }
  }
  function init() {
    const style=document.createElement('style'); style.textContent=css; document.head.append(style);
    const modal=document.createElement('div'); modal.id='spModal'; modal.hidden=true; modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true'); modal.setAttribute('aria-label','Cetak Surat Peringatan');
    modal.innerHTML=`<div class="sp-shell"><div class="sp-head"><h2 style="font-size:20px;font-weight:bold">Cetak Surat Peringatan</h2><div><button type="button" class="sp-btn" id="spPrint">Cetak</button> <button type="button" class="sp-btn" id="spPdf">Unduh PDF</button> <button type="button" class="sp-btn" id="spClose">Tutup</button></div></div><div class="sp-grid"><form id="spForm" class="sp-form"><p class="sp-muted">Data surat dapat diedit tanpa mengubah database booking. Tanggal, hari, dan tunggakan diisi manual. Kolom bertanda * wajib diisi.</p><label for="spMode">Sumber data</label><select id="spMode"><option value="booking">Database booking</option><option value="manual">Input manual</option></select><div id="spBooking"><label for="spSearch">Cari nama, CIF, atau rekening</label><input id="spSearch" placeholder="Ketik minimal 2 karakter" autocomplete="off"><div id="spResults" class="sp-muted"></div><label for="spFacility">Fasilitas kredit</label><select id="spFacility"><option value="">Pilih nasabah terlebih dahulu</option></select></div><label for="spLevel">Jenis surat</label><select id="spLevel"><option value="1">SP 1</option><option value="2">SP 2</option><option value="3">SP 3</option></select><p class="sp-muted">SP 3 memuat pernyataan bahwa peringatan sebelumnya telah disampaikan. Pastikan riwayatnya sesuai.</p>${fields.map(([k,label,type,required]) => `<label for="sp_${k}">${label}${required?' *':''}</label>${type==='textarea' ? `<textarea id="sp_${k}" ${required?'required':''}></textarea>` : `<input id="sp_${k}" type="${type}" ${required?'required':''} ${type==='number' ? `min="0" max="${k==='hari'?'999999':'999999999999.99'}" step="${k==='hari'?'1':'0.01'}"` : ''}>`}`).join('')}<div id="spTotal" class="sp-total"></div><p class="sp-muted">Periksa kop dan pejabat penandatangan sebelum mencetak. Tersedia ruang untuk tanda tangan basah.</p></form><div class="sp-preview" id="spPreview"></div></div></div>`;
    document.body.append(modal);
    document.getElementById('spForm').onsubmit=e=>e.preventDefault();
    document.getElementById('spForm').addEventListener('input',preview);
    document.getElementById('spSearch').addEventListener('input',search);
    document.getElementById('spFacility').onchange=applyFacility;
    document.getElementById('spMode').onchange=() => {
      const manual=document.getElementById('spMode').value==='manual';
      document.getElementById('spBooking').hidden=manual;
      if (manual) { selected=null; ['nama','alamat','rekening','produk','pk','tglPk'].forEach(k=>document.getElementById('sp_'+k).value=''); document.getElementById('spFacility').innerHTML='<option value="">Pilih nasabah terlebih dahulu</option>'; }
      preview();
    };
    document.getElementById('spLevel').onchange=()=>{
      const level=document.getElementById('spLevel').value;
      if (level==='3' || previousLevel==='3') Object.entries(defaults(level)).forEach(([k,v])=>document.getElementById('sp_'+k).value=v);
      previousLevel=level; preview();
    };
    document.getElementById('spClose').onclick=()=>{modal.hidden=true; if (window.spReturnFocus) window.spReturnFocus.focus();};
    modal.addEventListener('keydown',e=>{
      if(e.key==='Escape') document.getElementById('spClose').click();
      if(e.key==='Tab') { const items=Array.from(modal.querySelectorAll('button,input,select,textarea')).filter(x=>!x.disabled && x.getClientRects().length); const first=items[0],last=items[items.length-1]; if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();} }
    });
    document.getElementById('spPrint').onclick=()=>output(false);
    document.getElementById('spPdf').onclick=()=>output(true);
  }
  window.openSuratSP = (fromBooking=false) => {
    if(!document.getElementById('spModal')) init();
    window.spReturnFocus=document.activeElement;
    document.getElementById('spForm').reset(); selected=null; previousLevel='1';
    document.getElementById('spBooking').hidden=false;
    document.getElementById('spResults').replaceChildren();
    document.getElementById('spFacility').innerHTML='<option value="">Pilih nasabah terlebih dahulu</option>';
    Object.entries(defaults('1')).forEach(([k,v])=>document.getElementById('sp_'+k).value=v);
    if (fromBooking && typeof currentActiveBooking!=='undefined' && currentActiveBooking) chooseDebtor(currentActiveBooking);
    document.getElementById('spModal').hidden=false; preview(); document.getElementById('spMode').focus();
  };
})();
