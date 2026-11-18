/* Surat agunan dan kendaraan: isian manual, tanpa data contoh nasabah. */
(() => {
'use strict';
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const meta=[['nomor','Nomor surat'],['tanggal','Tanggal surat','date'],['lampiran','Lampiran']];
const destination=[['tujuan','Kepada / instansi tujuan','textarea'],['kotaTujuan','Kota / wilayah tujuan']];
const settings=[['bank','Nama bank pada kop'],['cabang','Cabang pada kop'],['alamatKop','Alamat dan kontak pada kop','textarea'],['bankTtd','Nama bank pada tanda tangan'],['unitTtd','Unit / cabang penanda tangan'],['pejabat','Nama penanda tangan'],['jabatan','Jabatan penanda tangan']];
const certificate=[['jenisSertifikat','Jenis sertifikat'],['sertifikat','Nomor sertifikat (lengkap sesuai dokumen, termasuk elektronik)'],['pemilik','Nama pemilik sertifikat']];
const koreksiSubject='Permohonan Koreksi Tanggal Jatuh Tempo Kredit di e-Sertifikat Penjamin (Polis) Asuransi Jamkrindo';
const smeSubject='Keterangan Proses Pengajuan Kredit SME';
const yanuarName='Yanuar Ishak Salahudin';
const yanuarSignatureEndpoint='/api/portal/ksm-signatures/kyc-yanuar';
async function loadYanuarSignature(){
 const response=await fetch(yanuarSignatureEndpoint,{cache:'no-store'});
 if(!response.ok)throw Error(response.status===404?'Gambar tanda tangan Yanuar belum diunggah di portal.':'Gambar tanda tangan Yanuar belum dapat dimuat.');
 const blob=await response.blob();
 if(!['image/jpeg','image/png'].includes(blob.type))throw Error('Format gambar tanda tangan Yanuar tidak valid.');
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Gambar tanda tangan Yanuar belum dapat dibaca.'));reader.readAsDataURL(blob);});
}
const definitions={
 sku:{title:'Surat Keterangan Usaha (SKU)',fields:[
  ['pemda','Pemerintah Kota / Kabupaten pada kop'],
  ['kecamatan','Kecamatan pada kop'],
  ['kelurahan','Kelurahan / Desa pada kop'],
  ['alamatKantor','Alamat kantor kelurahan/desa pada kop','textarea'],
  ['nomor','Nomor surat'],
  ['nama','Nama lengkap pemohon'],
  ['lahir','Tempat / tanggal lahir'],
  ['nik','NIK / No. KTP'],
  ['agama','Agama'],
  ['pekerjaan','Pekerjaan'],
  ['alamat','Alamat rumah / KTP pemohon','textarea'],
  ['jenisUsaha','Jenis usaha'],
  ['namaUsaha','Nama / Merk usaha'],
  ['mulaiUsaha','Mulai usaha sejak'],
  ['alamatUsaha','Alamat tempat usaha','textarea'],
  ['kota','Kota penandatanganan'],
  ['tanggal','Tanggal penandatanganan','date'],
  ['jabatan','Jabatan penanda tangan'],
  ['pejabat','Nama penanda tangan'],
  ['nip','NIP penanda tangan']
 ]},
 domisili:{title:'Surat Keterangan Domisili',fields:[
  ['pemda','Pemerintah Kota / Kabupaten pada kop'],
  ['kecamatan','Kecamatan pada kop'],
  ['kelurahan','Kelurahan / Desa pada kop'],
  ['alamatKantor','Alamat kantor kelurahan/desa pada kop','textarea'],
  ['nomor','Nomor surat'],
  ['nama','Nama lengkap pemohon'],
  ['lahir','Tempat / tanggal lahir'],
  ['nik','NIK / No. KTP'],
  ['kelamin','Jenis kelamin'],
  ['kewarganegaraan','Kewarganegaraan'],
  ['agama','Agama'],
  ['pekerjaan','Pekerjaan'],
  ['alamatKtp','Alamat asal sesuai KTP','textarea'],
  ['alamatDomisili','Alamat tempat tinggal / domisili saat ini','textarea'],
  ['keperluan','Keperluan surat keterangan','textarea'],
  ['kota','Kota penandatanganan'],
  ['tanggal','Tanggal penandatanganan','date'],
  ['jabatan','Jabatan penanda tangan'],
  ['pejabat','Nama penanda tangan'],
  ['nip','NIP penanda tangan']
 ]},
 sme:{title:smeSubject,fields:[...meta,['nama','Nama perusahaan'],['tujuan','Kepada (kosongkan untuk Direksi perusahaan)','textarea',false],['perihal','Perihal'],['isiSme','Isi surat (gunakan {perusahaan})','textarea'],...settings]},
 koreksiJT:{title:'Surat Permohonan Koreksi Tanggal Jatuh Tempo',fields:[...meta,
  ['tujuan','Kepada / alamat tujuan','textarea'],['perihal','Perihal manual','textarea'],
  ['polis','Nomor e-Polis Asuransi KUR'],['penjamin','Nama perusahaan penjamin'],
  ['nama','Nama debitur'],['los','Nomor aplikasi LOS'],['limit','Limit (Rp, boleh disertai terbilang)'],
  ['jatuhTempoPolis','Tanggal jatuh tempo di polis','date'],['jatuhTempoBenar','Tanggal jatuh tempo sebenarnya','date'],
  ['tenorPolis','Jangka Waktu di Polis'],['tenorBenar','Jangka Waktu Sebenarnya'],...settings]},
 kyc:{title:'Surat KYC Calon Debitur',fields:[...meta,...destination,
  ['nama','Nama calon debitur'],['perusahaan','Nama perusahaan'],['posisi','Jabatan saat ini'],
  ['mulaiPosisi','Tanggal mulai menjabat','date'],['bankGaji','Bank pembayaran gaji'],
  ['tanggalGaji','Tanggal pembayaran gaji setiap bulan'],['nominalGaji','Nominal gaji (Rp)'],
  ['posisiPromosi','Jabatan setelah promosi'],['tanggalPromosi','Tanggal efektif promosi','date'],...settings]},
 mitra:{title:'Surat Perubahan Data Mitra ID',fields:[...meta,['mitraId','Mitra ID'],['namaMitra','Nama Mitra'],['unitMitra','Unit Pengelola Mitra ID'],...Array.from({length:3},(_,i)=>[['data'+i,'Data yang diubah '+(i+1)],['sebelum'+i,'Sebelum '+(i+1)],['menjadi'+i,'Menjadi '+(i+1)]]).flat(),...settings]},
 htel:{title:'Permohonan Pendaftaran Hak Tanggungan (HTEL)',fields:[...meta,...destination,['nama','Nama debitur'],['peringkat','Peringkat hak tanggungan'],...certificate,['akta','Nomor Akta Pemberian Hak Tanggungan'],['tanggalAkta','Tanggal Akta Pemberian Hak Tanggungan','date'],...settings]},
 roya:{title:'Surat Permohonan Roya',fields:[...meta,...destination,...certificate,['lokasi','Letak tanah (blok, desa, kecamatan, kabupaten/kota)','textarea'],['peringkat','Peringkat hak tanggungan'],['ht','Nomor sertifikat hak tanggungan'],['tanggalHt','Tanggal sertifikat hak tanggungan','date'],...settings]},
 stnk:{title:'Surat Keterangan BPKB untuk Perpanjangan STNK',fields:[...meta,['bpkb','Nomor BPKB'],['nama','Nama dalam BPKB'],['alamat','Alamat dalam BPKB','textarea'],['rangka','Nomor rangka / NIK kendaraan'],['mesin','Nomor mesin'],['polisi','Nomor polisi dalam BPKB'],...settings]},
 bds:{title:'Permohonan Ganti Nama User BDS',fields:[...meta,['tujuan','Kepada / alamat tujuan','textarea'],['existingNama','Nama user existing'],['existingId','Nomor user existing'],['baruNama','Nama user baru'],['baruId','Nomor user baru'],...settings]},
 tugasAgunan:{title:'Surat Tugas Pengambilan Dokumen Legal dan Agunan',fields:[
  ['nomor','Nomor Surat Tugas'],
  ['tanggal','Tanggal Surat Tugas','date'],
  ['hari','Hari (opsional, otomatis bila kosong)','text',false],
  ['namaPemberi','Nama Pemberi Tugas (Pejabat)'],
  ['nipPemberi','NIP Pemberi Tugas'],
  ['unitPemberi','Unit Kerja Pemberi Tugas'],
  ['jabatanPemberi','Jabatan Pemberi Tugas'],
  ['namaPenerima','Nama Penerima Tugas (Petugas)'],
  ['nipPenerima','NIP Penerima Tugas'],
  ['unitPenerima','Unit Kerja Penerima Tugas'],
  ['jabatanPenerima','Jabatan Penerima Tugas'],
  ['tujuanTugas','Uraian / Keperluan Pengambilan Dokumen','textarea'],
  ['penutup','Kalimat Penutup Surat Tugas','textarea',false],
  ['bankTtd','Nama Bank pada Tanda Tangan'],
  ['unitTtd','Unit / Cabang pada Tanda Tangan'],
  ['pejabat','Nama Pejabat Penanda Tangan'],
  ['jabatan','Jabatan Pejabat Penanda Tangan']
 ]},
 angsuran:{title:'Surat Penyesuaian Angsuran',fields:[...meta,['tujuan','Kepada / unit tujuan','textarea'],['kotaTujuan','Lokasi tujuan'],['nota','Nomor nota restrukturisasi'],['tanggalNota','Tanggal nota restrukturisasi','date'],['nama','Nama debitur'],['rekening','Nomor rekening pinjaman'],['agf','Nomor rekening tabungan (AGF)'],['periode','Periode angsuran'],['pokok','Angsuran pokok (Rp)'],['bunga','Angsuran bunga (Rp)'],['tbyd','TBYD (Rp)'],['bydt','BYDT (Rp)'],['jumlah','Jumlah angsuran (Rp)'],...settings,['bankTtd2','Nama bank penanda tangan kedua'],['unitTtd2','Unit penanda tangan kedua'],['pejabat2','Nama penanda tangan kedua'],['jabatan2','Jabatan penanda tangan kedua']]}
};
const classic='Jl P. H. H. Mustofa No 39 Neglasari\nBandung\nTel. 022-7217861\nFax.022-7217863\nwww.bankmandiri.co.id';
const branch='Jl. PHH. Mustopa No. 39\nBandung 40124 Indonesia\nTelp. (62-22) 7217861\nFax. (62-22) 7217863\nwww.bankmandiri.co.id';
function defaults(type){return {
  ...(type==='sku'?{
    pemda:'PEMERINTAH KOTA BANDUNG',
    kecamatan:'KECAMATAN ANTAPANI',
    kelurahan:'KELURAHAN ANTAPANI KIDUL',
    alamatKantor:'Jl. Purwakarta No.204A, Antapani Kidul, Kec. Antapani, Kota Bandung, Jawa Barat 40291',
    nomor:'22/SKU/XI/2026',
    nama:'Lilis Subarja',
    lahir:'Bandung, 31-03-1971',
    nik:'3204087103710001',
    agama:'Islam',
    pekerjaan:'Mengurus Rumah Tangga',
    alamat:'Griya Bandung Asri 1 Jl Al Hikmah No 9',
    jenisUsaha:'Kuliner',
    namaUsaha:'Mayasi Ramen dan Bento',
    mulaiUsaha:'Tahun 2010',
    alamatUsaha:'Jl. Purwakarta No 68 Antapani Kidul',
    kota:'Bandung',
    tanggal:new Date().toISOString().split('T')[0],
    jabatan:'Lurah Antapani Kidul',
    pejabat:'Dedi Juardi, S.IP',
    nip:'1984458754120001',
    showStamp:'true',
    logoUrl:logos.bandung
  }:{}),
  ...(type==='domisili'?{
    pemda:'PEMERINTAH KOTA BANDUNG',
    kecamatan:'KECAMATAN LENGKONG',
    kelurahan:'KELURAHAN CIJAGRA',
    alamatKantor:'Jl. Cijagra I, Gang 1 Kelurahan Cijagra Kecamatan Lengkong Kota Bandung 40265',
    nomor:'474/XI/KEL/2026',
    nama:'M Khoirul Fatullah',
    lahir:'Rembang, 10 Oktober 1972',
    nik:'3271011010722987',
    kelamin:'Laki - laki',
    kewarganegaraan:'Indonesia',
    agama:'Islam',
    pekerjaan:'Wiraswasta',
    alamatKtp:'Ronggomulyo RT 007 RW 001 Ronggomulyo Kecamatan Sumber Kabupaten Rembang',
    alamatDomisili:'Jl. Cijagra III No. 2 Kelurahan Cijagra Kecamatan Lengkong Kota Bandung',
    keperluan:'Persyaratan administrasi pembukaan rekening di Bank Mandiri',
    kota:'Bandung',
    tanggal:new Date().toISOString().split('T')[0],
    jabatan:'Lurah Cijagra',
    pejabat:'Tian Gustian, S.Sos',
    nip:'197008311990121001',
    showStamp:'true',
    logoUrl:logos.bandung
  }:{}),

 bank:type==='htel'||type==='angsuran'?'PT Bank Mandiri (Persero) Tbk':'PT Bank Mandiri (Persero) Tbk.',
 cabang:type==='htel'||type==='angsuran'?'Cabang Bandung Jamsostek':'Branch Bandung Jamsostek',
 alamatKop:type==='htel'||type==='angsuran'?classic:branch,
 bankTtd:type==='htel'?'PT. Bank Mandiri (Persero) Tbk.':type==='angsuran'?'PT. Bank Mandiri (persero) Tbk':'PT Bank Mandiri (Persero) Tbk.',
 unitTtd:type==='angsuran'?'MBU Bandung Jamsostek 1':'Branch Bandung Jamsostek',
 nama:'Branch Bandung Jamsostek',
   pejabat:'Deki Elanda Pradikta',jabatan:type==='roya'?'Penyelia Unit':'Mikro Banking Manager',
 lampiran:type==='roya'?'2 (Dua) sertifikat':type==='angsuran'?'1 (satu) set':'-',
 ...(type==='htel'?{tujuan:'Kepala Kantor\nPertanahan Kabupaten Bandung',kotaTujuan:'Kabupaten Bandung',peringkat:'I (Pertama)',jenisSertifikat:'Hak Milik'}:{}),
 ...(type==='roya'?{tujuan:'Kepala Kantor\nBadan Pertanahan Nasional Kabupaten Bandung',kotaTujuan:'Kabupaten Bandung',peringkat:'I (Kesatu)',jenisSertifikat:'Hak Milik'}:{}),
 ...(type==='koreksiJT'?{tujuan:'PT Jaminan Kredit Indonesia (Jamkrindo)\nKantor Cabang Bandung\nJl. Soekarno Hatta No. 774\nBandung',penjamin:'PT Jaminan Kredit Indonesia (Jamkrindo)',bank:'PT Bank Mandiri (Persero) Tbk',alamatKop:'Jl P.H. Hasan Mustapa No 39\nBandung\nTel. 022-7217861\nwww.bankmandiri.co.id',jabatan:'Penyelia Unit'}:{}),
 ...(type==='sme'?{perihal:smeSubject,isiSme:"Dengan hormat,\n\nDengan ini kami menerangkan bahwa {perusahaan} benar sedang dalam proses pengajuan fasilitas kredit SME di PT Bank Mandiri (Persero) Tbk, Cabang Jamsostek.\n\nAgar pengajuan tersebut dapat diproses lebih lanjut, kami mohon {perusahaan} segera melengkapi dan menyampaikan dokumen persyaratan yang masih diperlukan kepada Bank Mandiri Cabang Jamsostek.\n\nDemikian surat keterangan ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.",bank:'PT Bank Mandiri (Persero) Tbk',alamatKop:'Jl P.H. Hasan Mustapa No 39\nBandung\nTel. 022-7217861\nwww.bankmandiri.co.id',bankTtd:'PT Bank Mandiri (Persero) Tbk',pejabat:yanuarName,jabatan:'Branch Manager'}:{}),
 ...(type==='kyc'?{tujuan:'Retail Credit Center Jakarta\nPT Bank Mandiri (Persero) Tbk',kotaTujuan:'tempat',penandaTanganKyc:'deki',bank:'PT Bank Mandiri (Persero) Tbk',alamatKop:'Jl P.H. Hasan Mustapa No 39\nBandung\nTel. 022-7217861\nwww.bankmandiri.co.id',jabatan:'Penyelia Unit'}:{}),
 ...(type==='mitra'?{bankTtd:'PT. Bank Mandiri (Persero) Tbk',unitTtd:'KCP Bandung Jamsostek',jabatan:'Penyelia Unit',lampiran:'-'}:{}),
 ...(type==='bds'?{tujuan:'PT. Bank Mandiri (Persero) Tbk\nArea Bandung Surapati\nUP: HC & GA\nJl. Surapati No. 2\nKota Bandung',cabang:'KCP Bandung Jamsostek',unitTtd:'KCP Bandung Jamsostek',existingNama:'M Arief Fadhillah',existingId:'2083739540',baruNama:'Deki Elanda Pradikta',baruId:'2088734785',lampiran:'-',tandaTanganBds:'otomatis'}:{}),
 ...(type==='tugasAgunan'?{
   nomor:'R06.Br.BJK/0516/2026',
   tanggal:'2026-10-05',
   hari:'Senin',
   namaPemberi:'Deki Elanda Pradikta',
   nipPemberi:'2088734785',
   unitPemberi:'Branch Bandung Jamsostek',
   jabatanPemberi:'Penyelia Unit',
   namaPenerima:'Adi Maulana',
   nipPenerima:'1691050057',
   unitPenerima:'Branch Bandung Jamsostek',
   jabatanPenerima:'Pramubakti',
   tujuanTugas:'Untuk melakukan pengambilan atas dokumen-dokumen debitur di Cluster yang telah diambil dari beranda ruang khasanah Credit Operation penyimpanan dokumen agunan sebagaimana terinci dalam tabel di bawah ini:',
   penutup:'Demikian Surat Tugas ini dibuat dan ditandatangani oleh yang berwenang sebagaimana mestinya dan untuk dipergunakan sebagai catatan administrasi masing-masing pihak serta digunakan sebagai alat bukti bila diperlukan dikemudian hari.',
   bankTtd:'PT Bank Mandiri (Persero) Tbk.',
   unitTtd:'Branch Bandung Jamsostek',
   pejabat:'Deki Elanda Pradikta',
   jabatan:'Penyelia Unit',
   tandaTangan:'otomatis',
   items:[
     {rekPjm:'1310101771642',nama:'MOHAMAD ZAMZAM',dokumen:'SHGB NO. 8200 AN LATIFAH; SHT NO. 05484/2022; SKMHT NO. 5/2021; APHT NO. 11/2022, PENGECEKAN SETIPIKAT',tglOrder:'30/09/2026'},
     {rekPjm:'1310102084391',nama:'HERI IMANUDIN FEVRIANSYAH',dokumen:'BPKB NP. P-04641502; BPKB NO. L-12894328, APLIKASI, PK, ASURANSI JIWA',tglOrder:'30/09/2026'}
   ]
 }:{}),
 ...(type==='angsuran'?{tujuan:'PT. Bank Mandiri (Persero), Tbk.\nLoan Appraisal Maintenance and Posting Department',kotaTujuan:'Tempat',bankTtd2:'PT. Bank Mandiri (persero) Tbk',unitTtd2:'MBC Bandung Surapati',pejabat2:'Atika Fadillah',jabatan2:'Micro Banking Cluster Manager'}:{})
};}
const css=`
.mf-mitra{position:relative;padding:6mm 5mm;font:11pt/1.15 Arial;color:#111;min-height:297mm;isolation:isolate}.mf-mitra p{margin:0 0 4mm}.mf-mitra-heading{display:flex;justify-content:space-between;align-items:start;margin-bottom:5mm;font-size:10.5pt}.mf-mitra-heading img{width:37mm;height:auto}.mf-mitra-title{border-bottom:4px double #333;padding-bottom:1mm;margin-right:5mm;margin-bottom:2mm}.mf-mitra-meta{border-collapse:collapse;margin-bottom:8mm}.mf-mitra-meta td{padding:0 2mm}.mf-mitra-meta td:first-child{width:24mm}.mf-mitra-table{border-collapse:collapse;table-layout:fixed;width:100%;margin-top:2mm}.mf-mitra-table td,.mf-mitra-table th{border:1px solid #111;padding:2mm;text-align:left;overflow-wrap:anywhere;vertical-align:middle}.mf-mitra-table th i{font-size:9pt;font-weight:normal}.mf-mitra-table .center{text-align:center}.mf-mitra-closing{margin-top:8mm!important;text-align:justify}.mf-mitra .mf-property-ttd{margin-left:2mm;margin-top:3mm;break-inside:avoid}

.mf-property{padding:20mm 24mm;font:10pt/1.35 Arial,sans-serif;min-height:296mm;overflow-wrap:anywhere}.mf-property p{margin:0 0 14px;text-align:justify}.mf-property-head{display:grid;grid-template-columns:minmax(0,1fr) 58mm;gap:8mm;min-height:49mm;margin-bottom:1mm}.mf-property-meta{padding-top:12mm;min-width:0}.mf-property-meta table{width:100%;border-collapse:collapse}.mf-property-meta td{padding:0;vertical-align:top}.mf-property-meta td:first-child{width:19mm}.mf-property-meta td:nth-child(2){width:4mm}.mf-property-brand{font:8pt/1.2 Arial;color:#17365d}.mf-property-brand img{display:block;width:58mm;height:auto;margin-bottom:3px}.mf-property-to{margin:0 0 17px;line-height:1.35}.mf-property-subject{display:grid;grid-template-columns:17mm 4mm minmax(0,1fr);gap:0;margin-bottom:18px;break-inside:avoid}.mf-property-subject>div:last-child{text-align:justify}.mf-property-list{padding-left:21px;margin:0 0 18px}.mf-property-koreksiJT .mf-property-to{margin:3mm 0 4mm}.mf-property-koreksiJT .mf-property-head{min-height:0}.mf-property-koreksiJT table{font:inherit}.mf-property-koreksiJT .mf-property-data td:first-child{width:59mm}.mf-property-kyc .mf-property-to{margin:3mm 0 0}.mf-property-kyc .mf-property-list{list-style:decimal outside}.mf-property-list li{padding-left:4px;text-align:justify;margin-bottom:10px}.mf-property-ttd{margin-top:24px;break-inside:avoid;page-break-inside:avoid}.mf-property-ttd .mf-property-ink{height:23mm;display:flex;align-items:center}.mf-property-ink img{width:43mm;height:22mm;object-fit:contain;object-position:left center}.mf-property-title{font:bold 11pt Arial!important;text-decoration:underline;text-align:center!important;margin:0 0 24px!important}.mf-property-data{width:100%;border-collapse:collapse;margin:16px 0 23px}.mf-property-data td{vertical-align:top;padding:3px 0}.mf-property-data td:first-child{width:47mm}.mf-property-data td:nth-child(2){width:4mm}.mf-property-stnk{font-size:11pt}.mf-property-bds .mf-property-head{min-height:0}.mf-property-bds .mf-property-brand{position:relative;transform:translate(10mm,-7mm)}.mf-property-bds .mf-property-to{position:relative;margin-top:-8mm}.mf-property-angsuran{font-size:11pt;padding:15mm 19mm}.mf-property-angsuran .mf-property-head{min-height:51mm}.mf-property-amounts{width:100%;table-layout:fixed;border-collapse:collapse;margin:18px 0 22px;font:10pt/1.3 Arial}.mf-property-amounts th,.mf-property-amounts td{border:1px solid #111;padding:7px 4px;overflow-wrap:anywhere;text-align:center}.mf-property-amounts th{font-weight:bold}.mf-property-amounts td{height:12mm}.mf-property-sign-pair{display:grid;grid-template-columns:1fr 1fr;gap:8mm;break-inside:avoid}.mf-property-sign-pair>div{min-width:0}.mf-property-sign-pair .mf-property-ttd{margin-top:0}.mf-property-form-settings{margin-top:18px;border-top:1px solid #ccd8e8;padding-top:12px}.mf-property-form-settings summary{font-weight:bold;cursor:pointer}.mf-property-help{font:12px/1.5 Arial;color:#64748b}

.mf-st-page{width:210mm!important;max-width:210mm!important;min-height:275mm!important;max-height:297mm!important;padding:13mm 18mm 12mm!important;font:10pt/1.35 Arial,sans-serif!important;color:#000!important;box-sizing:border-box!important;overflow:hidden!important;background:#fff!important;page-break-after:avoid!important;break-after:avoid!important;page-break-inside:avoid!important;break-inside:avoid!important}
.mf-st-top-logo{display:flex!important;justify-content:flex-end!important;margin-bottom:4mm!important}
.mf-st-top-logo img{width:42mm!important;height:auto!important;max-height:18mm!important;object-fit:contain!important}
.mf-st-title-block{text-align:center!important;margin-bottom:4mm!important}
.mf-st-title{font-size:11pt!important;font-weight:bold!important;text-decoration:underline!important;margin:0 0 2px!important;letter-spacing:0.5px!important;text-align:center!important;text-transform:uppercase!important}
.mf-st-nomor{font-size:10pt!important;font-weight:normal!important;margin:0!important;text-align:center!important}
.mf-st-lead{text-align:justify!important;margin:0 0 2mm!important;font-size:10pt!important;line-height:1.35!important}
.mf-st-party-table{width:100%!important;border-collapse:collapse!important;margin-bottom:2.5mm!important;font-size:10pt!important}
.mf-st-party-table td{vertical-align:top!important;padding:1px 0!important}
.mf-st-label{width:25mm!important}
.mf-st-colon{width:4mm!important;text-align:center!important}
.mf-st-val{text-align:left!important}
.mf-st-table{width:100%!important;border-collapse:collapse!important;margin:2.5mm 0 3.5mm!important;font-size:9pt!important;table-layout:fixed!important}
.mf-st-table th{background-color:#1e4b88!important;color:#ffffff!important;border:1px solid #000000!important;padding:5px 4px!important;text-align:center!important;font-weight:bold!important;vertical-align:middle!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
.mf-st-table td{border:1px solid #000000!important;padding:5px 6px!important;vertical-align:middle!important;line-height:1.3!important}
.mf-st-td-center{text-align:center!important}
.mf-st-td-upper{text-transform:uppercase!important}
.mf-st-td-doc{text-align:left!important;font-size:8.5pt!important;line-height:1.25!important}
.mf-st-closing{text-align:justify!important;margin:3.5mm 0 4mm!important;font-size:10pt!important;line-height:1.35!important}
.mf-st-sign-area{margin-top:4mm!important;break-inside:avoid!important;page-break-inside:avoid!important}
.mf-st-sign-box{width:85mm!important;text-align:left!important}
.mf-st-bank,.mf-st-unit{font-size:10pt!important;line-height:1.3!important}
.mf-st-ink{height:22mm!important;display:flex!important;align-items:center!important;margin:2px 0!important}
.mf-st-ink img{max-height:22mm!important;width:auto!important;object-fit:contain!important}
.mf-st-pejabat{font-size:10.5pt!important;line-height:1.3!important}
.mf-st-jabatan{font-size:10pt!important;line-height:1.3!important}

.mf-gov-page{padding:18mm 22mm 15mm;font:10.5pt/1.35 Arial,sans-serif;color:#000;overflow-wrap:anywhere}
.mf-gov-kop{display:flex;align-items:center;justify-content:center;position:relative;min-height:24mm;margin-bottom:2px}
.mf-gov-logo{position:absolute;left:0;top:50%;transform:translateY(-50%);width:22mm;text-align:center}
.mf-gov-logo img{max-width:20mm;max-height:26mm;object-fit:contain;display:block;margin:0 auto}
.mf-gov-kop-text{width:100%;text-align:center;padding:0 23mm}
.mf-gov-kop-pemda{font-size:13pt;font-weight:bold;letter-spacing:0.5px;text-transform:uppercase;line-height:1.2}
.mf-gov-kop-kecamatan{font-size:13pt;font-weight:bold;letter-spacing:0.5px;text-transform:uppercase;line-height:1.2;margin-top:1px}
.mf-gov-kop-kelurahan{font-size:14pt;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;line-height:1.25;margin-top:1px}
.mf-gov-kop-alamat{font-size:8pt;line-height:1.25;margin-top:3px;color:#222}
.mf-gov-divider{border-top:3px solid #000;border-bottom:1px solid #000;height:2px;margin:2mm 0 4mm}
.mf-gov-title-block{text-align:center;margin:3mm 0 4mm}
.mf-gov-title{font-size:12.5pt;font-weight:bold;text-decoration:underline;margin:0 0 2px;letter-spacing:0.5px;text-transform:uppercase}
.mf-gov-nomor{font-size:10pt;font-weight:normal;margin:0}
.mf-gov-lead{text-align:justify;margin:3mm 0 2.5mm;font-size:10.5pt;line-height:1.35}
.mf-gov-table{width:100%;border-collapse:collapse;margin:2mm 0 3mm;font-size:10.5pt;line-height:1.35}
.mf-gov-table td{vertical-align:top;padding:2px 0}
.mf-gov-col-label{width:44mm}
.mf-gov-col-colon{width:4mm;text-align:center}
.mf-gov-col-val{text-align:justify}
.mf-gov-paragraph{text-align:justify;margin:3mm 0 2.5mm;font-size:10.5pt;line-height:1.35}
.mf-gov-closing{text-align:justify;margin:3.5mm 0 4mm;font-size:10.5pt;line-height:1.35}
.mf-gov-sign-area{display:flex;justify-content:flex-end;margin-top:4mm;break-inside:avoid}
.mf-gov-sign-box{width:85mm;text-align:center;position:relative}
.mf-gov-sign-date{font-size:10.5pt;margin-bottom:2px}
.mf-gov-sign-role{font-size:10.5pt;font-weight:normal;margin-bottom:3px}
.mf-gov-sign-space{height:22mm;position:relative;display:flex;align-items:center;justify-content:center}
.mf-gov-sign-name{font-size:11pt}
.mf-gov-sign-nip{font-size:10pt;margin-top:2px}
.mf-gov-stamp-overlay{position:absolute;left:-14mm;top:-7mm;width:44mm;height:44mm;pointer-events:none;opacity:0.88;transform:rotate(-7deg);z-index:2}
.mf-gov-stamp-svg{width:44mm;height:44mm;display:block}
`;

function generateStampSvg(pemda,kelurahan,kecamatan,id){
  const clean=s=>String(s||'').trim().toUpperCase();
  const top=clean(pemda)||'PEMERINTAH KOTA BANDUNG';
  const center=clean(kelurahan)||'KELURAHAN ANTAPANI KIDUL';
  let bottom=clean(kecamatan)||'KECAMATAN ANTAPANI';
  if(!bottom.startsWith('★')){
    if(!bottom.includes('KECAMATAN')&&!bottom.includes('KEC.')){
      bottom='KECAMATAN '+bottom;
    }
    bottom='★ '+bottom+' ★';
  }
  const topSize=top.length>28?8:top.length>22?9.2:10.5;
  const bottomSize=bottom.length>26?8:bottom.length>20?8.8:9.5;
  const centerSize=center.length>24?7.5:center.length>18?9:10.5;
  const stampId=id||('stamp_'+Math.random().toString(36).substring(2,8));

  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="165" height="165" class="mf-gov-stamp-svg">'+
    '<defs>'+
      '<path id="top_'+stampId+'" d="M 24,100 A 76,76 0 0,1 176,100" fill="none"/>'+
      '<path id="bot_'+stampId+'" d="M 176,100 A 76,76 0 0,1 24,100" fill="none"/>'+
    '</defs>'+
    '<circle cx="100" cy="100" r="95" fill="none" stroke="#483ba6" stroke-width="2.5"/>'+
    '<circle cx="100" cy="100" r="88" fill="none" stroke="#483ba6" stroke-width="1.2"/>'+
    '<circle cx="100" cy="100" r="56" fill="none" stroke="#483ba6" stroke-width="1.2"/>'+
    '<line x1="44" y1="83" x2="156" y2="83" stroke="#483ba6" stroke-width="1.2"/>'+
    '<line x1="44" y1="117" x2="156" y2="117" stroke="#483ba6" stroke-width="1.2"/>'+
    '<text fill="#483ba6" font-family="Arial, sans-serif" font-size="'+topSize+'" font-weight="bold" letter-spacing="0.8">'+
      '<textPath href="#top_'+stampId+'" startOffset="50%" text-anchor="middle">'+top+'</textPath>'+
    '</text>'+
    '<text fill="#483ba6" font-family="Arial, sans-serif" font-size="'+bottomSize+'" font-weight="bold" letter-spacing="0.5">'+
      '<textPath href="#bot_'+stampId+'" startOffset="50%" text-anchor="middle">'+bottom+'</textPath>'+
    '</text>'+
    '<text x="100" y="103" fill="#483ba6" font-family="Arial, sans-serif" font-size="' + centerSize + '" font-weight="bold" text-anchor="middle" dominant-baseline="central">'+center+'</text>'+
  '</svg>';
}

function render(type,values){
 const v=k=>esc(values[k]||'................').replace(/\n/g,'<br>');
 const dt=k=>values[k]?esc(new Date(values[k]+'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})):'................';

 if(type==='sku'){
   const logo=values.logoUrl;
   const stamp=values.showStamp!=='false'&&values.showStamp!==false?
     '<div class="mf-gov-stamp-overlay">'+generateStampSvg(values.stampPemda||values.pemda,values.stampKelurahan||values.kelurahan,values.stampKecamatan||values.kecamatan,'sku')+'</div>':'';
   const kelNama=(values.kelurahan||'').replace(/^KELURAHAN\s+/i,'').replace(/^DESA\s+/i,'');
   const kecNama=(values.kecamatan||'').replace(/^KECAMATAN\s+/i,'');
   return '<div class="mf-document"><article class="mf-page mf-gov-page mf-gov-sku">'+
     '<div class="mf-gov-kop">'+
       (logo?'<div class="mf-gov-logo"><img src="'+esc(logo)+'" alt="Logo Instansi"></div>':'')+
       '<div class="mf-gov-kop-text">'+
         '<div class="mf-gov-kop-pemda">'+v('pemda')+'</div>'+
         '<div class="mf-gov-kop-kecamatan">'+v('kecamatan')+'</div>'+
         '<div class="mf-gov-kop-kelurahan">'+v('kelurahan')+'</div>'+
         '<div class="mf-gov-kop-alamat">'+v('alamatKantor')+'</div>'+
       '</div>'+
     '</div>'+
     '<div class="mf-gov-divider"></div>'+
     '<div class="mf-gov-title-block">'+
       '<h1 class="mf-gov-title">SURAT KETERANGAN USAHA</h1>'+
       '<div class="mf-gov-nomor">Nomor : '+v('nomor')+'</div>'+
     '</div>'+
     '<p class="mf-gov-lead">Kepala Kelurahan '+esc(kelNama||'...............')+' Kecamatan '+esc(kecNama||'...............')+' '+v('kota')+', dengan ini menerangkan bahwa :</p>'+
     '<table class="mf-gov-table"><tbody>'+
       '<tr><td class="mf-gov-col-label">Nama</td><td class="mf-gov-col-colon">:</td><td class="mf-gov-col-val"><b>'+v('nama')+'</b></td></tr>'+
       '<tr><td class="mf-gov-col-label">Tempat/Tanggal Lahir</td><td class="mf-gov-col-colon">:</td><td class="mf-gov-col-val">'+v('lahir')+'</td></tr>'+
       '<tr><td class="mf-gov-col-label">No. KTP / NIK</td><td class="mf-gov-col-colon">:</td><td class="mf-gov-col-val">'+v('nik')+'</td></tr>'+
       '<tr><td class="mf-gov-col-label">Agama</td><td class="mf-gov-col-colon">:</td><td class="mf-gov-col-val">'+v('agama')+'</td></tr>'+
       '<tr><td class="mf-gov-col-label">Pekerjaan</td><td class="mf-gov-col-colon">:</td><td class="mf-gov-col-val">'+v('pekerjaan')+'</td></tr>'+
       '<tr><td class="mf-gov-col-label">Alamat</td><td class="mf-gov-col-colon">:</td><td class="mf-gov-col-val">'+v('alamat')+'</td></tr>'+
     '</tbody></table>'+
     '<p class="mf-gov-paragraph">Yang bersangkutan adalah benar warga kami dan memiliki usaha sebagai berikut :</p>'+
     '<table class="mf-gov-table"><tbody>'+
       '<tr><td class="mf-gov-col-label">Jenis Usaha</td><td class="mf-gov-col-colon">:</td><td class="mf-gov-col-val">'+v('jenisUsaha')+'</td></tr>'+
       '<tr><td class="mf-gov-col-label">Nama / Merk Usaha</td><td class="mf-gov-col-colon">:</td><td class="mf-gov-col-val"><b>'+v('namaUsaha')+'</b></td></tr>'+
       '<tr><td class="mf-gov-col-label">Mulai Usaha</td><td class="mf-gov-col-colon">:</td><td class="mf-gov-col-val">'+v('mulaiUsaha')+'</td></tr>'+
       '<tr><td class="mf-gov-col-label">Alamat Usaha</td><td class="mf-gov-col-colon">:</td><td class="mf-gov-col-val">'+v('alamatUsaha')+'</td></tr>'+
     '</tbody></table>'+
     '<p class="mf-gov-closing">Demikian surat keterangan ini kami buat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.</p>'+
     '<div class="mf-gov-sign-area"><div class="mf-gov-sign-box">'+
       '<div class="mf-gov-sign-date">'+v('kota')+', '+dt('tanggal')+'</div>'+
       '<div class="mf-gov-sign-role">'+v('jabatan')+'</div>'+
       '<div class="mf-gov-sign-space">'+stamp+'</div>'+
       '<div class="mf-gov-sign-name"><u><b>'+v('pejabat')+'</b></u></div>'+
       '<div class="mf-gov-sign-nip">NIP. '+v('nip')+'</div>'+
     '</div></div>'+
   '</article></div>';
 }

 if(type==='domisili'){
   const logo=values.logoUrl;
   const stamp=values.showStamp!=='false'&&values.showStamp!==false?
     '<div class="mf-gov-stamp-overlay">'+generateStampSvg(values.stampPemda||values.pemda,values.stampKelurahan||values.kelurahan,values.stampKecamatan||values.kecamatan,'dom')+'</div>':'';
   return '<div class="mf-document"><article class="mf-page mf-gov-page mf-gov-domisili">'+
     '<div class="mf-gov-kop">'+
       (logo?'<div class="mf-gov-logo"><img src="'+esc(logo)+'" alt="Logo Instansi"></div>':'')+
       '<div class="mf-gov-kop-text">'+
         '<div class="mf-gov-kop-pemda">'+v('pemda')+'</div>'+
         '<div class="mf-gov-kop-kecamatan">'+v('kecamatan')+'</div>'+
         '<div class="mf-gov-kop-kelurahan">'+v('kelurahan')+'</div>'+
         '<div class="mf-gov-kop-alamat">'+v('alamatKantor')+'</div>'+
       '</div>'+
     '</div>'+
     '<div class="mf-gov-divider"></div>'+
     '<div class="mf-gov-title-block">'+
       '<h1 class="mf-gov-title">SURAT KETERANGAN DOMISILI</h1>'+
       '<div class="mf-gov-nomor">Nomor : '+v('nomor')+'</div>'+
     '</div>'+
     '<p class="mf-gov-lead">Yang bertanda tangan di bawah ini '+v('jabatan')+' menerangkan bahwa :</p>'+
     '<table class="mf-gov-table"><tbody>'+
       '<tr><td class="mf-gov-col-label">Nama</td><td class="mf-gov-col-colon">:</td><td class="mf-gov-col-val"><b>'+v('nama')+'</b></td></tr>'+
       '<tr><td class="mf-gov-col-label">Tempat/Tanggal Lahir</td><td class="mf-gov-col-colon">:</td><td class="mf-gov-col-val">'+v('lahir')+'</td></tr>'+
       '<tr><td class="mf-gov-col-label">NIK / No. KTP</td><td class="mf-gov-col-colon">:</td><td class="mf-gov-col-val">'+v('nik')+'</td></tr>'+
       '<tr><td class="mf-gov-col-label">Jenis Kelamin</td><td class="mf-gov-col-colon">:</td><td class="mf-gov-col-val">'+v('kelamin')+'</td></tr>'+
       '<tr><td class="mf-gov-col-label">Kewarganegaraan</td><td class="mf-gov-col-colon">:</td><td class="mf-gov-col-val">'+v('kewarganegaraan')+'</td></tr>'+
       '<tr><td class="mf-gov-col-label">Agama</td><td class="mf-gov-col-colon">:</td><td class="mf-gov-col-val">'+v('agama')+'</td></tr>'+
       '<tr><td class="mf-gov-col-label">Pekerjaan</td><td class="mf-gov-col-colon">:</td><td class="mf-gov-col-val">'+v('pekerjaan')+'</td></tr>'+
       '<tr><td class="mf-gov-col-label">Alamat Asal (KTP)</td><td class="mf-gov-col-colon">:</td><td class="mf-gov-col-val">'+v('alamatKtp')+'</td></tr>'+
     '</tbody></table>'+
     '<p class="mf-gov-paragraph">Bahwa yang bersangkutan adalah <b>BENAR</b> berdomisili di wilayah kami, tepatnya di <b>'+v('alamatDomisili')+'</b>. Surat keterangan domisili ini dibuat untuk keperluan: <b>'+v('keperluan')+'</b>.</p>'+
     '<p class="mf-gov-paragraph">Surat keterangan domisili ini berlaku selama yang bersangkutan bertempat tinggal di wilayah kami. Apabila yang bersangkutan pindah alamat agar melapor kepada pengurus RT/RW.</p>'+
     '<p class="mf-gov-closing">Demikian surat keterangan domisili ini kami buat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.</p>'+
     '<div class="mf-gov-sign-area"><div class="mf-gov-sign-box">'+
       '<div class="mf-gov-sign-date">'+v('kota')+', '+dt('tanggal')+'</div>'+
       '<div class="mf-gov-sign-role">'+v('jabatan')+'</div>'+
       '<div class="mf-gov-sign-space">'+stamp+'</div>'+
       '<div class="mf-gov-sign-name"><u><b>'+v('pejabat')+'</b></u></div>'+
       '<div class="mf-gov-sign-nip">NIP. '+v('nip')+'</div>'+
     '</div></div>'+
   '</article></div>';
 }

 const letterMeta='<table><tbody><tr><td>Nomor</td><td>:</td><td>'+v('nomor')+'</td></tr><tr><td>Tanggal</td><td>:</td><td>'+dt('tanggal')+'</td></tr><tr><td>Lampiran</td><td>:</td><td>'+v('lampiran')+'</td></tr></tbody></table>';
 const info=rows=>'<table class="mf-property-data"><tbody>'+rows.map(([label,value])=>'<tr><td>'+esc(label)+'</td><td>:</td><td>'+value+'</td></tr>').join('')+'</tbody></table>';
 const sign=(second=false)=>{const s=second?'2':'';const image=type==='sme'?(values.pejabat===yanuarName&&values.jabatan==='Branch Manager'&&values.smeYanuarSignature):type==='kyc'&&values.penandaTanganKyc==='yanuar'&&values.pejabat==='Yanuar Ishak Salahudin'?values.kycYanuarSignature:!second&&(type!=='kyc'||values.penandaTanganKyc==='deki')&&values.pejabat==='Deki Elanda Pradikta'&&(type!=='bds'||values.tandaTanganBds!=='manual')&&window.ADVIS_SIGNATURE_BASE64;return '<div class="mf-property-ttd"><div>'+v('bankTtd'+s)+'<br>'+v('unitTtd'+s)+'</div><div class="mf-property-ink">'+(image?'<img alt="Tanda tangan sesuai template" src="'+esc(image)+'">':'')+'</div><u><b>'+v('pejabat'+s)+'</b></u><br>'+v('jabatan'+s)+'</div>';};
 if(type==='mitra'){
  return '<div class="mf-document"><article class="mf-page mf-mitra"><div class="mf-mitra-heading"><b>PETUNJUK TEKNIS OPERASIONAL<br>KREDIT SERBAGUNA MANDIRI (KSM)<br>LAMPIRAN 2 – FORMAT DOKUMEN RELATIONSHIP</b><img src="'+logos.branch+'" alt="Bank Mandiri"></div><div class="mf-mitra-title"><b>LAMPIRAN 2.2　: Format Surat Perubahan Data Mitra ID</b></div><table class="mf-mitra-meta">'+[['Nomor',v('nomor')],['Tanggal',dt('tanggal')],['Lampiran',v('lampiran')]].map(([k,t])=>'<tr><td>'+k+'</td><td>:</td><td>'+t+'</td></tr>').join('')+'</table><p>Kepada Yth,<br><b>PT Bank Mandiri (Persero) Tbk</b><br>Consumer Credit Risk &amp; Analytics Group<br>Di tempat</p><p>Perihal　 : <b><u>Permohonan Perubahan Data Mitra ID</u></b></p><p>Berikut kami sampaikan permohonan perubahan data Mitra ID sebagai berikut :</p><table class="mf-mitra-table"><colgroup><col style="width:35%"><col style="width:3%"><col style="width:31%"><col style="width:31%"></colgroup><tbody>'+[['Mitra ID','mitraId'],['Nama Mitra','namaMitra'],['Unit Pengelola Mitra ID','unitMitra']].map(([k,t])=>'<tr><th>'+k+'</th><td>:</td><td colspan="2">'+v(t)+'</td></tr>').join('')+'<tr><th>Perubahan Data Mitra ID<br><i>(Contoh: Perubahan Nama Instansi/PIC Konfirmasi Perusahaan, dll)</i></th><td></td><th class="center">Sebelum</th><th class="center">Menjadi</th></tr>'+Array.from({length:3},(_,i)=>'<tr><td>'+v('data'+i)+'</td><td>:</td><td>'+v('sebelum'+i)+'</td><td>'+v('menjadi'+i)+'</td></tr>').join('')+'</tbody></table><p class="mf-mitra-closing">Demikian disampaikan, mohon bantuannya untuk dapat melakukan penyesuaian/<i>setting</i> pada sistem LOS.</p><p>Hormat kami,</p>'+sign()+'</article></div>';
 }
 const logo=type==='htel'||type==='angsuran'?logos.classic:logos.branch;
 let content='';
 const cert=()=> 'Sertifikat '+v('jenisSertifikat')+' No. '+v('sertifikat')+' An '+v('pemilik');
 const to=type==='bds'?'<div class="mf-property-to">Kepada<br><b>'+v('tujuan')+'</b></div>':type==='stnk'?'':'<div class="mf-property-to">Kepada'+(type==='roya'?',':' :')+'<br><b>'+v('tujuan')+'</b><br>Di<br><b>'+v('kotaTujuan')+'</b></div>';
 const subject=text=>'<div class="mf-property-subject"><div>Perihal</div><div>:</div><div>'+text+'</div></div>';
 if(type==='htel')content=subject('Permohonan Pendaftaran Hak Tanggungan '+v('peringkat')+' Debitur An. '+v('nama')+'.')+'<p>Menunjuk perihal diatas, dengan ini kami lampirkan berkas pengurusan pendaftaran Hak Tanggungan Peringkat '+v('peringkat')+' guna kepentingan “PT. Bank Mandiri (Persero) Tbk.” dengan data sebagai berikut :</p><ol class="mf-property-list"><li>Asli Sertipikat '+v('jenisSertifikat')+' No. '+v('sertifikat')+', an. '+v('pemilik')+'.</li><li>Akta Pemberian Hak Tanggungan Nomor: '+v('akta')+' Tanggal '+dt('tanggalAkta')+'.</li><li>Surat Pengantar PPAT</li><li>Data-data para pihak</li></ol><p>Demikian kami sampaikan, atas perhatiannya kami ucapkan terima kasih.</p>'+sign();
 if(type==='roya'){const property=cert()+' yang terletak di '+v('lokasi');const ht='Hak Tanggungan Peringkat '+v('peringkat')+' No. '+v('ht')+' tanggal '+dt('tanggalHt');content=subject('Peroyaan Hak Tanggungan '+property+'.')+'<p>Dengan ini kami mohon bantuan Saudara untuk melaksanakan peroyaan '+ht+' yang mengikat '+property+'. Sertifikat tersebut sudah tidak menjadi agunan pada Bank kami.</p><p>Terlampir kami sampaikan asli dokumen sebagai berikut :</p><ol class="mf-property-list"><li>Asli '+property+'.</li><li>Asli Sertifikat '+ht+'.</li></ol><p>Demikian kami sampaikan. Atas perhatian dan kerjasamanya, kami ucapkan terima kasih.</p>'+sign();}
 if(type==='stnk')content='<h1 class="mf-property-title">SURAT KETERANGAN</h1>'+subject('BPKB yang Dijaminkan')+'<p>Menunjuk perihal tersebut diatas, menerangkan bahwa :</p>'+info([['No. BPKB',v('bpkb')],['Nama dalam BPKB',v('nama')],['Alamat',v('alamat')],['No Rangka/NIK',v('rangka')],['No Mesin',v('mesin')],['No.Pol dalam BPKB',v('polisi')]])+'<p>Merupakan jaminan di PT Bank Mandiri (Persero) Tbk.</p><p>Surat Keterangan ini dikeluarkan atas permintaan yang bersangkutan.</p><p>Demikian kami sampaikan agar dapat dipergunakan sesuai kebutuhan.</p>'+sign();
 if(type==='sme'){
  const advisLogo=window.ADVIS_MANDIRI_LOGO_BASE64||logo;
  const paragraphs=String(values.isiSme||'').replaceAll('{perusahaan}',()=>values.nama||'................').trim().split(/\n\s*\n/).map(text=>'<p>'+esc(text).replace(/\n/g,'<br>')+'</p>').join('');
  return '<div class="mf-document"><article class="mf-page mf-property mf-property-koreksiJT">'+
   '<div class="mf-property-head"><div class="mf-property-meta">'+letterMeta+'<div class="mf-property-to">Kepada Yth.<br><b>'+(values.tujuan?v('tujuan'):'Direksi '+v('nama'))+'</b></div></div>'+
   '<div class="mf-property-brand"><img src="'+esc(advisLogo)+'" alt="Bank Mandiri"><b>'+v('bank')+'</b><br>'+v('cabang')+'<br>'+v('alamatKop')+'</div></div>'+
   subject('<b><u>'+v('perihal')+'</u></b>')+paragraphs+'<p>Hormat kami,</p>'+sign()+'</article></div>';
 }
 if(type==='koreksiJT'){
  const subjectText=values.perihalKoreksiMode==='manual'?v('perihal'):esc(koreksiSubject);
  const debtor=info([
   ['Nama debitur',v('nama')],['No. Aplikasi LOS',v('los')],['Limit','Rp '+v('limit')],
   ['Tanggal jatuh tempo di polis',dt('jatuhTempoPolis')],['Tanggal jatuh tempo sebenarnya',dt('jatuhTempoBenar')],
   ['Jangka Waktu di Polis',v('tenorPolis')],['Jangka Waktu Sebenarnya',v('tenorBenar')]
  ]);
  const advisLogo=window.ADVIS_MANDIRI_LOGO_BASE64||logo;
  return '<div class="mf-document"><article class="mf-page mf-property mf-property-koreksiJT">'+
   '<div class="mf-property-head"><div class="mf-property-meta">'+letterMeta+'<div class="mf-property-to"><b>Kepada<br>'+v('tujuan')+'</b></div></div>'+
   '<div class="mf-property-brand"><img src="'+esc(advisLogo)+'" alt="Bank Mandiri"><b>'+v('bank')+'</b><br>'+v('cabang')+'<br>'+v('alamatKop')+'</div></div>'+
   subject('<b><u>'+subjectText+'</u></b>')+
   '<p>Berdasarkan lampiran e-Polis Asuransi KUR No. '+v('polis')+' dari '+v('penjamin')+', kami informasikan bahwa terdapat perubahan tanggal jatuh tempo kredit tersebut. Sehubungan dengan hal itu, kami memohon koreksi dengan rincian sebagai berikut:</p>'+debtor+
   '<p>Demikian kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.</p>'+sign()+'</article></div>';
 }
 if(type==='kyc'){
  const advisLogo=window.ADVIS_MANDIRI_LOGO_BASE64||logo;
  const identity=info([['Nama',v('nama')],['Nama Perusahaan',v('perusahaan')],['Jabatan',v('posisi')]]);
  const manualPoint=text=>esc(text||'................').replace(/\n/g,'<br>');
  const checks=values.kycPointMode==='manual'?Array.from({length:3},(_,i)=>manualPoint(values.kycManualPoints?.[i])):[
   'Kami meyakini bahwa calon debitur benar menjabat sebagai '+v('posisi')+' di '+v('perusahaan')+' sejak '+dt('mulaiPosisi')+'.',
   'Gaji calon debitur dibayarkan melalui '+v('bankGaji')+' setiap tanggal '+v('tanggalGaji')+' sebesar Rp '+v('nominalGaji')+'.',
   'Berdasarkan hasil konfirmasi, calon debitur memperoleh promosi ke jabatan '+v('posisiPromosi')+' terhitung sejak '+dt('tanggalPromosi')+'.'
  ];
  for(const point of values.kycExtraPoints||[])checks.push(manualPoint(point));
  return '<div class="mf-document"><article class="mf-page mf-property mf-property-kyc">'+
   '<div class="mf-property-head"><div class="mf-property-meta">'+letterMeta+'<div class="mf-property-to">Kepada Yth.,<br><b>'+v('tujuan')+'</b><br>Di '+v('kotaTujuan')+'</div></div>'+
   '<div class="mf-property-brand"><img src="'+esc(advisLogo)+'" alt="Bank Mandiri"><b>'+v('bank')+'</b><br>'+v('cabang')+'<br>'+v('alamatKop')+'</div></div>'+
   subject('<b>KYC (Know Your Consumer) a.n. '+v('nama')+'</b>')+
   '<p>Bersama surat ini, kami sampaikan hasil KYC calon debitur dengan data sebagai berikut.</p>'+identity+
   '<p>Berdasarkan hasil KYC Kepala Cabang dan MAL Area, kami sampaikan hasil verifikasi berikut.</p><ol class="mf-property-list">'+
   checks.map(text=>'<li>'+text+'</li>').join('')+'</ol><p>Demikian kami sampaikan untuk dapat diproses lebih lanjut.</p><p>Hormat kami,</p>'+sign()+'</article></div>';
 }
 if(type==='tugasAgunan'){
  const advisLogo=window.ADVIS_MANDIRI_LOGO_BASE64||logos.branch||'/mandiri_logo.png';
  const rawDate=values.tanggal||'2026-10-05';
  const dayNames=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const monthNames=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  let dayText=values.hari||'';
  let dateText='';
  if(rawDate&&rawDate.includes('-')){
   const dp=rawDate.split('-');
   const y=parseInt(dp[0],10);
   const m=parseInt(dp[1],10)-1;
   const d=parseInt(dp[2],10);
   const dtObj=new Date(y,m,d);
   if(!dayText)dayText=dayNames[dtObj.getDay()]||'Senin';
   dateText=String(d).padStart(2,'0')+' '+(monthNames[m]||'')+' '+y;
  }else{
   if(!dayText)dayText='Senin';
   dateText=rawDate;
  }
  const items=Array.isArray(values.items)&&values.items.length>0?values.items:[
   {rekPjm:'1310101771642',nama:'MOHAMAD ZAMZAM',dokumen:'SHGB NO. 8200 AN LATIFAH; SHT NO. 05484/2022; SKMHT NO. 5/2021; APHT NO. 11/2022, PENGECEKAN SETIPIKAT',tglOrder:'30/09/2026'},
   {rekPjm:'1310102084391',nama:'HERI IMANUDIN FEVRIANSYAH',dokumen:'BPKB NP. P-04641502; BPKB NO. L-12894328, APLIKASI, PK, ASURANSI JIWA',tglOrder:'30/09/2026'}
  ];
  const tableRows=items.map((it,idx)=>'<tr>'+
   '<td class="mf-st-td-center">'+(idx+1)+'</td>'+
   '<td class="mf-st-td-center">'+esc(it.rekPjm||'-')+'</td>'+
   '<td class="mf-st-td-upper"><b>'+esc(it.nama||'-')+'</b></td>'+
   '<td class="mf-st-td-doc">'+esc(it.dokumen||'-')+'</td>'+
   '<td class="mf-st-td-center">'+esc(it.tglOrder||'-')+'</td>'+
  '</tr>').join('');
  const showSign=values.tandaTangan!=='manual'&&values.pejabat==='Deki Elanda Pradikta'&&window.ADVIS_SIGNATURE_BASE64;
  const signInk=showSign?'<img alt="Tanda tangan Deki Elanda Pradikta" src="'+esc(window.ADVIS_SIGNATURE_BASE64)+'">':'';
  return '<div class="mf-document"><article class="mf-page mf-st-page">'+
   '<div class="mf-st-top-logo"><img src="'+esc(advisLogo)+'" alt="Bank Mandiri"></div>'+
   '<div class="mf-st-title-block">'+
    '<h1 class="mf-st-title">SURAT TUGAS PENGAMBILAN DOKUMEN LEGAL DAN AGUNAN</h1>'+
    '<div class="mf-st-nomor">No: '+v('nomor')+'</div>'+
   '</div>'+
   '<p class="mf-st-lead">Pada hari ini '+esc(dayText)+' tanggal '+esc(dateText)+' yang bertandatangan dibawah ini:</p>'+
   '<table class="mf-st-party-table"><tbody>'+
    '<tr><td class="mf-st-label">Nama</td><td class="mf-st-colon">:</td><td class="mf-st-val"><b>'+v('namaPemberi')+'</b></td></tr>'+
    '<tr><td class="mf-st-label">NIP</td><td class="mf-st-colon">:</td><td class="mf-st-val">'+v('nipPemberi')+'</td></tr>'+
    '<tr><td class="mf-st-label">Unit Kerja</td><td class="mf-st-colon">:</td><td class="mf-st-val">'+v('unitPemberi')+'</td></tr>'+
    '<tr><td class="mf-st-label">Jabatan</td><td class="mf-st-colon">:</td><td class="mf-st-val">'+v('jabatanPemberi')+'</td></tr>'+
   '</tbody></table>'+
   '<p class="mf-st-lead">Bertindak dalam jabatan tersebut di atas dengan ini menugaskan:</p>'+
   '<table class="mf-st-party-table"><tbody>'+
    '<tr><td class="mf-st-label">Nama</td><td class="mf-st-colon">:</td><td class="mf-st-val"><b>'+v('namaPenerima')+'</b></td></tr>'+
    '<tr><td class="mf-st-label">Nip</td><td class="mf-st-colon">:</td><td class="mf-st-val">'+v('nipPenerima')+'</td></tr>'+
    '<tr><td class="mf-st-label">Unit Kerja</td><td class="mf-st-colon">:</td><td class="mf-st-val">'+v('unitPenerima')+'</td></tr>'+
    '<tr><td class="mf-st-label">Jabatan</td><td class="mf-st-colon">:</td><td class="mf-st-val">'+v('jabatanPenerima')+'</td></tr>'+
   '</tbody></table>'+
   '<p class="mf-st-lead">'+v('tujuanTugas')+'</p>'+
   '<table class="mf-st-table">'+
    '<thead><tr>'+
     '<th style="width:38px;">No</th>'+
     '<th style="width:140px;">Rekening Pinjaman</th>'+
     '<th style="width:160px;">Nama</th>'+
     '<th>Dokumen</th>'+
     '<th style="width:95px;">Tgl. Order</th>'+
    '</tr></thead>'+
    '<tbody>'+tableRows+'</tbody>'+
   '</table>'+
   '<p class="mf-st-closing">'+v('penutup')+'</p>'+
   '<div class="mf-st-sign-area">'+
    '<div class="mf-st-sign-box">'+
     '<div class="mf-st-bank"><b>'+v('bankTtd')+'</b></div>'+
     '<div class="mf-st-unit"><b>'+v('unitTtd')+'</b></div>'+
     '<div class="mf-st-ink">'+signInk+'</div>'+
     '<div class="mf-st-pejabat"><u><b>'+v('pejabat')+'</b></u></div>'+
     '<div class="mf-st-jabatan">'+v('jabatan')+'</div>'+
    '</div>'+
   '</div>'+
  '</article></div>';
 }
 if(type==='bds')content=subject('<b>Permohonan ganti nama user BDS</b>')+'<p>Sehubungan dengan adanya Surat Keputusan penempatan Penyelia Unit yang baru di KCP Bandung Jamsostek, sedangkan nama pengguna pada sistem Branch Delivery System (BDS) masih menggunakan nama Penyelia Unit sebelumnya, kami memohon bantuan untuk melakukan penggantian nama user BDS dengan data sebagai berikut:</p>'+info([['User Existing',v('existingNama')+' / '+v('existingId')],['User Baru',v('baruNama')+' / '+v('baruId')]])+'<p>Demikian surat permohonan ini dibuat, atas perhatian dan kerja samanya kami ucapkan terima kasih.</p>'+sign();
 if(type==='angsuran')content=subject('<b>Permohonan Penyesuaian Angsuran Debitur</b>')+'<p>Sehubungan dengan adanya ketidaksesuaian tagihan angsuran (jumlah tagihan pokok dan bunga) Debitur kami pasca dilakukan restrukturisasi kredit Nota No. '+v('nota')+' tanggal '+dt('tanggalNota')+', maka dengan ini kami mohon bantuannya untuk melakukan penyesuaian tagihan Debitur kami dengan data sebagai berikut :</p>'+info([['Nama Debitur',v('nama')],['No Rekening Pinjaman',v('rekening')],['No Rekening Tabungan (AGF)',v('agf')]])+'<table class="mf-property-amounts"><thead><tr>'+['Periode','Angsuran Pokok (Rp.)','Angsuran Bunga (Rp.)','TBYD (Rp)','BYDT (Rp)','Jumlah Angsuran (Rp.)'].map(t=>'<th>'+t+'</th>').join('')+'</tr></thead><tbody>'+Array.from({length:Math.max(1,Number(values.angsuranRows)||1)},(_,i)=>'<tr>'+['periode','pokok','bunga','tbyd','bydt','jumlah'].map(k=>'<td>'+v(k+(i?'_'+(i+1):''))+'</td>').join('')+'</tr>').join('')+'</tbody></table><p>Demikian kami sampaikan, atas bantuan dan kerjasamanya kami ucapkan terima kasih.</p><p>Menyetujui,</p><div class="mf-property-sign-pair">'+sign()+sign(true)+'</div>';
 return '<div class="mf-document"><article class="mf-page mf-property mf-property-'+type+'"><div class="mf-property-head"><div class="mf-property-meta">'+letterMeta+'</div><div class="mf-property-brand"><img src="'+logo+'" alt="Bank Mandiri"><b>'+v('bank')+'</b><br>'+v('cabang')+'<br>'+v('alamatKop')+'</div></div>'+to+content+'</article></div>';
}
function setup(type,values={},preview=()=>{}){
  if(type==='sku'||type==='domisili'){
    const form=document.getElementById('mfFields');
    const sourcePanel=document.createElement('section');
    sourcePanel.innerHTML='<label for="govSource">Sumber data pemohon</label>'+
      '<select id="govSource"><option value="booking">Database Nasabah (Booking & Leads)</option><option value="manual">Isi manual</option></select>'+
      '<div id="govBooking"><label for="govSearch">Cari nama, NIK, CIF, atau telepon</label>'+
      '<input id="govSearch" placeholder="Ketik minimal 2 karakter..." autocomplete="off">'+
      '<div id="govResults" class="mf-help"></div></div>'+
      '<p class="mf-help">Pencarian dapat mengambil data dari Booking maupun Leads KUR/KUM. Klik nasabah untuk mengisi nama, NIK, tanggal lahir, alamat, kelurahan, dan kecamatan secara otomatis.</p>';
    form.prepend(sourcePanel);

    const put=(k,val)=>{
      values[k]=String(val??'');
      const el=document.getElementById('mf_'+k);
      if(el)el.value=values[k];
    };

    const govSearch=sourcePanel.querySelector('#govSearch');
    const govResults=sourcePanel.querySelector('#govResults');
    const govSource=sourcePanel.querySelector('#govSource');
    govSource.onchange=e=>document.getElementById('govBooking').hidden=e.target.value==='manual';

    govSearch.oninput=e=>{
      const q=e.target.value.trim().toLowerCase();
      govResults.replaceChildren();
      if(q.length<2)return;
      const bList=typeof dbBooking!=='undefined'&&Array.isArray(dbBooking)?dbBooking:[];
      const lList=typeof dataLeads!=='undefined'&&Array.isArray(dataLeads)?dataLeads:[];
      const matches=[];
      for(const r of bList){
        if([r.nama,r.cif,r.ktp,r.telp].join(' ').toLowerCase().includes(q)){
          matches.push({source:'Booking',...r});
          if(matches.length>=10)break;
        }
      }
      if(matches.length<10){
        for(const r of lList){
          if([r.nama,r.cif,r.ktp,r.noKtp,r.telp,r.noTelp,r.noHp].join(' ').toLowerCase().includes(q)){
            matches.push({source:'Leads',...r});
            if(matches.length>=12)break;
          }
        }
      }
      if(!matches.length){
        govResults.textContent='Nasabah tidak ditemukan. Silakan isi form di bawah secara manual.';
        return;
      }
      for(const r of matches){
        const btn=document.createElement('button');
        btn.type='button';
        btn.className='mf-button';
        btn.style='display:block;width:100%;text-align:left;margin-top:6px;font-size:12px;padding:7px 10px;';
        btn.textContent='['+r.source+'] '+(r.nama||'-')+' / NIK: '+(r.ktp||r.noKtp||'-')+' / '+(r.cif?'CIF '+r.cif:'');
        btn.onclick=()=>{
          put('nama',r.nama||'');
          put('nik',r.ktp||r.noKtp||'');
          const lahirParts=[r.tempatLahir,r.tglLahir].filter(Boolean).join(', ');
          if(lahirParts)put('lahir',lahirParts);
          const fullAlamat=[r.alamat,r.kelurahan,r.kecamatan,r.kota].filter(Boolean).join(', ');
          if(type==='sku'){
            if(fullAlamat)put('alamat',fullAlamat);
          } else {
            if(fullAlamat)put('alamatKtp',fullAlamat);
            if(r.alamat)put('alamatDomisili',r.alamat+(r.kelurahan?', Kel. '+r.kelurahan:'')+(r.kecamatan?', Kec. '+r.kecamatan:'')+(r.kota?', '+r.kota:''));
          }
          if(r.kelurahan){
            const kelUpper=r.kelurahan.toUpperCase();
            put('kelurahan',kelUpper.startsWith('KEL')||kelUpper.startsWith('DESA')?kelUpper:'KELURAHAN '+kelUpper);
          }
          if(r.kecamatan){
            const kecUpper=r.kecamatan.toUpperCase();
            put('kecamatan',kecUpper.startsWith('KEC')?kecUpper:'KECAMATAN '+kecUpper);
          }
          if(r.kota){
            put('kota',r.kota);
            const kotaUpper=r.kota.toUpperCase();
            put('pemda',kotaUpper.includes('KOTA')||kotaUpper.includes('KAB')?kotaUpper:'PEMERINTAH '+kotaUpper);
          }
          govResults.replaceChildren();
          preview();
        };
        govResults.append(btn);
      }
    };

    const logoPanel=document.createElement('section');
    logoPanel.style='margin-top:14px;padding:12px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;';
    logoPanel.innerHTML='<label style="margin-top:0">Logo Instansi / Kelurahan</label>'+
      '<div style="display:flex;align-items:center;gap:12px;margin:8px 0">'+
        '<div id="govLogoThumb" style="width:48px;height:48px;border:1px solid #ccc;border-radius:6px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">'+
          (values.logoUrl?'<img src="'+values.logoUrl+'" style="max-width:44px;max-height:44px;object-fit:contain">':'<span style="font-size:10px;color:#999">No logo</span>')+
        '</div>'+
        '<div style="flex:1">'+
          '<input id="govLogoFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="font-size:12px;padding:5px">'+
          '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">'+
            '<button type="button" id="govResetLogo" class="mf-button" style="font-size:11px;padding:5px 8px">Logo Kota Bandung</button>'+
            '<button type="button" id="govClearLogo" class="mf-button" style="font-size:11px;padding:5px 8px;background:#fee2e2;color:#991b1b">Hapus Logo</button>'+
          '</div>'+
        '</div>'+
      '</div>'+
      '<p class="mf-help" style="margin:4px 0 0">Pilih gambar logo Pemda / Kelurahan dari komputer. Gambar otomatis disematkan ke kop surat.</p>';
    sourcePanel.after(logoPanel);

    const logoFile=logoPanel.querySelector('#govLogoFile');
    const logoThumb=logoPanel.querySelector('#govLogoThumb');
    const updateLogoThumb=()=>{
      logoThumb.innerHTML=values.logoUrl?
        '<img src="'+values.logoUrl+'" style="max-width:44px;max-height:44px;object-fit:contain">':
        '<span style="font-size:10px;color:#999">No logo</span>';
    };
    logoFile.onchange=e=>{
      const file=e.target.files[0];
      if(!file)return;
      const reader=new FileReader();
      reader.onload=ev=>{
        values.logoUrl=ev.target.result;
        updateLogoThumb();
        preview();
      };
      reader.readAsDataURL(file);
    };
    logoPanel.querySelector('#govResetLogo').onclick=()=>{
      values.logoUrl=logos.bandung;
      logoFile.value='';
      updateLogoThumb();
      preview();
    };
    logoPanel.querySelector('#govClearLogo').onclick=()=>{
      values.logoUrl='';
      logoFile.value='';
      updateLogoThumb();
      preview();
    };

    const stampPanel=document.createElement('section');
    stampPanel.style='margin-top:14px;padding:12px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;';
    stampPanel.innerHTML='<label style="margin-top:0">Cap Stempel Resmi Kelurahan</label>'+
      '<div style="display:flex;align-items:center;gap:8px;margin:8px 0">'+
        '<input type="checkbox" id="govShowStamp" style="width:18px;height:18px;cursor:pointer" '+(values.showStamp!=='false'&&values.showStamp!==false?'checked':'')+'>'+
        '<label for="govShowStamp" style="margin:0;cursor:pointer;font-weight:normal;font-size:13px">Tampilkan cap stempel ungu pada tanda tangan</label>'+
      '</div>'+
      '<details class="mf-help" style="margin-top:8px">'+
        '<summary style="font-weight:bold;cursor:pointer;color:#12375b">Sesuaikan teks stempel (otomatis / override)</summary>'+
        '<p style="margin:6px 0">Secara default, stempel otomatis mengikuti isian Pemda, Kecamatan, dan Kelurahan. Gunakan isian berikut jika ingin teks stempel berbeda.</p>'+
        '<label for="govStampPemda" style="font-size:11px">Teks Busur Atas (Pemda)</label>'+
        '<input id="govStampPemda" placeholder="Otomatis dari Pemda">'+
        '<label for="govStampKelurahan" style="font-size:11px">Teks Tengah (Kelurahan/Desa)</label>'+
        '<input id="govStampKelurahan" placeholder="Otomatis dari Kelurahan">'+
        '<label for="govStampKecamatan" style="font-size:11px">Teks Busur Bawah (Kecamatan)</label>'+
        '<input id="govStampKecamatan" placeholder="Otomatis dari Kecamatan">'+
      '</details>';
    logoPanel.after(stampPanel);

    const showStampCheck=stampPanel.querySelector('#govShowStamp');
    showStampCheck.onchange=()=>{
      values.showStamp=showStampCheck.checked?'true':'false';
      preview();
    };

    const sPemda=stampPanel.querySelector('#govStampPemda');
    const sKel=stampPanel.querySelector('#govStampKelurahan');
    const sKec=stampPanel.querySelector('#govStampKecamatan');
    sPemda.value=values.stampPemda||'';
    sKel.value=values.stampKelurahan||'';
    sKec.value=values.stampKecamatan||'';

    sPemda.oninput=e=>{values.stampPemda=e.target.value;preview();};
    sKel.oninput=e=>{values.stampKelurahan=e.target.value;preview();};
    sKec.oninput=e=>{values.stampKecamatan=e.target.value;preview();};

    const kopFields=['pemda','kecamatan','kelurahan','alamatKantor','kota','jabatan','pejabat','nip'];
    const kopDetails=document.createElement('details');
    kopDetails.className='mf-property-form-settings';
    kopDetails.style='margin-top:18px;border-top:1px solid #cbd5e1;padding-top:10px;';
    kopDetails.innerHTML='<summary style="font-weight:bold;cursor:pointer">Pengaturan Kop Surat & Penanda Tangan Kelurahan</summary>'+
      '<p class="mf-property-help">Ubah teks kop surat instansi, alamat kantor kelurahan, kota, nama lurah/kepala desa, dan NIP.</p>';
    for(const key of kopFields){
      const input=document.getElementById('mf_'+key);
      if(input&&input.previousElementSibling){
        kopDetails.append(input.previousElementSibling,input);
      }
    }
    form.append(kopDetails);
  }

 if(type==='sme'){
  const status=document.createElement('p');
  status.className='mf-property-help';
  status.setAttribute('role','status');
  status.textContent='Memuat tanda tangan Yanuar dari portal…';
  document.getElementById('mfFields').append(status);
  delete values.smeYanuarSignature;
  loadYanuarSignature().then(image=>{
   if(!status.isConnected)return;
   values.smeYanuarSignature=image;
   status.textContent='Tanda tangan Yanuar siap digunakan.';
   preview();
  }).catch(error=>{
   if(status.isConnected)status.textContent=error.message+' Ruang tanda tangan tetap tersedia.';
  });
 }
 if(type==='koreksiJT'){
  const field=document.getElementById('mf_perihal'),label=field.previousElementSibling;
  const panel=document.createElement('section');
  panel.innerHTML='<label for="koreksiSubjectMode">Perihal</label><select id="koreksiSubjectMode"><option value="auto">Otomatis sesuai template</option><option value="manual">Isi perihal manual</option></select>';
  label.before(panel);
  const mode=panel.querySelector('select');mode.value=values.perihalKoreksiMode||'auto';
  const update=()=>{
   const manual=mode.value==='manual';
   label.hidden=field.hidden=field.disabled=!manual;
   values.perihalKoreksiMode=mode.value;
   preview();
  };
  mode.onchange=update;update();
 }

 if(type==='kyc'){
  const endpoint=yanuarSignatureEndpoint;
  const panel=document.createElement('section');
  panel.innerHTML='<label for="kycSigner">Pilihan penanda tangan</label><select id="kycSigner"><option value="deki">Deki Elanda Pradikta — Penyelia Unit</option><option value="yanuar">Yanuar Ishak Salahudin — Branch Manager</option><option value="manual">Isi manual / tanda tangan basah</option></select><div id="kycSignatureUpload" hidden><label for="kycSignatureFile">Unggah atau ganti gambar tanda tangan Yanuar</label><input id="kycSignatureFile" type="file" accept="image/jpeg,image/png"><p id="kycSignatureStatus" class="mf-property-help" role="status"></p></div>';
  document.getElementById('mfFields').prepend(panel);
  const select=panel.querySelector('select'),upload=panel.querySelector('#kycSignatureUpload');
  const fileInput=panel.querySelector('input'),status=panel.querySelector('[role=status]');
  let generation=0;
  async function loadSignature(){
   const current=++generation;
   try{
    const image=await loadYanuarSignature();
    if(current!==generation||!panel.isConnected||select.value!=='yanuar')return;
    values.kycYanuarSignature=image;status.textContent='Gambar tanda tangan Yanuar siap digunakan.';preview();
   }catch(error){if(current===generation&&panel.isConnected){delete values.kycYanuarSignature;status.textContent=error.message;preview();}}
  }
  select.value=values.penandaTanganKyc||'deki';upload.hidden=select.value!=='yanuar';
  select.onchange=()=>{
   generation++;values.penandaTanganKyc=select.value;upload.hidden=select.value!=='yanuar';
   const presets={deki:['Deki Elanda Pradikta','Penyelia Unit'],yanuar:['Yanuar Ishak Salahudin','Branch Manager'],manual:['','']};
   [values.pejabat,values.jabatan]=presets[select.value];
   for(const key of ['pejabat','jabatan'])document.getElementById('mf_'+key).value=values[key];
   preview();if(select.value==='yanuar')void loadSignature();
  };
  fileInput.onchange=async()=>{
   const file=fileInput.files[0];if(!file)return;
   fileInput.disabled=true;status.textContent='Menyimpan gambar tanda tangan...';
   try{
    const response=await fetch(endpoint,{method:'PUT',headers:{'Content-Type':file.type},body:file});
    if(!response.ok){const error=await response.json();throw Error(error.message||'Tanda tangan belum dapat disimpan.');}
    await loadSignature();
   }catch(error){status.textContent=error.message;}
   finally{fileInput.value='';fileInput.disabled=false;}
  };
  if(select.value==='yanuar')void loadSignature();
  const modePanel=document.createElement('section');
  modePanel.innerHTML='<label for="kycPointMode">Cara mengisi poin 1–3</label><select id="kycPointMode"><option value="standard">Format standar KYC</option><option value="manual">Tulis poin 1–3 secara manual</option></select>';
  const standardFields=['mulaiPosisi','bankGaji','tanggalGaji','nominalGaji','posisiPromosi','tanggalPromosi'].map(key=>document.getElementById('mf_'+key));
  standardFields[0].previousElementSibling.before(modePanel);
  const mode=modePanel.querySelector('select');mode.value=values.kycPointMode||'standard';
  const pointPanel=document.createElement('section');
  pointPanel.innerHTML='<div></div><button type="button" class="mf-button">Tambah poin manual</button>';
  standardFields.at(-1).after(pointPanel);
  const pointList=pointPanel.querySelector('div'),addPoint=pointPanel.querySelector('button');
  const extraPoints=values.kycExtraPoints||(values.kycExtraPoints=[]);
  const manualPoints=values.kycManualPoints||(values.kycManualPoints=['','','']);
  function drawPoints(){
   const manual=mode.value==='manual';
   for(const field of standardFields){field.previousElementSibling.hidden=manual;field.hidden=manual;field.disabled=manual;}
   pointList.replaceChildren();
   if(manual)manualPoints.forEach((text,index)=>addPointField(manualPoints,index,1));
   extraPoints.forEach((text,index)=>addPointField(extraPoints,index,4));
  }
  function addPointField(points,index,firstNumber){
   const number=index+firstNumber,label=document.createElement('label'),field=document.createElement('textarea');
   label.htmlFor=field.id='kycPoint'+number;label.textContent='Poin '+number+' *';
   field.value=points[index];field.required=true;
   field.oninput=()=>{points[index]=field.value;preview();};
   pointList.append(label,field);
   if(firstNumber===4){
    const remove=document.createElement('button');remove.type='button';remove.className='mf-button';remove.textContent='Hapus poin '+number;
    remove.onclick=()=>{points.splice(index,1);drawPoints();preview();addPoint.focus();};
    pointList.append(remove);
   }
  }
  mode.onchange=()=>{values.kycPointMode=mode.value;drawPoints();preview();};
  addPoint.onclick=()=>{extraPoints.push('');drawPoints();preview();pointList.querySelector('textarea:last-of-type').focus();};
  drawPoints();
 }

 if(type==='tugasAgunan'){
   const root=document.getElementById('mfFields');
   if(!root)return;
   const sigPanel=document.createElement('section');
   sigPanel.innerHTML='<label for="stSignature">Mode Tanda Tangan</label>'+
    '<select id="stSignature">'+
     '<option value="otomatis">Otomatis (Tanda Tangan Deki Elanda Pradikta)</option>'+
     '<option value="manual">Manual / Tanda Tangan Basah (Kosong)</option>'+
    '</select>'+
    '<p class="mf-help">Penanda tangan default: <b>Deki Elanda Pradikta</b> (Penyelia Unit - Branch Bandung Jamsostek) lengkap dengan tanda tangan resmi.</p>';
   root.prepend(sigPanel);
   const sigSelect=sigPanel.querySelector('select');
   sigSelect.value=values.tandaTangan||'otomatis';
   sigSelect.onchange=e=>{values.tandaTangan=e.target.value;preview();};

   const targetField=document.getElementById('mf_tujuanTugas');
   const tablePanel=document.createElement('section');
   tablePanel.className='mf-st-builder';
   tablePanel.style='margin:16px 0;padding:14px;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:8px;';
   tablePanel.innerHTML='<h3 style="margin:0 0 4px;font-size:14px;font-weight:bold;color:#1e3a8a;">Tabel Dokumen Debitur yang Diambil</h3>'+
    '<p class="mf-help" style="margin-bottom:12px;">Cari data debitur dari Database Booking untuk pengisian otomatis atau tambahkan baris secara manual.</p>'+
    '<div style="margin-bottom:12px;background:#fff;padding:10px;border-radius:6px;border:1px solid #e2e8f0;">'+
     '<label for="stDebtorSearch" style="font-weight:bold;font-size:12px;color:#1e40af;">Pencarian Debitur (Booking)</label>'+
     '<input id="stDebtorSearch" placeholder="Ketik nama atau nomor rekening pinjaman..." autocomplete="off" style="width:100%;box-sizing:border-box;margin-top:4px;">'+
     '<div id="stSearchResults" class="mf-help" style="max-height:180px;overflow-y:auto;margin-top:4px;"></div>'+
    '</div>'+
    '<div id="stItemsContainer"></div>'+
    '<button type="button" id="stBtnAddRow" class="mf-button" style="margin-top:10px;width:100%;font-weight:bold;">+ Tambah Baris Debitur Manual</button>';

   if(targetField&&targetField.nextElementSibling){
    targetField.after(tablePanel);
   }else{
    root.append(tablePanel);
   }

   const itemsContainer=tablePanel.querySelector('#stItemsContainer');
   const addRowBtn=tablePanel.querySelector('#stBtnAddRow');
   const searchInput=tablePanel.querySelector('#stDebtorSearch');
   const searchResults=tablePanel.querySelector('#stSearchResults');

   if(!Array.isArray(values.items)){
    values.items=[
     {rekPjm:'1310101771642',nama:'MOHAMAD ZAMZAM',dokumen:'SHGB NO. 8200 AN LATIFAH; SHT NO. 05484/2022; SKMHT NO. 5/2021; APHT NO. 11/2022, PENGECEKAN SETIPIKAT',tglOrder:'30/09/2026'},
     {rekPjm:'1310102084391',nama:'HERI IMANUDIN FEVRIANSYAH',dokumen:'BPKB NP. P-04641502; BPKB NO. L-12894328, APLIKASI, PK, ASURANSI JIWA',tglOrder:'30/09/2026'}
    ];
   }

   function renderRows(){
    itemsContainer.replaceChildren();
    values.items.forEach((item,idx)=>{
     const card=document.createElement('div');
     card.style='border:1px solid #cbd5e1;border-radius:6px;padding:10px;margin-bottom:8px;background:#ffffff;box-shadow:0 1px 2px rgba(0,0,0,0.05);';
     card.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'+
      '<span style="font-weight:bold;font-size:12px;color:#1e3a8a;">Debitur #'+(idx+1)+'</span>'+
      '<button type="button" class="mf-button" style="padding:2px 8px;font-size:11px;color:#dc2626;border-color:#fca5a5;" data-del="'+idx+'">Hapus</button>'+
     '</div>'+
     '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px;">'+
      '<div><label style="font-size:11px;margin-bottom:2px;display:block;">No. Rekening Pinjaman</label>'+
      '<input type="text" data-field="rekPjm" data-idx="'+idx+'" value="'+esc(item.rekPjm||'')+'" style="font-size:12px;padding:4px 6px;width:100%;box-sizing:border-box;"></div>'+
      '<div><label style="font-size:11px;margin-bottom:2px;display:block;">Nama Debitur</label>'+
      '<input type="text" data-field="nama" data-idx="'+idx+'" value="'+esc(item.nama||'')+'" style="font-size:12px;padding:4px 6px;width:100%;box-sizing:border-box;"></div>'+
     '</div>'+
     '<div style="margin-bottom:6px;"><label style="font-size:11px;margin-bottom:2px;display:block;">Rincian Dokumen Legal & Agunan</label>'+
     '<textarea data-field="dokumen" data-idx="'+idx+'" rows="2" style="font-size:12px;padding:4px 6px;width:100%;box-sizing:border-box;">'+esc(item.dokumen||'')+'</textarea></div>'+
     '<div><label style="font-size:11px;margin-bottom:2px;display:block;">Tgl. Order (DD/MM/YYYY)</label>'+
     '<input type="text" data-field="tglOrder" data-idx="'+idx+'" value="'+esc(item.tglOrder||'')+'" style="font-size:12px;padding:4px 6px;width:130px;"></div>';
     itemsContainer.append(card);
    });

    itemsContainer.querySelectorAll('[data-del]').forEach(btn=>{
     btn.onclick=()=>{
      const i=Number(btn.dataset.del);
      values.items.splice(i,1);
      renderRows();
      preview();
     };
    });

    itemsContainer.querySelectorAll('input,textarea').forEach(input=>{
     input.oninput=()=>{
      const i=Number(input.dataset.idx);
      const f=input.dataset.field;
      if(values.items[i]){
       values.items[i][f]=input.value;
       preview();
      }
     };
    });
   }

   addRowBtn.onclick=()=>{
    const today=new Date();
    const dStr=String(today.getDate()).padStart(2,'0')+'/'+String(today.getMonth()+1).padStart(2,'0')+'/'+today.getFullYear();
    values.items.push({rekPjm:'',nama:'',dokumen:'',tglOrder:dStr});
    renderRows();
    preview();
   };

   searchInput.oninput=e=>{
    const q=e.target.value.trim().toLowerCase();
    searchResults.replaceChildren();
    if(q.length<2)return;
    const records=typeof dbBooking!=='undefined'&&Array.isArray(dbBooking)?dbBooking:[];
    const matches=records.filter(r=>[r.nama,r.cif,...(r.fasilitas||[]).map(f=>f.rekPjm)].join(' ').toLowerCase().includes(q)).slice(0,10);
    if(!matches.length){
     searchResults.textContent='Debitur tidak ditemukan di database.';
     return;
    }
    matches.forEach(r=>{
     (r.fasilitas||[{}]).forEach(f=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='mf-button';
      btn.style='display:block;width:100%;text-align:left;margin-top:4px;font-size:11.5px;padding:5px 8px;background:#f0fdf4;border-color:#86efac;';
      btn.textContent=(r.nama||'')+' | Rek: '+(f.rekPjm||'-')+' | '+(f.jenisKredit||'Kredit');
      btn.onclick=()=>{
       const docs=[f.jaminanTambahan1,f.jaminanTambahan2,f.jaminanTambahan3].filter(v=>v&&v!=='-').join('; ');
       const today=new Date();
       const dStr=String(today.getDate()).padStart(2,'0')+'/'+String(today.getMonth()+1).padStart(2,'0')+'/'+today.getFullYear();
       values.items.push({
        rekPjm:f.rekPjm||'',
        nama:(r.nama||'').toUpperCase(),
        dokumen:docs||'APLIKASI, PK, ASURANSI JIWA',
        tglOrder:dStr
       });
       searchInput.value='';
       searchResults.replaceChildren();
       renderRows();
       preview();
      };
      searchResults.append(btn);
     });
    });
   };

   renderRows();
  }
  if(type==='bds'){const panel=document.createElement('section');panel.innerHTML='<label for="bdsSignature">Tanda tangan</label><select id="bdsSignature" data-key="tandaTanganBds"><option value="otomatis">Otomatis (Deki Elanda Pradikta)</option><option value="manual">Manual / tanda tangan basah</option></select>';document.getElementById('mfFields').append(panel);panel.querySelector('select').value=values.tandaTanganBds||'otomatis';panel.querySelector('select').onchange=e=>{values.tandaTanganBds=e.target.value;preview();};}
 if(type==='angsuran'){
  const root=document.getElementById('mfFields'),keys=['periode','pokok','bunga','tbyd','bydt','jumlah'];
  const panel=document.createElement('section'),rows=document.createElement('div');
  panel.innerHTML='<h3>Rincian bulan penyesuaian</h3><p class="mf-property-help">Tambahkan satu baris untuk setiap bulan yang disesuaikan.</p>';
  const first=document.getElementById('mf_periode');root.insertBefore(panel,first.previousElementSibling);panel.append(rows);
  const initial=document.createElement('fieldset');initial.innerHTML='<legend>Bulan 1</legend>';
  for(const key of keys){const input=document.getElementById('mf_'+key);initial.append(input.previousElementSibling,input);}rows.append(initial);
  let count=Math.max(1,Number(values.angsuranRows)||1);
  const add=document.createElement('button'),remove=document.createElement('button');add.type=remove.type='button';add.className=remove.className='mf-button';add.textContent='Tambah bulan';remove.textContent='Hapus bulan terakhir';panel.append(add,remove);
  function draw(){
   while(rows.children.length>1)rows.lastElementChild.remove();
   for(let i=2;i<=count;i++){
    const group=document.createElement('fieldset');group.innerHTML='<legend>Bulan '+i+'</legend>';
    for(const key of keys){const def=definitions.angsuran.fields.find(f=>f[0]===key),k=key+'_'+i;const label=document.createElement('label'),input=document.createElement('input');label.htmlFor=input.id='mf_'+k;label.textContent=def[1]+' *';input.dataset.key=k;input.required=true;input.value=values[k]||'';group.append(label,input);}rows.append(group);
   }
   values.angsuranRows=String(count);remove.disabled=count===1;
  }
  add.onclick=()=>{count++;draw();preview();};remove.onclick=()=>{if(count>1){count--;draw();preview();}};draw();
 }
const root=document.getElementById('mfFields');const details=document.createElement('details');details.className='mf-property-form-settings';details.innerHTML='<summary>Kop dan penanda tangan sesuai template</summary><p class="mf-property-help">Terisi sesuai file Word. Buka bagian ini bila perlu mengubah kop, nama, atau jabatan. Gambar tanda tangan hanya tampil untuk nama penanda tangan yang sesuai.</p>';for(const [key] of [...settings,...(type==='angsuran'?definitions.angsuran.fields.filter(f=>f[0].endsWith('2')):[])]){const input=document.getElementById('mf_'+key);if(input)details.append(input.previousElementSibling,input);}root.append(details);}
const logos={"bandung":"data:image/jpeg;base64,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","classic": "data:image/jpeg;base64,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", "branch": "data:image/jpeg;base64,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"};
window.ManualPropertyTemplates={definitions,defaults,css,render,setup};
})();
