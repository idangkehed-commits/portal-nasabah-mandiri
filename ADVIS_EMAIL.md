# Pengiriman PDF Advis melalui Gmail

Fitur ini menggunakan Gmail API dari browser admin. Server Render gratis memblokir port SMTP; tidak perlu mengganti paket Render untuk integrasi HTTPS ini.

## Konfigurasi portal saat ini

Proyek Google `Portal Nasabah Advis` (`soy-channel-512805-f4`) sudah dibuat, Gmail API diaktifkan, origin portal dibatasi, dan akun pengirim ditambahkan sebagai test user. Public Client ID sudah tersedia sebagai nilai bawaan portal; Client Secret tidak dipakai. Aplikasi masih dalam status Testing. Pemilik perlu menghubungkan Gmail sendiri di dialog email.

## Pengaturan ulang bila diperlukan

1. Masuk ke Google Cloud Console dengan akun Gmail pengirim, lalu pilih atau buat proyek khusus portal.
2. Aktifkan Gmail API untuk proyek tersebut.
3. Atur Google Auth Platform / OAuth consent screen. Untuk penggunaan pribadi dalam status Testing, tambahkan akun Gmail pengirim sebagai test user. Aplikasi meminta hanya `https://www.googleapis.com/auth/gmail.send` dan `https://www.googleapis.com/auth/userinfo.email`.
4. Buat OAuth Client ID jenis **Web application**. Tambahkan Authorized JavaScript origin: `https://portal-nasabah-mandiri-ttnu.onrender.com` (tanpa path). Untuk uji lokal, tambahkan origin localhost yang benar.
5. Salin **Client ID**, bukan Client Secret atau password. Di portal admin buka Advis, pilih **Kirim PDF via Email**, buka **Pengaturan koneksi Gmail**, tempel Client ID dan simpan. Client ID tersimpan di browser ini saja.
6. Klik **Hubungkan Gmail** dan selesaikan pemilihan akun serta persetujuan izin sendiri. Persetujuan Google tidak dijalankan agen.

## Pemakaian

Isi Advis beserta nomor surat. Pada dialog email, pilih penerima otomatis atau manual. Mode manual menerima beberapa alamat dipisahkan koma, maksimal 10. Periksa penerima, subjek dan pesan, lalu tekan **Kirim PDF**. Mengunduh PDF biasa tidak mengirim email. Pengiriman otomatis penuh tanpa klik tidak diaktifkan.

Tombol kirim aktif setelah akun pengirim yang sesuai terverifikasi. PDF dibuat dari fungsi ekspor Advis yang sama, maksimum 10 MB. Unduh PDF dan cetak tetap tersedia. Jika respons pengiriman terputus, periksa Terkirim sebelum mencoba ulang karena hasilnya mungkin sudah diterima Gmail. Tidak ada percobaan kirim ulang otomatis.

Token akses hanya berada dalam memori tab, tidak disimpan di localStorage, database atau repository. Koneksi perlu diulang saat token berakhir atau halaman dimuat ulang. Tombol Putuskan Gmail mencabut izin koneksi aplikasi. Integrasi tidak membaca kotak masuk. File PDF dikirim langsung ke Gmail API ketika pengguna menekan tombol Kirim PDF.

## Verifikasi

Pengujian menggunakan OAuth dan Gmail API tiruan: penerima otomatis/manual, validasi alamat, pemeriksaan akun pengirim, byte lampiran PDF, gagal kirim dan akses viewer. Jalur PDF sebenarnya diuji terpisah untuk callback dan unduhan biasa. Belum ada email nyata dikirim sebelum pemilik mengatur Client ID dan memberikan izin Gmail.

Referensi: https://render.com/docs/free ; https://developers.google.com/identity/oauth2/web/guides/use-token-model ; https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid ; https://developers.google.com/workspace/gmail/api/guides/sending
