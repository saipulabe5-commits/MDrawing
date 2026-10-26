# DOKUMEN PROGRES PERBAIKAN MDRAWING (REPAIR PROGRESS)
**Versi:** 1.0.0 (Tahap 00 — Persiapan)  
**Terakhir Diperbarui:** 22 Oktober 2026  
**Status Saat Ini:** Tahap 00 Selesai — Menunggu Tahap 01

---

## 1. Log Eksekusi Tahap Proyek

- [x] **Tahap 00 — Persiapan Perbaikan MDrawing** *(Selesai)*:
  - Inspeksi arsitektur aktual: Frontend, Server Express, Firestore rules, Storage rules, Cloud Functions, Modul Finance, AI, Email, PDF Generator.
  - Verifikasi package manager (npm v10.9.9), runtime (Node.js v22.23.3), lockfile (`package.json`, `bun.lock`, `functions/package-lock.json`).
  - Pembuatan fasilitas pemulihan perubahan: Inisialisasi Git lokal (`git init`) dan commit checkpoint baseline (`master`).
  - Eksekusi pemeriksaan tipe statis (`npm run lint`), build lokal (`npm run build`), dan suite pengujian lokal (`npm test`).
  - Dokumentasi rencana dan progres perbaikan (`docs/repair-plan.md` & `docs/repair-progress.md`).
- [x] **Tahap 01 — Perbaiki Autentikasi Server dan Pencabutan Akses (AUD-05 & AUD-06)** *(Selesai)*:
  - Implementasi modul helper autentikasi bersama (`server/auth.ts`) dan pembaruan `server.ts`.
  - Verifikasi canonical user profile dari Firestore: hapus asumsi `isActive = true` jika profil hilang / DB error (fail-closed).
  - Tolak token klaim OWNER lama jika user didemosi di database canonical.
  - Penegakan `checkRevoked: true` pada seluruh tindakan sensitif dan penambahan pencabutan token pada `/api/admin/revoke-user-claim`.
  - Refaktor proteksi export source code (`server/exportHandler.ts`): eksekusi ditolak sebelum membaca filesystem.
  - Penambahan suite tes otomatis terintegrasi (`src/security/serverAuth.test.ts`, 11/11 tests pass).
- [x] **Tahap 02 — Perbaiki Bootstrap dan Pengelolaan Akun (AUD-01, AUD-02, AUD-09, AUD-10, AUD-16)** *(Selesai)*:
  - **AUD-01**: Hapus hardcoded email bypass (`saipulabe5@gmail.com` / `saipulabe@gmail.com`) dan self-healing privilege escalation dari `AuthContext.tsx` dan `firestore.rules`. Implementasi mekanisme satu kali server-controlled bootstrap dengan identitas terverifikasi dan perlindungan segel (`systemSettings/bootstrap`).
  - **AUD-02**: Blokir ADMIN membuat atau memberikan peran OWNER via `/api/admin/create-test-user` dan `/api/admin/set-user-claim`, baik via `role`, nested `capabilities.role`, maupun parameter payload. Penegakan allowlist peran `ALLOWED_NON_OWNER_ROLES`.
  - **AUD-09**: Penegakan status akun aktif (`isPrincipalActive()`) untuk membaca dan mengubah templates master (`drawingTemplates`, `drawingTemplateGroups`, `drawingTemplateItems`, `pdfTemplates`) serta pengaturan perusahaan (`companySettings`, `systemSettings`). Inactive ADMIN ditolak mutlak.
  - **AUD-10**: Larang keras ADMIN menghapus atau menonaktifkan akun OWNER pada level Firestore rules (`existing().get('role', '') != 'OWNER'`) dan server endpoint (`/api/admin/revoke-user-claim`). Terapkan proteksi Last Active Owner agar pemilik aktif terakhir tidak dapat diturunkan atau dinonaktifkan.
  - **AUD-16**: Penegakan aturan `isSafeSelfRegistration` pada `firestore.rules` dan `AuthContext.tsx`: registrasi mandiri hanya menghasilkan role `VIEWER`, status non-aktif (`isActive: false`), seluruh kapabilitas finansial `false`, dan tanpa penugasan proyek. Hapus spread object arbitrary pada server endpoint.
  - Suite tes otomatis komprehensif terpasang (`src/security/accountManagement.test.ts`, 23/23 tests pass).
- [x] **Tahap 03 — Selaraskan Izin dan Tutup Akses Penawaran Tanpa Wewenang (AUD-07, AUD-08, AUD-11, AUD-15)** *(Selesai)*:
  - **Matriks Izin Terpadu**: Pembuatan `src/security/permissionMatrix.ts` sebagai acuan tunggal izin lintas lapis: Frontend UI, Express API, Firestore Rules, dan Storage.
  - **AUD-07**: Wajibkan `canViewFinance()` dan scope yang tepat (proyek terdaftar atau pembuat pipeline) untuk membaca data penawaran harga. Akun VIEWER/TEAM tanpa finance diblokir dari rules dan dimasking di UI (`Rp ••••••`). Pipeline quotation tanpa projectId dibatasi ke pembuat dan company-wide finance (OWNER/ADMIN).
  - **AUD-08**: Tutup celah penghapusan draft quotation. Status `Draft` bukan alasan bebas hapus; wajib memiliki status aktif, wewenang `canEditFinance()`, scope proyek, dan kepemilikan pembuat (`createdBy == uid`). Larang VIEWER/TEAM menghapus quotation milik pengguna/proyek lain.
  - **AUD-11**: Penegakan `hasExplicitDeny` pada `firestore.rules`, `rulesEvaluator.ts`, dan `authorization.ts`: untuk seluruh peran selain OWNER aktif, nilai eksplisit `false` pada dokumen Firestore/user model mengalahkan fallback role. Akun inactive selalu ditolak. OWNER dan ADMIN diselaraskan sebagai satu-satunya company-wide finance roles.
  - **AUD-15**: Penguncian koleksi `/users/{userId}`: hanya dapat di-`get` oleh diri sendiri atau OWNER/ADMIN; `list` khusus OWNER/ADMIN. Pembuatan direktori minimal `/userDirectory/{userId}` dan endpoint `/api/users/directory` yang hanya mengekspos atribut identitas publik (`uid`, `name`, `email`, `role`, `isActive`) tanpa kapabilitas keamanan atau penugasan proyek.
  - Penambahan suite tes otomatis komprehensif (`src/security/quotationPermissions.test.ts`, 63/63 tests pass) dan integrasi ke `package.json` `npm test`.
- [ ] **Tahap 04 — Manajemen Gambar, Revisi, & Transmittal** *(Menunggu)*
- [ ] **Tahap 05 — Asisten AI, Integrasi Email, & Generator PDF Dokumen** *(Menunggu)*
- [ ] **Tahap 06 — Verifikasi Menyeluruh & Uji Regresi Akhir** *(Menunggu)*

---

## 2. Tabel Pelacakan Audit AUD-01 s/d AUD-42

Berikut adalah status pelacakan setiap item audit dengan format kolom:
`AUD ID | Status | Lokasi Aktual | Perubahan | Pengujian | Hasil | Batas Verifikasi`

| AUD ID | Status | Lokasi Aktual | Perubahan | Pengujian | Hasil | Batas Verifikasi |
|---|:---:|---|---|---|:---:|---|
| **AUD-01** | SELESAI | `src/context/AuthContext.tsx`, `firestore.rules`, `server.ts` | Hapus bypass email hardcoded & self-healing privilege; satu kali bootstrap terkontrol dengan email terverifikasi; akun demoted dilarang bootstrap ulang | `tsx src/security/accountManagement.test.ts` (TEST-01A/B, TEST-02A/B) | Lolos (PASS) | Diuji via unit/endpoint security simulation & Firestore rules evaluation |
| **AUD-02** | SELESAI | `server.ts` (/api/admin/create-test-user, set-user-claim) | Batasi peran ADMIN via allowlist ketat; blokir ADMIN memberikan atau membuat role OWNER baik via field role maupun capabilities | `tsx src/security/accountManagement.test.ts` (TEST-03A s/d TEST-03D) | Lolos (PASS) | Validasi payload HTTP 403 & integritas DB terverifikasi |
| **AUD-03** | TERVERIFIKASI | `firebase-applet-config.json`, `src/lib/firebase.ts` | Inspeksi kredensial client SDK Firebase (tanpa secret bocor di UI) | Code inspection & boots verification | Lolos | Menggunakan default Firestore db `default` |
| **AUD-04** | TERBLOKIR | `server.ts` | Verifikasi inisialisasi Firebase Admin SDK via Service Account | Endpoint `/api/admin/healthcheck-db` | Terblokir (Need SA Key) | Bergantung ketersediaan `FIREBASE_SERVICE_ACCOUNT_KEY` di env |
| **AUD-05** | SELESAI | `server/auth.ts`, `server.ts` | Helper autentikasi/otorisasi canonical server: verifikasi token ID, ambil status aktif, role, dan capability dari profil canonical Firestore; hapus fallback isActive=true; tolak kegagalan DB dengan 503 (fail-closed); role DB mengesampingkan klaim token lama | `tsx src/security/serverAuth.test.ts` (TEST-01 s/d TEST-06) | Lolos (PASS) | Diuji menggunakan mock/fixture Firestore & Auth terkontrol tanpa menyentuh produksi |
| **AUD-06** | SELESAI | `server/exportHandler.ts`, `server.ts` | Export source code dan endpoint admin memverifikasi checkRevoked=true, status aktif, dan role OWNER dari database canonical. Permintaan tidak berizin ditolak sebelum membaca filesystem. Endpoint revoke-user-claim mencabut refresh tokens dan claims | `tsx src/security/serverAuth.test.ts` (TEST-07A s/d TEST-07E) | Lolos (PASS) | Eksekusi diblokir pada level HTTP 401/403/503 sebelum interaksi disk |
| **AUD-07** | SELESAI | `firestore.rules`, `src/views/PipelineView.tsx`, `src/views/QuotationDetailView.tsx` | Wajibkan capability `canViewFinance` dan scope proyek/pembuat untuk membaca harga penawaran; sembunyikan nilai grandTotal dan unit price untuk non-finance; batasi pipeline unassigned ke pembuat dan OWNER/ADMIN | `tsx src/security/quotationPermissions.test.ts` (TEST 1) | Lolos (PASS) | Evaluasi Firestore rules & UI masking terverifikasi |
| **AUD-08** | SELESAI | `firestore.rules`, `src/views/PipelineView.tsx`, `src/views/QuotationDetailView.tsx` | Hapus celah status Draft bebas dihapus; wajibkan akun aktif, wewenang `canEditFinance`, scope proyek, dan pembuat dokumen (`createdBy == uid`); tolak VIEWER dan pengguna non-owner menghapus draft orang lain | `tsx src/security/quotationPermissions.test.ts` (TEST 2) | Lolos (PASS) | Penolakan di tingkat rules, API, dan UI action bar |
| **AUD-09** | SELESAI | `firestore.rules`, `src/security/rulesEvaluator.ts` | Wajibkan `isPrincipalActive()` pada `isOwnerOrAdmin()`, drawingTemplates, pdfTemplates, dan companySettings; inactive ADMIN ditolak | `tsx src/security/accountManagement.test.ts` (TEST-06A s/d TEST-06C) | Lolos (PASS) | Diuji menggunakan security evaluation engine & firestore rules |
| **AUD-10** | SELESAI | `firestore.rules`, `server.ts` | Larang ADMIN menghapus/menonaktifkan OWNER (`existing().get('role', '') != 'OWNER'`); terapkan proteksi Last Active Owner pada set-claim dan revoke-claim | `tsx src/security/accountManagement.test.ts` (TEST-04A s/d TEST-04C, TEST-05A/B) | Lolos (PASS) | Penolakan pada level security rules dan server-side endpoint |
| **AUD-11** | SELESAI | `firestore.rules`, `src/security/authorization.ts`, `src/security/rulesEvaluator.ts` | Penegakan `hasExplicitDeny`: explicit false mengalahkan role fallback untuk akun non-OWNER; akun inactive selalu ditolak; selaraskan kebijakan scope proyek | `tsx src/security/quotationPermissions.test.ts` (TEST 3 & TEST 4) | Lolos (PASS) | Kontrak otorisasi bersama konsisten di semua lapis |
| **AUD-12** | BELUM DIUJI | `src/context/FinanceContext.tsx`, `server.ts` | Sinkronisasi profil klien ke seluruh proyek terhubung | Trigger modification listener test | Belum Diuji | Memerlukan mutasi data klien simulasi |
| **AUD-13** | TERVERIFIKASI | `src/lib/validationSchemas.ts`, `src/views/QuotationDetailView.tsx` | Validasi skema penawaran: diskon non-negatif, pajak <= 100% | Unit test negative testing | Lolos (30 test checks pass) | Zod schema validation client & server side |
| **AUD-14** | BELUM DIUJI | `src/views/QuotationDetailView.tsx` | Tombol buat invoice uang muka otomatis saat penawaran disetujui | Flow integration test | Belum Diuji | Akan diuji pada alur quotation-to-invoice |
| **AUD-15** | SELESAI | `firestore.rules`, `src/security/userDirectory.ts`, `server.ts`, `ProjectListView.tsx` | Kunci akses get/list koleksi `/users` dari akun biasa; buat koleksi dan endpoint direktori PIC minimal `/userDirectory` & `/api/users/directory` yang bebas dari kapabilitas dan daftar proyek rahasia | `tsx src/security/quotationPermissions.test.ts` (TEST 5) | Lolos (PASS) | Profil keamanan terisolasi; pemilihan PIC tetap berfungsi penuh |
| **AUD-16** | SELESAI | `firestore.rules`, `src/context/AuthContext.tsx`, `server.ts` | Self-registration hanya mengizinkan role VIEWER, isActive=false, tanpa capability finansial atau penugasan proyek; sanitasi input tanpa spread | `tsx src/security/accountManagement.test.ts` (TEST-07A s/d TEST-07E) | Lolos (PASS) | Enforced via `isSafeSelfRegistration` dan explicit server field mapping |
| **AUD-17** | BELUM DIUJI | `src/views/project/vendor/VendorContractsTab.tsx` | Kontrak vendor tidak boleh melebihi alokasi budget proyek | Form boundary validation test | Belum Diuji | Diverifikasi saat pengujian modul vendor |
| **AUD-18** | TERVERIFIKASI | `src/views/project/vendor/VendorTermsTab.tsx` | Validasi termin vendor: persentase <= 100%, nominal > 0 | Unit test `negative-testing.ts` | Lolos | Penolakan nilai termin tidak rasional |
| **AUD-19** | BELUM DIUJI | `src/views/project/vendor/VendorHutangTab.tsx` | Perhitungan sisa hutang vendor (total tagihan - total dibayar) | Ledger balance calculation | Belum Diuji | Diverifikasi pada pelaporan hutang vendor |
| **AUD-20** | TERVERIFIKASI | `src/views/project/finance/ExpensesTab.tsx` | Validasi pencatatan pengeluaran operasional proyek | Zod validation suite | Lolos | Kategori harus valid, nominal harus positif |
| **AUD-21** | TERVERIFIKASI | `src/views/project/finance/CashflowTab.tsx` | Pencatatan arus kas masuk (IN) dan arus kas keluar (OUT) | Cashflow schema test | Lolos | Validasi tipe mutasi dan nominal |
| **AUD-22** | TERVERIFIKASI | `firestore.rules:341-347` | Aturan immutable log keuangan: `allow update, delete: if false;` | Rules security evaluator test | Lolos | Integritas jejak audit finansial terjaga |
| **AUD-23** | BELUM DIUJI | `src/views/project/finance/ProfitLossTab.tsx` | Rumus perhitungan laba rugi proyek real-time | Financial calculation verification | Belum Diuji | Diverifikasi pada pengujian laporan keuangan |
| **AUD-24** | BELUM DIUJI | `src/context/DrawingContext.tsx` | Relasi hierarki: Proyek -> Drawing Groups -> Drawing Items | Data structure mapping test | Belum Diuji | Diverifikasi pada Tahap 03 |
| **AUD-25** | BELUM DIUJI | `src/lib/drawingNumberUtils.ts` | Formula standarisasi nomor lembar gambar arsitektur/struktur | Pattern regex & formatter test | Belum Diuji | Diverifikasi pada Tahap 03 |
| **AUD-26** | BELUM DIUJI | `src/views/project/ProjectRevisionView.tsx` | Transisi status revisi dan histori approval berkas gambar | State machine test | Belum Diuji | Diverifikasi pada Tahap 03 |
| **AUD-27** | BELUM DIUJI | `src/views/project/ProjectListView.tsx` | Update masal status lembar gambar dan penugasan PIC | UI interaction test | Belum Diuji | Diverifikasi pada Tahap 03 |
| **AUD-28** | BELUM DIUJI | `src/views/project/ProjectTransmittalView.tsx` | Pencatatan distribusi transmittal dan verifikasi penerima | Form & PDF export test | Belum Diuji | Diverifikasi pada Tahap 03 |
| **AUD-29** | TERVERIFIKASI | `src/views/DrawingTemplatesView.tsx`, `firestore.rules` | Penggunaan template gambar master lintas proyek baru | Rules query check | Lolos | Read dapat diakses user login, create khusus Admin |
| **AUD-30** | TERVERIFIKASI | `src/context/DocumentContext.tsx`, `firestore.rules` | Fallback kop surat, identitas legal perusahaan, rekening bank | Graceful fallback code test | Lolos | Fallback default aktif jika koneksi rules transisi |
| **AUD-31** | BELUM DIUJI | `src/lib/pdfGenerator.ts` | Generator PDF surat penawaran harga (Quotation) | jsPDF generation test | Belum Diuji | Diverifikasi pada Tahap 04 |
| **AUD-32** | BELUM DIUJI | `src/lib/pdfGenerator.ts` | Generator PDF faktur penagihan (Invoice) resmi | jsPDF generation test | Belum Diuji | Diverifikasi pada Tahap 04 |
| **AUD-33** | BELUM DIUJI | `src/lib/pdfGenerator.ts` | Generator PDF dokumen transmittal berkas gambar | jsPDF generation test | Belum Diuji | Diverifikasi pada Tahap 04 |
| **AUD-34** | BELUM DIUJI | `server.ts:2009`, `src/views/SolarAuditView.tsx` | Deteksi audit kepatuhan gambar dan RAB via Upstage Solar | Mock API validation test | Belum Diuji | Proteksi zero-billing aktif; tidak ada call berbayar |
| **AUD-35** | TERVERIFIKASI | `src/ai/AIPolicyGuard.ts`, `src/engine/ai/aiSafetyTest.ts` | Enforce Zero-Billing: tolak model berbayar non-whitelist | Unit test suite (8 tests) | Lolos (8/8 pass) | Model berbayar ditolak; Gemini Flash diizinkan |
| **AUD-36** | TERVERIFIKASI | `src/ai/AIPolicyGuard.ts` | Filter pencegahan injeksi prompt (ignore previous instructions) | Prompt injection unit test | Lolos | Serangan injeksi instruksi diblokir |
| **AUD-37** | BELUM DIUJI | `server.ts:1185`, `src/lib/emailService.ts` | Pengiriman notifikasi email via SMTP dengan fallback simulator | API endpoint test | Belum Diuji | Mode simulator aktif otomatis jika SMTP belum diset |
| **AUD-38** | TERVERIFIKASI | `server.ts:1268-1282` | Penghapusan secret hardcoded pada cron reminder deadline | Request test tanpa secret | Lolos (HTTP 401 Unauthorized) | Memerlukan secret minimal 16 karakter |
| **AUD-39** | TERVERIFIKASI | `server.ts:2313`, `src/security/exportSecurityTest.ts` | Redaksi otomatis kredensial rahasia pada export source code | Test suite `exportSecurityTest.ts` | Lolos (100% redacted) | Token, password, dan URI ter-sensor rapi |
| **AUD-40** | TERVERIFIKASI | `src/index.css`, `scripts/audit-contrast.ts` | Rasio kontras teks >= 4.5:1 untuk WCAG 2.1 AA di kedua mode | Script evaluasi kontras | Lolos (14/14 token lolos) | Kontras teks memenuhi standar aksesibilitas |
| **AUD-41** | TERVERIFIKASI | `src/layouts/MainLayout.tsx` | Responsivitas sidebar macOS, backdrop mobile, dan tata letak | DOM & layout check | Lolos | Tidak ada overflow dan terpotong di mobile |
| **AUD-42** | TERVERIFIKASI | `vite.config.ts`, `server.ts` | Kelayakan build produksi frontend (Vite) dan backend (esbuild) | `npm run build` | Lolos (Exit Code 0) | Bundle frontend dan backend terverifikasi utuh |

---

## 3. Catatan Kendala Lingkungan & Batas Verifikasi

1. **Firebase Local Emulator (Java Dependency):**
   - Perintah `npm run test:security:emulator` memerlukan Java Runtime Environment (JRE). Di container ini Java tidak terinstal (`sh: 1: java: not found`), sehingga pengujian emulator lokal berstatus **TERBLOKIR**.
   - Penegakan aturan keamanan diverifikasi langsung melalui sinkronisasi Cloud Rules (`firestore.rules` terdeploy via RPC `fax.DeployRules`) dan evaluator in-memory (`rulesEvaluator.ts`).
2. **Kredensial Firebase Admin SDK:**
   - Kredensial service account belum diisi di environment (`FIREBASE_SERVICE_ACCOUNT_KEY` kosong). Operasi backend admin yang bergantung pada service account berjalan dalam mode pembatasan aman.
3. **Penyimpanan Snapshot / Checkpoint:**
   - Telah dibuat baseline commit Git pada branch `master`. Seluruh revisi pada Tahap 01 dapat dilacak secara terisolasi tanpa risiko kehilangan source code sebelumnya.
