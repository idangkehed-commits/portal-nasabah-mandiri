# 🏛️ Portal Cek Kelayakan Kredit Nasabah Mandiri (KUR & KUM)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/idangkehed-commits/portal-nasabah-mandiri)

Aplikasi web modern, cepat, dan nyaman untuk mencari dan memeriksa data kelayakan kredit nasabah (KUR, KUM, kategori Kawan Lama, status eligibilitas, dan eligible limit/plafon kredit) berdasarkan data pipeline kredit mikro Bank Mandiri.

---

## 🌐 Deploy Sebagai Static Site di Render.com (24 Jam Nonstop Tanpa Sleep)

Aplikasi ini sudah diatur dalam format **Static Site di Render.com**, yang memiliki keunggulan:
- ⚡ **Aktif 24 Jam Nonstop**: Dihosting di Global CDN Render, **tidak akan pernah mati/sleep**.
- 🚀 **Buka Web Instan (0 Detik Delay)**: Tidak ada waktu tunggu loading spin-down.
- 🛡️ **100% Gratis Selamanya**: Tanpa batas kuota jam server.

### 🚀 Cara Deploy (Cukup 1 Klik):
1. Klik tombol **Deploy to Render** di atas, atau buka tautan:  
   👉 **[https://render.com/deploy?repo=https://github.com/idangkehed-commits/portal-nasabah-mandiri](https://render.com/deploy?repo=https://github.com/idangkehed-commits/portal-nasabah-mandiri)**
2. Login ke akun Render Anda.
3. Klik tombol **"Apply"**.
4. Tunggu sekitar 15–30 detik sampai statusnya berwarna hijau **`Live`**.
5. Anda langsung mendapatkan URL web resmi yang aktif 24 jam nonstop!

---

## ✨ Fitur Aplikasi

1. **Pencarian Cepat & Nyaman (Instant Search)**:
   - Cari data nasabah seketika berdasarkan **Nama Debitur**, **Nomor CIF (10 digit)**, **Nomor HP / WhatsApp**, atau **Alamat / Petugas SGP**.
   - Shortcut keyboard: Cukup tekan tombol `/` atau `Ctrl + K`.
   - Filter cepat:
     - ⭐ **Kawan Lama** (Menyaring nasabah loyal dengan tier usia lunas)
     - 🔀 **Bisa KUR & KUM** (Nasabah yang eligible kedua produk)
     - 🔵 **KUR Saja**
     - 🟣 **KUM Saja**
     - ✅ **Ada Consent WA** (Menyaring yang boleh dihubungi via WhatsApp)
     - 👤 **Filter Petugas SGP** (Gillan Muhammad, Handika Ardana, Septiani Juwita, dll)

2. **Tampilan Informasi Lengkap & Jelas**:
   - **Rekomendasi Produk**: KUR (Mikro, Kecil, Super Mikro, Ultima) atau KUM (Mikro, Ex-KUR, Regular).
   - **Kategori Nasabah**: ⭐ **Kawan Lama (Lunas ≤ 3 Bln / 3-12 Bln / > 12 Bln)**, *ETB Suplesi Ex-KUR*, *KUR Ultima*.
   - **Status Kelayakan (Eligible)**: Detail program (*AMUNISI*, *KL KUR*, *KPP*, *MADU*, *MECLP*, *Selikuran*).
   - **Eligible Limit (Plafon)**: Ditampilkan besar dan jelas dalam format Rupiah. Jika ada opsi limit ganda (KUR & KUM), dimunculkan berdampingan!
   - **Status Consent**: Menampilkan kepatuhan izin kontak debitur.

3. **Simulasi Cicilan Angsuran Instan**:
   - Menghitung cicilan bulanan tenor **12, 24, 36, dan 48 bulan** sesuai suku bunga produk (KUR subsidi 6% efektif / KUM flat mikro).

4. **Integrasi WhatsApp Siap Kirim**:
   - Tombol 1-klik langsung membuka WhatsApp dengan draft pesan penawaran resmi yang otomatis terisi nama, nomor CIF, dan limit kredit.
   - Pilihan template: Format Kawan Lama, Formal Mandiri, dan Format Santai.

5. **Upload & Ekspor Excel**:
   - Mendukung upload file `.xlsx`, `.xls`, dan `.csv` secara offline dan aman di peramban.
   - Tersedia tombol unduh template dan ekspor database ke file Excel.

---

## 💻 Menjalankan di Komputer Lokal

Jika sedang offline tanpa internet:
- **Cara Langsung**: Klik dua kali file [**`buka_portal.bat`**](file:///c:/Users/ACER%20NITRO/Documents/antigravity/jolly-goodall/portal-nasabah/buka_portal.bat) (atau buka file `index.html` di browser).
- **Via Local Server**: Klik dua kali file [**`jalankan_server.bat`**](file:///c:/Users/ACER%20NITRO/Documents/antigravity/jolly-goodall/portal-nasabah/jalankan_server.bat) untuk akses lewat HP dalam satu jaringan WiFi.


## Impor laporan tagihan mentah

Unggah laporan .xls/.xlsx lewat Impor Data > Excel Tagihan. Pembaca mencari baris header secara otomatis pada seluruh sheet dan menerima laporan Detail1 (header baris 3), tanpa perlu memfilter cabang atau mengganti nama kolom. Semua cabang dalam sheet tersebut diproses. Rekap Top Up bukan data detail.

Pemetaan laporan: acctno -> rekening; nama -> nama; limit -> plafon; bade -> baki debet; kol_Is -> kolektibilitas; produk -> produk; tgl_jt_angs -> hari jatuh tempo; hr_tgg -> hari tunggakan; angsuran -> angsuran; tggpokok/tggbunga/tggdenda -> rincian tunggakan; total_tgg -> total kewajiban (tidak ditambah angsuran lagi); AGF1 -> nomor rekening AGF; Saldo_AGF1 -> saldo AGF; nama_mks -> petugas aktif; CIF -> CIF. kocab/mbu disimpan sebagai kode cabang/nama unit.

Limit dan bade pada laporan mentah bersatuan juta dan dikalikan 1.000.000. Nominal lain bersatuan rupiah, dibulatkan seperti portal sebelumnya, dan ditampilkan memakai pemisah Indonesia. Rekening dan CIF disimpan sebagai teks digit penuh, termasuk nilai numerik Excel yang tampil E+12; ketelitian yang telah hilang dari sumber tidak dapat dipulihkan. Nomor duplikat atau baris rekening tidak lengkap membatalkan impor.

Impor memperbarui berdasarkan nomor rekening, menambah rekening baru, dan mempertahankan rekening lama yang tidak ada pada file. Catatan penagihan tetap memakai kunci rekening. Setelah memeriksa pratinjau dan menyimpan, administrator perlu menerbitkan data ke database bersama. Jangan commit laporan mentah atau data nasabah ke GitHub.
