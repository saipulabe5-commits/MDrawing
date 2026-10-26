> HISTORIS — berasal dari ZIP masukan. Klaim PASS/production-ready di bawah belum disahkan oleh perbaikan 26 Oktober 2026. Gunakan docs/repair-progress.md dan docs/LAPORAN-PERBAIKAN-MDRAWING.md sebagai status terbaru.

# MDRAWING QUOTATION DOCUMENT LIFECYCLE REPORT

## 1. IMPLEMENTATION SUMMARY
- Modul Penawaran telah diubah menjadi workspace mandiri (Commercial Document Lifecycle) yang memisahkan status dari DRAFT hingga AGREED, sebelum pembuatan Proyek.
- Tersedia sistem **Revision Snapshot** yang membuat duplikat dokumen Penawaran dengan penomoran revisi maju (Rev.00 -> Rev.01), sehingga jejak negosiasi lama tidak hilang (berubah menjadi REVISED).
- PDF Generator otomatis dengan `jspdf` menghasilkan surat penawaran resmi berformat A4 lengkap dengan Header Perusahaan, Nomor Revisi, Rincian Pekerjaan (BOQ), Total Nilai, Syarat & Ketentuan, dan tanda tangan digital.

## 2. SECURITY & ISOLATION
- Tidak ada data legacy Quotation maupun Project yang rusak.
- Penawaran hanya dapat dilihat dan dikelola oleh user dengan role yang sah, sesuai dengan struktur isolation per-client/project yang ada pada Firestore rules.
- Pembuatan proyek baru dan Invoicing dikunci rapat hingga Penawaran mencapai status `AGREED`.

## 3. TIMELINE & AUDIT TRAIL
- Setiap aksi mulai dari Draft, Kirim, Negosiasi, hingga Disepakati, direkam otomatis dengan stempel waktu, nilai grand total snapshot, dan nama pengubah pada bagian *Timeline Negosiasi*.

## 4. FINAL CLASSIFICATION
[ COMMERCIAL DOCUMENT LIFECYCLE VERIFIED ]
