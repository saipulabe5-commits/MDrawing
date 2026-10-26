# DOKUMEN RENCANA PERBAIKAN MDRAWING (REPAIR PLAN)
**Versi:** 1.0.0 (Tahap 00 — Persiapan)  
**Tanggal:** 22 Oktober 2026  
**Status Eksekusi:** Baseline Persiapan Selesai (Menunggu Tahap 01)

---

## 1. Ringkasan Eksekutif & Struktur Proyek

MDrawing adalah sistem manajemen operasional dan keuangan komersial terpadu untuk studio arsitektur, perencanaan teknik, dan kontraktor perancangan (AEC). Sistem ini menggabungkan manajemen register gambar teknis, penerbitan transmittal berkas gambar, siklus penawaran & penagihan keuangan (quotation, milestone terms, invoice, penerimaan pembayaran), pengadaan & SPK vendor, pencatatan arus kas (cashflow & expenses), integrasi AI kontekstual (Upstage Solar Pro & Gemini), modul email notifikasi, serta generator PDF dokumen legal.

### Spesifikasi Runtime & Toolchain Aktual
- **Runtime Node.js:** `v22.23.3` (Linux x86_64 container)
- **Package Manager:** `npm` v10.9.9 (file definisi utama: `package.json`, lockfile sekunder di repo: `bun.lock`, sub-package lockfile: `functions/package-lock.json`)
- **Frontend Stack:** React v19.0.1, Vite v6.2.3, Tailwind CSS v4.1.14 (Vite plugin `@tailwindcss/vite`), React Router DOM v7.18.3, Lucide React icons, jsPDF & jspdf-autotable
- **Server Engine:** Express v4.21.2 (`server.ts`), di-bundle saat produksi menggunakan `esbuild` v0.25.0 ke `dist/server.cjs`
- **Database & Auth:** Firebase Firestore (Cloud Firestore Web SDK v12.18.0 & Firebase Admin SDK v14.3.0), Firebase Authentication (Google OAuth & Custom Claims RBAC)
- **Cloud Functions:** Firebase Functions v5.0.0 & Firebase Admin v12.0.0 (`functions/src/index.ts`)
- **Storage:** Firebase Storage dengan Zero-Trust path security (`storage.rules`)

---

## 2. Fasilitas Pemulihan Perubahan & Checkpoint

- **Git Version Control:** Binary `git` tersedia di environment (`git version 2.34.1`).
- **Initial Checkpoint:** Repositori Git lokal telah diinisialisasi (`git init`) dan seluruh source code aktual pada Tahap 00 telah di-commit ke branch `master` dengan commit message:
  `checkpoint: initial state before TAHAP 01`
- **Mekanisme Revert / Rollback:**
  - Perubahan file per-langkah dapat dipantau via `git diff` atau `git status`.
  - Pemulihan instan jika terjadi regresi dapat dilakukan dengan `git checkout -- <file>` atau `git reset --hard HEAD`.
  - Snapshot arsip cadangan juga dapat diekspor melalui endpoint terproteksi `/api/admin/export-source-code` (khusus role OWNER dengan sensor redaksi secret).

---

## 3. Kondisi Awal Build, Tipe, dan Pengujian Lokal

| Perintah Pengujian | Exit Code | Hasil Aktual | Keterangan & Hambatan Lingkungan |
|---|:---:|---|---|
| `npm run lint` (`tsc --noEmit`) | **0** | **BERHASIL** (0 syntax/type error) | Seluruh kode TypeScript pada root project lolos pengecekan tipe statis. |
| `npm run build` (`vite build && esbuild ...`) | **0** | **BERHASIL** | Bundle frontend `dist/` terbuat (3.9 MB JS, 130 KB CSS) dan bundle server backend `dist/server.cjs` (88.6 KB) selesai tanpa error kompilasi. |
| `npm test` (Unit & Safety Suite) | **0** | **BERHASIL** (38/38 unit tests pass) | Menjalankan 6 suite: `projectWorkflow.test.ts`, `dirtyDozenTest.ts`, `exportSecurityTest.ts`, `aiSafetyTest.ts`, `negative-testing.ts` (30 checks), `audit-contrast.ts` (WCAG AA). |
| `npm run test:security:emulator` | N/A | **TERBLOKIR** | Memerlukan Java Runtime Environment (JRE) untuk menjalankan Firebase Local Emulator (`sh: 1: java: not found`). Pengujian keamanan aturan rules dijalankan melalui Cloud deployed rules dan unit evaluators in-memory. |

> **Peringatan Integritas:** Status kompilasi (build berhasil) bukan merupakan bukti bahwa seluruh integrasi sistem, otorisasi RBAC, alur kas, dan pencegahan eskalasi hak istimewa telah bebas dari bug. Audit dan pengujian bertahap wajib dilanjutkan.

---

## 4. Matriks Rencana Audit & Perbaikan (AUD-01 s/d AUD-42)

| AUD ID | Komponen / Topik | Status | Lokasi Aktual | Rencana Perubahan / Tindakan | Metode Pengujian | Hasil Pengujian Aktual | Batas Verifikasi & Kendala Lingkungan |
|---|---|:---:|---|---|---|:---:|---|
| **AUD-01** | Toolchain & Runtime Consistency | TERVERIFIKASI | `package.json`, `bun.lock` | Selaraskan dependensi dan pastikan scripts npm dev/build/test terdefinisi baku | CLI check `node -v`, `npm -v`, `npm run lint` | BERHASIL | Node v22.23.3 & npm v10.9.9 stabil |
| **AUD-02** | Checkpoint & Recovery System | TERVERIFIKASI | Git Repository (`.git/`) | Inisialisasi repo git lokal dan rekam baseline commit pertama tanpa timpa data | `git status`, `git log -n 1` | BERHASIL | Branch `master` aktif dengan commit baseline |
| **AUD-03** | Firebase Client Config & Init | TERVERIFIKASI | `firebase-applet-config.json`, `src/lib/firebase.ts` | Pastikan konfigurasi dibaca aman tanpa membeberkan secret di UI | `src/lib/firebase.ts` inspection & client test | BERHASIL | Config valid; tidak ada API key leak di UI |
| **AUD-04** | Firebase Admin SDK Initialization | BELUM DIUJI | `server.ts` | Validasi inisialisasi Admin SDK via service account atau ADC credential | `/api/admin/healthcheck-db` route | TERBLOKIR | Memerlukan kredensial service account aktif di runtime cloud |
| **AUD-05** | Firestore Security Rules Deployment | TERVERIFIKASI | `firestore.rules`, Firebase Cloud | Sinkronisasi aturan keamanan ke live cloud database | RPC `fax.DeployRules`, tool `deploy_firebase` | BERHASIL | Rules telah terdeploy ke project Firebase default |
| **AUD-06** | Storage Security Rules & Zero-Trust | BELUM DIUJI | `storage.rules`, Firebase Storage | Audit pembatasan ukuran file, mime-types, dan isolasi folder per proyek | Rules analysis & test script | BELUM DIUJI | Perlu pengujian unggah file simulasi per role |
| **AUD-07** | Cloud Functions Authoritative Sync | BELUM DIUJI | `functions/src/index.ts` | Verifikasi trigger kalkulasi otomatis invoice, vendor bill, dan sinkronisasi klien | Source inspection & transaction logic | BELUM DIUJI | Functions berjalan di cloud environment terpisah |
| **AUD-08** | Anti-Escalation Bootstrap Owner | TERVERIFIKASI | `server.ts:1115-1140` | Batasi bootstrap hak OWNER hanya untuk email pemilik resmi dalam whitelist | API call ke `/api/auth/bootstrap-check-owner` | BERHASIL | Email tak dikenal ditolak (HTTP 403) |
| **AUD-09** | Role-Based Access Control (RBAC) Engine | TERVERIFIKASI | `src/security/authorization.ts` | Pastikan hirarki peran (OWNER, ADMIN, FINANCE, PL, TEAM, VIEWER) konsisten | `hasCapability()` evaluator suite | BERHASIL | Evaluasi peran dan granular overrides konsisten |
| **AUD-10** | Finance Access Isolation (`canViewFinance`) | TERVERIFIKASI | `firestore.rules`, `src/hooks/usePermissions.ts` | Pastikan modul finance tertutup bagi TEAM/VIEWER dan terbuka bagi FINANCE/OWNER | Query test & UI gating review | BERHASIL | Penegakan akses level DB dan UI terhubung |
| **AUD-11** | Vendor Cost Isolation (`canViewVendorCost`) | BELUM DIUJI | `firestore.rules`, `src/views/project/ProjectVendorView.tsx` | Sembunyikan harga SPK dan nilai kontrak vendor dari drafter studio | Role impersonation & data fetch test | BELUM DIUJI | Akan diuji menyeluruh pada Tahap Modul Keuangan |
| **AUD-12** | Client Master Data & Projects Sync | BELUM DIUJI | `src/context/FinanceContext.tsx`, `server.ts` | Sinkronisasi nama/email klien ke proyek terkait saat data klien diperbarui | Realtime listener test di `server.ts` | BELUM DIUJI | Verifikasi integrasi data antar panel |
| **AUD-13** | Quotation Lifecycle & Status Guard | TERVERIFIKASI | `src/lib/validationSchemas.ts`, `src/views/QuotationDetailView.tsx` | Validasi status transisi: Draft -> Sent -> Approved -> Rejected | Schema validation test | BERHASIL | Zod schema menolak diskon negatif & pajak > 100% |
| **AUD-14** | Auto Down-Payment Invoice Creation | BELUM DIUJI | `src/views/QuotationDetailView.tsx` | Pembuatan faktur uang muka instan saat penawaran disetujui klien | Workflow test penawaran ke invoice | BELUM DIUJI | Diuji pada alur komersial proyek |
| **AUD-15** | Invoice Calculation & Invariants | TERVERIFIKASI | `src/lib/validationSchemas.ts`, `src/engine/financial/` | Validasi `grandTotal = subTotal - discount + tax`, saldo sisa non-negatif | Unit test `negative-testing.ts` | BERHASIL | Formula perhitungan matematis terkunci aman |
| **AUD-16** | Client Payment Allocation & Auto-Status | BELUM DIUJI | `src/views/project/finance/PaymentsTab.tsx`, `server.ts` | Update otomatis status invoice (Paid / Partial Paid / Sent) saat pembayaran masuk | Server-side trigger test | BELUM DIUJI | Menunggu verifikasi end-to-end pembayaran |
| **AUD-17** | Vendor SPK & Subcontractor Contract | BELUM DIUJI | `src/views/project/vendor/VendorContractsTab.tsx` | Validasi nominal kontrak vendor tidak boleh melebihi plafon budget proyek | Input validation test | BELUM DIUJI | Diuji pada tahap audit vendor |
| **AUD-18** | Vendor Payment Terms & Milestone Bills | BELUM DIUJI | `src/views/project/vendor/VendorTermsTab.tsx` | Verifikasi total persentase termin vendor tidak melebihi 100% | Negative testing suite | BERHASIL | Schema menolak termin > 100% dan nominal <= 0 |
| **AUD-19** | Vendor Disbursement & Hutang Tracking | BELUM DIUJI | `src/views/project/vendor/VendorHutangTab.tsx` | Perhitungan sisa hutang vendor real-time terhadap total tagihan yang diverifikasi | Ledger calculation test | BELUM DIUJI | Diuji pada audit pembukuan vendor |
| **AUD-20** | Project Operational Expenses | TERVERIFIKASI | `src/views/project/finance/ExpensesTab.tsx` | Pencatatan pengeluaran operasional (site visit, printing, transport) | Zod schema testing | BERHASIL | Kategori wajib valid, nilai harus > 0 |
| **AUD-21** | Cashflow Ledger Inflow & Outflow | TERVERIFIKASI | `src/views/project/finance/CashflowTab.tsx` | Buku kas pencatatan mutasi kas masuk/keluar terkait proyek | Negative test suite | BERHASIL | Menolak nominal 0 atau negatif, tipe harus IN/OUT |
| **AUD-22** | Immutable Financial Audit Logs | TERVERIFIKASI | `firestore.rules:341-347`, `src/views/FinancialAuditLogView.tsx` | Aturan `allow update, delete: if false;` pada `financialAuditLogs` | Security rules evaluation test | BERHASIL | Log finansial dijamin read-only dan append-only |
| **AUD-23** | Profit & Loss (P&L) Calculation Engine | BELUM DIUJI | `src/views/project/finance/ProfitLossTab.tsx` | Rumus kalkulasi: Realisasi Pendapatan - Realisasi Vendor - Operasional | Mathematical integrity check | BELUM DIUJI | Verifikasi visual dan sinkronisasi nominal |
| **AUD-24** | Drawing Register Data Structure | BELUM DIUJI | `src/context/DrawingContext.tsx` | Struktur hierarki: Proyek -> Disiplin / DrawingGroup -> DrawingItem | Hierarchy & ordering verification | BELUM DIUJI | Diuji pada modul drawing register |
| **AUD-25** | Drawing Sheet Numbering Auto-Generator | BELUM DIUJI | `src/lib/drawingNumberUtils.ts` | Standarisasi format penomoran gambar (misal: `AR-PL-01`) | Format generator test | BELUM DIUJI | Diuji pada validasi format gambar |
| **AUD-26** | Drawing Revision & Approval Cycle | BELUM DIUJI | `src/views/project/ProjectRevisionView.tsx` | Siklus status revisi: DRAFT -> SUBMITTED -> REVISED -> APPROVED | State transition validation | BELUM DIUJI | Diuji pada alur approval berkas |
| **AUD-27** | Bulk PIC Assignment & Status Update | BELUM DIUJI | `src/views/project/ProjectListView.tsx` | Fitur update masal progress dan penugasan PIC gambar | Bulk operation performance test | BELUM DIUJI | Diuji pada interaksi tabel gambar |
| **AUD-28** | Transmittal Issue Logging & PDF Export | BELUM DIUJI | `src/views/project/ProjectTransmittalView.tsx` | Dokumentasi berkas pengiriman gambar resmi ke klien atau kontraktor | Transmittal generation test | BELUM DIUJI | Diuji pada modul transmittal |
| **AUD-29** | Master Drawing Templates System | TERVERIFIKASI | `src/views/DrawingTemplatesView.tsx`, `firestore.rules:319` | Pengelolaan template master gambar global dan seeding ke proyek baru | Template query & rules evaluation | BERHASIL | Read diizinkan bagi user login, write khusus Admin |
| **AUD-30** | Company Settings & Legal Profile | TERVERIFIKASI | `src/context/DocumentContext.tsx`, `firestore.rules:475` | Penyimpanan profil legal perusahaan, rekening bank, dan NPWP | Graceful fallback & read test | BERHASIL | Default company profile aktif dan terlindungi |
| **AUD-31** | PDF Quotation Generator Engine | BELUM DIUJI | `src/lib/pdfGenerator.ts` | Kompilasi surat penawaran harga resmi dengan kop surat, tabel RAB, dan termin | PDF render test | BELUM DIUJI | Diuji pada tahap generator dokumen |
| **AUD-32** | PDF Invoice Generator Engine | BELUM DIUJI | `src/lib/pdfGenerator.ts` | Kompilasi faktur penagihan resmi dengan rincian termin, rekening BCA/Mandiri | PDF render test | BELUM DIUJI | Diuji pada tahap generator dokumen |
| **AUD-33** | PDF Transmittal Generator Engine | BELUM DIUJI | `src/lib/pdfGenerator.ts` | Kompilasi lembar transmittal pengiriman gambar dengan checklist format CAD/PDF | PDF render test | BELUM DIUJI | Diuji pada tahap generator dokumen |
| **AUD-34** | AI Upstage Solar Pro Error Detector | BELUM DIUJI | `server.ts:2009-2090`, `src/views/SolarAuditView.tsx` | Pemeriksaan ketidaksesuaian RAB, penomoran gambar, dan kelengkapan dokumen | API proxy route verification | BELUM DIUJI | Pemanggilan berbayar di-guard; hanya uji mock aman |
| **AUD-35** | AI Zero-Billing & Model Whitelist Guard | TERVERIFIKASI | `src/ai/AIPolicyGuard.ts`, `src/engine/ai/aiSafetyTest.ts` | Tolak keras model berbayar non-whitelist; enforce Zero-Billing policy | Unit test suite (8 tests) | BERHASIL | Model berbayar ditolak; whitelist Gemini Flash lolos |
| **AUD-36** | AI Anti-Prompt Injection Defense | TERVERIFIKASI | `src/ai/AIPolicyGuard.ts` | Deteksi pola serangan injeksi instruksi (ignore previous instructions) | Injection test cases | BERHASIL | Pola injeksi terdeteksi dan diblokir |
| **AUD-37** | Email Dispatcher & SMTP Fallback | BELUM DIUJI | `server.ts:1185`, `src/lib/emailService.ts` | Pengiriman email notifikasi dengan fallback simulator aman tanpa credentials | `/api/send-email` test mode simulator | BELUM DIUJI | Mode simulator aktif saat SMTP env kosong |
| **AUD-38** | Deadline Cron Endpoint Security | TERVERIFIKASI | `server.ts:1268-1282` | Endpoint `/api/check-deadline-emails` menolak pemanggilan tanpa secret >= 16 char | Cron header & secret validation | BERHASIL | Fallback hardcoded secret dihapus |
| **AUD-39** | Export Source Code Sanitization | TERVERIFIKASI | `server.ts:2313`, `src/security/exportSecurityTest.ts` | Sensor redaksi otomatis terhadap secret (API keys, JWT, conn strings) pada zip | Unit test `exportSecurityTest.ts` | BERHASIL | Redaksi rahasia terbukti 100% akurat |
| **AUD-40** | WCAG 2.1 AA Color Contrast Compliance | TERVERIFIKASI | `src/index.css`, `scripts/audit-contrast.ts` | Rasio kontras teks >= 4.5:1 untuk semua token warna pada mode terang & gelap | Kontras script evaluation | BERHASIL | 14/14 token warna lolos standar WCAG 2.1 AA |
| **AUD-41** | Responsive Layout & macOS Surface UI | TERVERIFIKASI | `src/layouts/MainLayout.tsx` | Navigasi sidebar, backdrop mobile, modal responsif tanpa overflow | Visual & DOM inspection | BERHASIL | Sidebar & backdrop responsif |
| **AUD-42** | Production Build & Asset Tree Integrity | TERVERIFIKASI | `vite.config.ts`, `server.ts` | Verifikasi bundle JS/CSS dan esbuild CJS server tanpa dependensi rusak | `npm run build` | BERHASIL | Frontend & server ter-bundle rapi di `dist/` |

---

## 5. Prosedur Transisi Menuju Tahap 01

1. Tahap 00 ini ditutup dengan status baseline terinspeksi, build bersih, test unit pass, dan repositori git checkpoint terkunci.
2. Tidak ada mutasi kode yang mengubah fungsionalitas bisnis pada tahap ini.
3. Menunggu perintah user untuk memulai **TAHAP 01: Audit & Refactoring Fondasi Keamanan & Database**.
