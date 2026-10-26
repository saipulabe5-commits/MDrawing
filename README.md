# MDrawing — paket perbaikan 26 Oktober 2026

Kode perbaikan tahap 04–20 telah diterapkan dan diuji terbatas secara lokal. Paket ini **belum mendapat persetujuan rilis produksi**. Baca [laporan](docs/LAPORAN-PERBAIKAN-MDRAWING.md), [matriks 42 temuan](docs/matriks-perbaikan.csv), dan [panduan operasi](docs/DEPLOYMENT.md).

## Menjalankan

1. Gunakan Node.js 22.18+ atau 24 dan npm. Pengujian sesi ini memakai Node 24.21.0/npm 11.19.0; runtime Functions ditetapkan Node 22 dan belum diuji di layanan cloud.
2. Jalankan 'npm ci' dan 'npm --prefix functions ci'. npm/package-lock.json adalah sumber dependensi yang berlaku. SheetJS dipin ke tarball resmi 0.20.3 dengan integrity di lockfile.
3. Konfigurasikan Firebase web pada firebase-applet-config.json. Database bernama 'default' berbeda dari database '(default)'. Samakan server, client, firebase.json, dan Functions. Jangan mengalihkan database tanpa migrasi yang direview.
4. Atur environment server melalui platform/terminal berdasarkan .env.example. Aplikasi tidak otomatis memuat .env.local; jangan mengandalkan petunjuk lama. Kredensial diperlukan oleh server untuk command transaksi. AI dan SMTP tidak diperlukan untuk menjalankan panel inti, tetapi operasi database memerlukan kredensial yang benar.
5. Jalankan 'npm run dev', atau 'npm run build' lalu 'NODE_ENV=production npm start' (atur environment sesuai shell Anda).

## Pemeriksaan

- 'npm run check:local': tipe, suite lokal, PDF, batch, build aplikasi/Functions, dan HTTP lokal.
- 'npm run test:security:emulator': Firestore/Storage demo lokal pada 8888/8999. Memerlukan Java 21+, port kosong, dan unduhan emulator pada penggunaan pertama. Tidak memakai data produksi.
- 'npm run test:all': kedua kelompok di atas. Hasilnya merupakan gate kode lokal, bukan bukti readiness produksi, bukan uji beban, dan bukan bukti email delivered.

## Batas yang wajib diketahui

Akses Storage langsung dinonaktifkan. Dua identitas berbeda diperlukan untuk membuat dan menyetujui pembayaran/biaya. Status AI, SMTP, branding, rekening perusahaan, indeks database, migrasi data lama, dan deployment harus diverifikasi operator di staging. Jangan menjalankan trigger finansial lama bersama command transaksi baru. Tidak ada deploy yang dilakukan dalam sesi perbaikan ini.

## Membuka di Windows

Ekstrak ZIP lalu klik dua kali BUKA-MDRAWING.bat. Launcher memasang dependensi bila diperlukan, membuat build bila perlu, dan membuka browser setelah server siap. Lihat CARA-BUKA-APLIKASI.txt. Launcher membaca .env/.env.local opsional melalui Node; konfigurasi Firebase tetap harus sesuai proyek.
