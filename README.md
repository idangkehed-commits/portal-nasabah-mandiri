# 🏛️ Portal Cek Kelayakan Kredit Nasabah (KUR & KUM)

Aplikasi web modern, cepat, dan nyaman untuk mencari dan memeriksa data kelayakan kredit nasabah (KUR, KUM, kategori Kawan Lama, status eligibilitas, dan eligible limit/plafon kredit) berdasarkan data pipeline yang diunggah dalam bentuk Excel.

---

## ✨ Fitur Utama

1. **Pencarian Cepat & Nyaman (Instant Search)**
   - Cari data nasabah seketika berdasarkan **Nama Lengkap**, **NIK KTP (16 digit)**, **Nomor HP / WhatsApp**, atau **Kota / Sektor Usaha**.
   - Shortcut keyboard: Cukup tekan tombol `/` atau `Ctrl + K` untuk langsung fokus ke kotak pencarian.
   - Filter cepat 1-klik:
     - 🔵 **KUR Saja** (Kredit Usaha Rakyat: Super Mikro, Mikro, Ritel)
     - 🟣 **KUM Saja** (Kredit Usaha Mikro)
     - ⭐ **Kawan Lama** (Nasabah eksisting dengan badge emas VIP)
     - 📈 **Limit ≥ Rp 50 Juta**

2. **Tampilan Informasi Kelayakan Lengkap**
   Ketika nasabah ditemukan, sistem langsung menampilkan:
   - **Rekomendasi Produk**: KUR (Mikro, Super Mikro, Ritel) atau KUM (Mikro, Regular).
   - **Kategori Nasabah**: ⭐ **Kawan Lama**, Nasabah Baru, Nasabah Loyal, atau Payroll.
   - **Status Kelayakan (Eligible)**: Keterangan mendalam (misal: *Eligible tanpa agunan tambahan*, *Bunga 6% subsidi*, *Suplesi dipercepat*, dsb).
   - **Eligible Limit (Plafon)**: Ditampilkan jelas dan besar dalam format Rupiah (contoh: `Rp 100.000.000`).
   - **Profil Nasabah**: NIK (dengan tombol 1-klik salin), No. HP, Sektor Usaha, dan Wilayah.

3. **Simulasi Cicilan Angsuran Instan**
   - Otomatis menghitung estimasi angsuran per bulan untuk tenor **12, 24, 36, dan 48 bulan**.
   - Perhitungan disesuaikan dengan skema produk (KUR bunga 6% efektif per tahun / KUM flat per bulan).

4. **Integrasi WhatsApp & Salin Ringkasan**
   - **Buka Chat WhatsApp**: Tombol 1-klik langsung membuka chat WhatsApp dengan pesan penawaran resmi yang sudah otomatis terisi nama nasabah, produk, dan limit.
   - Pilihan template WhatsApp: Format Resmi, Khusus Nasabah Kawan Lama, atau Format Santai/Singkat.
   - **Salin Ringkasan**: Salin data kelayakan ke clipboard untuk laporan tim atau atasan.
   - **Cetak Lembar Screening**: Format print preview rapi siap cetak dan tanda tangan petugas.

5. **Upload Excel Fleksibel (Drag & Drop)**
   - Mendukung file **`.xlsx`**, **`.xls`**, dan **`.csv`**.
   - **Smart Column Detection**: Otomatis mengenali kolom meskipun judul kolom di Excel sedikit berbeda (misal: *Nama*, *NIK/KTP*, *No HP*, *Produk/Program*, *Kategori/Kawan Lama*, *Limit/Plafon*, *Keterangan/Eligible*).
   - Pilihan metode: **Ganti Semua Data** atau **Tambahkan ke Data Eksisting**.
   - Tombol **"Download Template Excel"** tersedia langsung di aplikasi jika ingin format standar rapi.

6. **Penyimpanan Lokal Aman & Offline (Persistent)**
   - Semua data tersimpan di penyimpanan browser (`localStorage`).
   - Tidak akan hilang saat browser ditutup atau direfresh.
   - 100% aman dan bekerja offline tanpa perlu koneksi internet untuk membaca file Excel.

---

## 🚀 Cara Menjalankan

Ada 2 cara mudah untuk membuka aplikasi ini:

### Cara 1: Buka Langsung (Paling Mudah)
1. Buka folder `portal-nasabah`.
2. Klik dua kali (double-click) file **`buka_portal.bat`** (atau langsung buka file `index.html` dengan Google Chrome, Edge, atau browser favorit Anda).
3. Web langsung terbuka dan siap digunakan!

### Cara 2: Jalankan via Server Lokal (Bisa Dibuka dari HP Android/iPhone)
Jika Anda ingin membuka aplikasi ini dari handphone saat berada di kantor atau di lapangan (dalam jaringan Wi-Fi yang sama dengan laptop):
1. Klik dua kali file **`jalankan_server.bat`**.
2. Terminal akan menampilkan alamat IP, contoh:
   - Dari Laptop: `http://localhost:3000`
   - Dari HP / WiFi: `http://192.168.1.16:3000`
3. Buka alamat tersebut di browser HP Anda.

---

## 📁 Format Kolom Excel yang Disarankan

Jika Anda ingin menyiapkan file Excel sendiri, berikut susunan kolom yang sangat direkomendasikan:

| Nama Kolom Excel | Contoh Isi | Keterangan |
| :--- | :--- | :--- |
| **Nama Nasabah** | Haji Ahmad Fauzi | Nama lengkap debitur |
| **NIK KTP** | 3201011504780001 | 16 digit NIK KTP |
| **No HP WA** | 081289123456 | Nomor kontak untuk WhatsApp |
| **Produk Kredit** | KUR Mikro / KUM Mikro | KUR Mikro, KUR Super Mikro, KUM Mikro, dll |
| **Kategori Nasabah** | Kawan Lama | *Kawan Lama*, *Nasabah Baru*, *Payroll*, dll |
| **Eligible Limit Plafon** | 100000000 | Angka nominal limit (misal 100000000) |
| **Keterangan Eligible** | Eligible KUR Mikro s.d. 100 Juta | Alasan kelayakan / catatan khusus |
| **Sektor Usaha** | Grosir Kelontong & Sembako | Jenis perdagangan / usaha |
| **Alamat Lokasi** | Pasar Kramat Jati, Jakarta | Alamat tempat usaha / domisili |

> 💡 **Tips Praktis:** 
> Anda dapat langsung mengklik tombol **"Template Excel"** di bagian atas aplikasi untuk mendownload contoh file Excel resmi yang sudah rapi dan siap diedit!
> File contoh `contoh_data_nasabah.xlsx` juga sudah disediakan di dalam folder ini.

---

## 🛡️ Keamanan & Privasi
Seluruh pemrosesan file Excel dan pencarian data nasabah dilakukan **100% di browser lokal Anda**. Tidak ada data nasabah atau NIK perbankan yang dikirimkan ke server eksternal, sehingga kerahasiaan data nasabah tetap terjaga secara ketat.
