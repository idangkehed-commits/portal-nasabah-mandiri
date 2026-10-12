# 🏛️ Portal Cek Kelayakan Kredit Nasabah Mandiri (KUR & KUM)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/idangkehed-commits/portal-nasabah-mandiri)

Aplikasi web modern, cepat, dan nyaman untuk mencari dan memeriksa data kelayakan kredit nasabah (KUR, KUM, kategori Kawan Lama, status eligibilitas, dan eligible limit/plafon kredit) berdasarkan data pipeline kredit mikro Bank Mandiri.

---

## 🌐 Deploy Online 24 Jam di Render.com

Aplikasi ini sudah dikonfigurasi lengkap dengan file `render.yaml` dan skrip otomatis agar dapat berjalan **24 jam nonstop di Render.com**.

### 🚀 Cara Deploy (Hanya 1 Klik):
1. Klik tombol **Deploy to Render** di atas, atau buka tautan berikut:  
   👉 **[https://render.com/deploy?repo=https://github.com/idangkehed-commits/portal-nasabah-mandiri](https://render.com/deploy?repo=https://github.com/idangkehed-commits/portal-nasabah-mandiri)**
2. Jika diminta login, masuk menggunakan akun Render Anda (bisa lewat GitHub / Google / Email).
3. Klik tombol **"Apply"** atau **"Create Web Service"**.
4. Tunggu proses build sekitar 1–2 menit hingga status menjadi **`Live`**.
5. Anda akan mendapatkan URL web publik (contoh: `https://portal-nasabah-kredit.onrender.com`) yang bisa dibuka kapan saja dari laptop, tablet, maupun HP smartphone Anda!

---

## ⏰ Rahasia Berjalan 24 Jam Nonstop Tanpa Sleep (Tidur)

Render Free Tier biasanya masuk ke mode *idle/sleep* jika tidak ada pengunjung selama 15 menit. Untuk memastikan aplikasi Anda **tetap aktif 24 jam penuh tanpa pernah tidur**:

### 1. Fitur Bawaan (Auto Keep-Alive di `server.js`)
Server aplikasi ini sudah dilengkapi mekanisme *self-ping* otomatis:
- Setiap **13 menit**, server akan otomatis mengirimkan request internal ke `/health`.
- Render mendeteksi adanya aktivitas request sehingga server **tidak akan pernah mati/sleep**.

### 2. Cadangan Garansi 24/7 (UptimeRobot - Gratis 100%)
Untuk memastikan keandalan 100% jika Render membatasi self-ping:
1. Buka [UptimeRobot.com](https://uptimerobot.com/) dan buat akun gratis.
2. Klik **"Add New Monitor"**:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `Portal Nasabah Mandiri`
   - **URL (or IP)**: `https://[NAMA-APP-ANDA].onrender.com/health`
   - **Monitoring Interval**: `5 minutes`
3. Klik **Create Monitor**.
4. Selesai! UptimeRobot akan memanggil link Anda setiap 5 menit sehingga web Anda di Render **dijamin 100% selalu online 24 jam penuh**.

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
