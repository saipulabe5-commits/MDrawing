> HISTORIS — berasal dari ZIP masukan. Klaim PASS/production-ready di bawah belum disahkan oleh perbaikan 26 Oktober 2026. Gunakan docs/repair-progress.md dan docs/LAPORAN-PERBAIKAN-MDRAWING.md sebagai status terbaru.

# MDRAWING COMMERCIAL-FIRST WORKFLOW REPORT

## 1. OLD WORKFLOW
- Proyek langsung dibuat dari `NewProjectWizardView` yang berisi langkah-langkah pencampuran setup teknis (tim, drawing, timeline) dengan kesepakatan komersial (nilai kontrak, DP, tax, quotation).
- Data sering menjadi duplikat karena pengguna diminta membuat quotation baru meskipun sebenarnya kesepakatan komersial sudah terjadi di luar sistem, atau sebaliknya.
- Status "Planning" dipakai untuk segala sesuatu yang belum aktif, baik itu komersial maupun operasional.

## 2. NEW WORKFLOW
- Mengadopsi prinsip "Commercial First, Operations Second."
- **Pipeline Komersial** yang terpisah sebelum sebuah Proyek terbentuk.
- **Client → Quotation (Draft/Sent/Negotiation) → Quotation Agreed → Konversi ke Proyek → Project Setup Wizard (hanya Operasional) → Ready to Work → Active**.
- Pengguna memulai dengan membuat Klien dan Penawaran, bukan Proyek.
- Proyek Operasional dikunci dari "Commercial Baseline" (Quotation yang berstatus AGREED).

## 3. STATE MODEL
Status dipisahkan secara tegas:
- **Commercial Status:** DRAFT, SENT, NEGOTIATION, REVISED, AGREED, REJECTED, EXPIRED.
- **Operational Status:** NOT_STARTED, SETUP, READY, ACTIVE, ON_HOLD, COMPLETED, CLOSED.
Legacy status ("Planning", "Berjalan", dll) tetap didukung pada level TypeScript agar data proyek lama tidak rusak, tetapi alur proyek baru menggunakan status yang tegas terpisah dari fase komersial.

## 4. COMMERCIAL FLOW
- Tersedia **Pipeline Penawaran** baru di Dashboard dan Sidebar (Menu 3. Pipeline Penawaran).
- Penawaran yang berstatus `AGREED` akan memunculkan tombol "Jadikan Proyek".
- Proses negosiasi komersial dilakukan secara independen dari eksistensi Proyek.

## 5. PROJECT FLOW
- Tombol `[ + Project Baru ]` pada halaman proyek dihapus dan dialihkan ke `[ Pipeline Penawaran ]`.
- Halaman Wizard (`NewProjectWizardView.tsx`) dirombak drastis. Hanya tersisa langkah teknis (Info, Tim, Drawing Register awal, Timeline, dan Final Check).
- Data komersial seperti `contractValue` dan `clientId` di-prefill otomatis dari Commercial Baseline (Quotation) dan dikunci (*read-only* saat Wizard).

## 6. BILLING FLOW
- Tagihan berbasis Termin (Payment Terms) dibuat berdasarkan *Agreed Quotation*.
- Keterhubungan Nilai Kontrak berjalan presisi karena Quotation berdiri independen sebelum Invoice diterbitkan (mengikuti milestone).

## 7. FILES MODIFIED
- `/src/types.ts` - Memisahkan `CommercialStatus` dan `ProjectStatus/OperationalStatus`. Menambahkan relasi komersial ke Proyek.
- `/src/layouts/MainLayout.tsx` - Menghapus wizard proyek langsung, menambahkan menu `Pipeline Penawaran`.
- `/src/App.tsx` - Menambahkan route untuk `/pipeline` dan `/quotations/:id`.
- `/src/views/DashboardView.tsx` - Merombak UI untuk Command Center terbagi menjadi "Pipeline Komersial" dan "Proyek Berjalan".
- `/src/views/PipelineView.tsx` - Menambahkan tampilan Pipeline untuk memonitor siklus komersial Klien → Quotation.
- `/src/views/QuotationDetailView.tsx` - Menambahkan view detail pembuatan Quotation, Negosiasi, Agreement, dan konversi.
- `/src/views/NewProjectWizardView.tsx` - Mengubah 10-step wizard komersial+operasional menjadi 5-step murni operasional.
- `/src/views/ProjectsView.tsx` - Mengunci pembuatan proyek langsung, mengarahkan user ke Pipeline.
- `/src/views/project/finance/QuotationsTab.tsx` - Perbaikan minor typo status (`Rejected` menjadi `REJECTED`).

## 8. MIGRATION & COMPATIBILITY
- Aplikasi tidak melakukan destructive alter. Proyek lama yang statusnya `Planning` atau `Berjalan` akan tetap ter-render karena legacy string union tetap dipertahankan pada `src/types.ts`.
- Jika data lama tidak memiliki informasi agreement atau quotation baseline, sistem mengizinkan akses ke dalam menu Operasional selama `projectId` valid, memberikan waktu pada pengguna untuk transisi.

## 9. UX CLICK REDUCTION
- Memisahkan layar komersial dan operasional. User baru dapat jelas melihat Quotation yang masih Negosiasi vs Proyek yang sedang Aktif.
- Hilangnya beban mengisi 10+ form (termasuk pajak dan P&L) hanya untuk memulai proyek; sekarang 5 form sederhana.

## 10. FINAL CLASSIFICATION
[ COMMERCIAL-FIRST WORKFLOW VERIFIED ]
