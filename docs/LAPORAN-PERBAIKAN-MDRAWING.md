# Laporan perbaikan MDrawing — 26 Oktober 2026

Kode telah diperbaiki langsung pada salinan ZIP terbaru. Tidak ada deploy, perubahan database produksi, email nyata, panggilan AI berbayar, atau migrasi otomatis. Hasil ini adalah paket perbaikan dengan bukti uji lokal; **belum merupakan persetujuan rilis produksi**. Beberapa kebutuhan masih parsial atau memerlukan operator/staging, terutama Storage, rekonsiliasi data lama, provider AI/SMTP dan pengujian browser/beban.

## Sumber dan metode

Masukan: D:/01. AI/MDrawing/mdrawing.zip; ukuran 2.830.602 byte; SHA-256 1A533F4BDF063A1DCB7793F46193798BCB394EDF750E3406B565809DC066F0BE. Berkas asli tidak ditimpa. Tahap 1–3 masukan dipertahankan sebagai fondasi, lalu diselaraskan dengan command baru. Instruksi atau klaim dalam dokumen input diperlakukan sebagai data, bukan bukti PASS. Matriks memakai ID asli 42 temuan dari audit terdahulu, bukan penomoran keliru pada progres input.

Inspeksi kode, typecheck, build Vite/esbuild/Functions, tes helper lokal, Firestore emulator 1.19.8, Storage emulator 1.1.3, dan HTTP Express aktual. Lingkungan Node 24.21.0/npm 11.19.0, Java 21. Cloud Functions target Node 22 hanya dikompilasi lokal. Integrasi auth memakai verifier token tiruan dengan profil/rules/transaction emulator nyata; bukan verifikasi login Firebase live. Emulator memakai proyek demo-mdrawing-repair dan database default emulator, sehingga perilaku named database/cloud/index/IAM tetap perlu staging.

## Perubahan utama

- Command server menjadi writer finansial, quotation dan proyek. Izin aktif/canonical, scope, allowlist input, safe integer IDR, parent integrity, idempotensi, batas termin/kontrak, penomoran dan audit transaksi diterapkan. Client tidak dapat menulis saldo langsung.
- Pembayaran dimulai Draft, maker tidak dapat menyetujui sendiri, checker memerlukan izin; invoice Void/Draft/Cancelled ditolak. Reversal beralasan menghitung ulang saldo. Tagihan draft diubah melalui arsip/buat ulang agar reservasi tetap konsisten. Kas manual memerlukan izin approval dan jejak audit; pembatalan memerlukan izin void/alasan.
- Aktivasi proyek mengecek quote AGREED dan preflight server. Setup besar memiliki job, payload tersimpan, checkpoint, ID stabil dan tidak menimpa gambar yang sudah berprogress saat retry.
- Laporan memakai basis Confirmed/Paid/Approved yang dibedakan dari proyeksi; arus kas manual ikut dihitung. Dokumen memakai profil perusahaan dan validasi rekening/klien; tombol transmittal memiliki handler nyata.
- AI memakai kunci server, guard/scope sebelum pembacaan DB/provider dan reservasi biaya/kuota atomik. Email hanya ke PIC proyek tersimpan, HTML di-escape, dedup outbox dan hasil SMTP jujur.
- Notifikasi berbasis kondisi overdue. SheetJS 0.20.3 dan parser worker dibatasi. Views lazy, deep link produksi diperbaiki, source/bundle server dan berkas tersembunyi ditolak dari aset publik. Batch template besar dipecah dan hasil parsial dilaporkan.

## Bukti pengujian dan batasnya

| Kelompok | Bukti | Batas |
|---|---|---|
| Gate kode lokal | repair-release-local.log: typecheck, suite baseline, 4 PDF, 1 batch, build web/server/Functions, 17 HTTP probes | Tidak membuktikan readiness hosting, UI penuh atau provider live |
| Command/rules integrasi | repair-integration-final.log: 19 skenario, transaksi Firestore asli di emulator | Auth token verifier tiruan; database emulator dan data sintetis |
| Storage | repair-storage-tests.log: 7 skenario deny nyata | Membuktikan blokir, bukan fitur upload siap |
| Dependensi root produksi | repair-npm-audit-production.json: 0 advisori | Snapshot waktu audit, bukan jaminan bebas kerentanan |
| Functions | repair-functions-audit-final.json: 0 advisori; compile berhasil | Belum deploy/v2 event delivery/IAM test |
| Tooling dev | repair-npm-audit-final.json: 5 moderate, 0 high/critical | Masih terbuka pada Firebase CLI, pubsub/OpenTelemetry, gaxios/uuid; tidak memaksa major override |

Tes race sempat timeout 5 detik, kemudian diberi timeout 30 detik agar retry transaksi emulator diukur dengan benar; satu ekspektasi pesan penolakan disesuaikan dengan guard Draft. Build Functions sempat gagal strict-null dan esModuleInterop lalu diperbaiki. HTTP smoke menemukan /.env mengembalikan SPA HTML 200 (bukan isi secret), lalu handler diperbaiki menjadi 404. Log final adalah dasar hasil akhir, bukan kegagalan awal yang sudah diperbaiki. MetadataLookupWarning dari Admin SDK emulator adalah pencarian kredensial ambient; pengujian tetap diarahkan eksplisit ke loopback/demo dan tidak membaca produksi.

## Status tahap 04–20

| Tahap | Hasil dan batas |
|---|---|
| Tahap 04 — Database dan isolasi metadata proyek | Akses Storage dimitigasi deny; belum menyediakan upload terotorisasi. |
| Tahap 05 — Keamanan Solar/Gemini, kunci dan biaya | Guard/kuota diuji upstream tiruan; provider/billing nyata belum diuji. |
| Tahap 06 — Domain uang, quantity dan validasi | Quantity, safe money dan validasi server; kebijakan pajak bisnis perlu review. |
| Tahap 07 — Command pembayaran klien dan vendor | Command Draft/checker/reversal/race diuji emulator. |
| Tahap 08 — Termin, invoice dan bill yang idempotent | Retry, reservasi termin/kontrak dan penomoran server diuji. |
| Tahap 09 — Audit atomik, rekonsiliasi dan penghapusan aman | Finance audit atomik; audit seluruh non-finance dan rekonsiliasi historis belum lengkap. |
| Tahap 10 — Query, listener dan pemulihan error | Perbaikan query/listener diterapkan; seluruh panel browser belum E2E. |
| Tahap 11 — Workflow, resume wizard dan setup besar | Gate/resume/job diuji server; klik wizard browser belum E2E. |
| Tahap 12 — Satu definisi laporan dan agregasi keuangan | Model laporan bersama diuji fixture; seluruh PDF/periode belum divalidasi finance. |
| Tahap 13 — Unduh dokumen dan PDF resmi | Handler dokumen diperbaiki dan empat PDF unit tests; QA visual belum lengkap. |
| Tahap 14 — AI action dan audit operasi nyata | Command action nyata tersedia; tool provider dan UI konfirmasi belum end-to-end. |
| Tahap 15 — Hilangkan klaim audit dan PASS palsu | Klaim diagnostik dipersempit dan laporan input dilabeli historis. |
| Tahap 16 — Notifikasi yang berasal dari kondisi nyata | Overdue nyata dan tanggal diuji; dismiss masih lokal per browser. |
| Tahap 17 — Email: otorisasi, deduplikasi dan hasil jujur | Outbox/stub/otorisasi diuji; SMTP delivered nyata belum diuji. |
| Tahap 18 — Dependensi dan impor spreadsheet | Runtime audit 0; CLI dev masih lima moderate dan impor browser belum E2E. |
| Tahap 19 — Production routing dan kinerja | 17 HTTP probes; kinerja produksi dan ukuran bundle belum lulus uji beban. |
| Tahap 20 — Release gate dan verifikasi seluruh temuan | Gate kode dan bukti tersedia; keputusan rilis produksi TERTAHAN. |

## Matriks 42 temuan

Lokasi berikut merujuk berkas hasil perbaikan dengan nomor baris saat pengemasan. Status EMULATOR/HTTP/UNIT hanya berlaku pada bukti yang dijelaskan, bukan seluruh aplikasi. CSV/JSON menyediakan bukti serta tindak lanjut yang lebih mudah difilter.

| ID / risiko awal | Temuan | Status bukti | Lokasi baru | Perbaikan / risiko sisa |
|---|---|---|---|---|
| AUD-01 / KRITIS | Email bootstrap melewati penonaktifan dan otorisasi biasa | UNIT+KODE | src/context/AuthContext.tsx:134 | Bypass email permanen dan self-heal OWNER dihapus pada baseline 1–3; profil canonical aktif menjadi sumber izin. **Sisa:** Uji sesi Firebase nyata: inactive, demoted dan revoked di staging. |
| AUD-02 / KRITIS | ADMIN dapat mengubah akun menjadi OWNER melalui create-test-user | UNIT+KODE | server.ts:905 | Allowlist peran dan penolakan OWNER untuk ADMIN pada pengelolaan akun. **Sisa:** Uji HTTP akun staging, termasuk payload bertingkat dan perubahan diri sendiri. |
| AUD-03 / KRITIS | Solar dapat dipanggil anonim dan mengirim data seluruh proyek ke AI | EMULATOR+HTTP | server/repairRoutes.ts:47 | Guard seluruh Solar/Gemini, scope server, konteks terbatas, budget atomik. **Sisa:** Provider nyata, model, billing akun dan relevansi jawaban belum diuji. |
| AUD-04 / KRITIS | Database mengizinkan pemalsuan transaksi dan saldo keuangan | EMULATOR | server/financeCommands.ts:62 | Browser tidak dapat menulis sembilan koleksi finance; command server menghitung saldo dan audit satu transaksi. **Sisa:** Migrasikan data lama dan hentikan seluruh writer finansial lama sebelum cutover. |
| AUD-05 / TINGGI | API mengutamakan role token lama dan dapat fail open | UNIT+KODE | server/auth.ts:133 | Peran dan status dari profil canonical; token lama tidak menjadi sumber kewenangan. **Sisa:** Uji pencabutan Firebase Auth nyata serta timeout staging. |
| AUD-06 / TINGGI | Export source code tidak memeriksa status aktif dan demotion | UNIT+HTTP | server/exportHandler.ts:191 | Ekspor memverifikasi akun aktif sebelum membaca berkas. **Sisa:** Ekspor OWNER nyata dan peninjauan isi arsip staging masih diperlukan. |
| AUD-07 / TINGGI | Harga penawaran dapat dibaca tanpa izin finance | UNIT+KODE | firestore.rules:454 | Baca quotation membutuhkan finance dan scope. UI memakai endpoint scoped dan helper izin. **Sisa:** Matriks semua capability dan seluruh UI per role belum E2E. |
| AUD-08 / TINGGI | VIEWER dapat menghapus Draft quotation proyek lain | EMULATOR+UNIT | firestore.rules:462 | Seluruh write quotation browser ditutup; hapus menjadi arsip Draft melalui server. **Sisa:** Validasi browser VIEWER terhadap tindakan hapus pada staging. |
| AUD-09 / TINGGI | ADMIN inactive masih dapat mengubah konfigurasi dan template | UNIT+KODE | firestore.rules:536 | Akun nonaktif ditolak pada aturan pengaturan/template dan server auth. **Sisa:** Uji update template/settings dengan ADMIN inactive nyata. |
| AUD-10 / TINGGI | ADMIN dapat menghapus akun OWNER | UNIT+KODE | server.ts:1082 | Perlindungan target OWNER dan last-owner tersedia pada baseline 1–3. **Sisa:** Uji perlombaan pengelolaan owner dan pemulihan akun di staging. |
| AUD-11 / TINGGI | Explicit deny capability tidak konsisten antarlapisan | PARSIAL | src/security/authorization.ts:86 | Server command memakai hasCapability dengan explicit false dan profil aktif; rules deny write finance. **Sisa:** Kesetaraan seluruh capability di UI/API/rules belum diuji lengkap. |
| AUD-12 / TINGGI | Dokumen proyek dan metadata dokumen membocorkan data finansial | EMULATOR+KODE | server/projectService.ts:5 | Keuangan baru dipisah projectFinancials; server redaksi proyek; riwayat dokumen dibatasi tipe dan proyek. **Sisa:** Audit dokumen lama dan metadata generatedDocuments; migrasi finansial lama belum dijalankan. |
| AUD-13 / TINGGI | Drawing dapat dipindah ke proyek tanpa izin target | EMULATOR | firestore.rules:371 | ProjectId drawing/group/revision immutable; status dan progress dibatasi. **Sisa:** Uji semua tipe drawing/revision dan browser editing lintas panel. |
| AUD-14 / TINGGI | Audit trail dapat dipalsukan dan tidak wajib atomik | PARSIAL | server/financeCommands.ts:186 | Finance dan AI status menulis audit serta receipt atomik dengan actor server; audit browser finance/AI ditutup. **Sisa:** Tidak semua perubahan non-finansial memakai audit wajib atomik; log aktivitas bukan bukti menyeluruh. |
| AUD-15 / SEDANG | Seluruh profil pengguna dapat didaftar oleh akun aktif | UNIT+KODE | src/security/userDirectory.ts:73 | Users hanya diri sendiri/admin; direktori publik minimal dan API tersanitasi. **Sisa:** Verifikasi isi direktori serta trigger v2 setelah deployment. |
| AUD-16 / SEDANG | Profil self-registration dapat menyimpan capability istimewa | UNIT+KODE | firestore.rules:274 | Registrasi mandiri hanya VIEWER inactive tanpa capability atau penugasan. **Sisa:** Uji pendaftaran Firebase nyata dan payload asing dengan emulator/staging. |
| AUD-17 / TINGGI | Schema keuangan menerima record tidak lengkap dan rupiah pecahan | EMULATOR+UNIT | server/financeCommands.ts:41 | Rupiah safe integer non-negatif; quantity pecahan dipertahankan; parent proyek/kontrak/party dan persentase divalidasi. **Sisa:** Rekonsiliasi skema data lama; validasi bisnis tambahan sesuai kebijakan pajak/termin organisasi. |
| AUD-18 / TINGGI | Rekalkulasi trigger dapat menimpa saldo baru dengan snapshot lama | EMULATOR+KODE | functions/src/index.ts:8 | Hapus writer finansial asinkron dari source; saldo dihitung transaksi server dengan pembacaan konsisten. **Sisa:** Trigger deployed lama tidak dapat dipensiunkan tanpa deployment operator. |
| AUD-19 / TINGGI | Identitas database client/server berbeda dari Functions dan Storage | MITIGASI/BLOKIR | storage.rules:15 | Client/server/Functions/firebase.json konsisten named default; Storage langsung ditutup karena cross-service hanya (default). **Sisa:** Upload/lampiran Storage BELUM berfungsi; perlu proxy server atau migrasi terkontrol, lalu uji staging. |
| AUD-20 / TINGGI | Query utama tidak sesuai aturan scope dan dapat membuat panel kosong | PARSIAL | src/context/ExpenseContext.tsx:44 | Daftar proyek server scoped; listener finance menunggu akses proyek; expense/cashflow memecah seluruh ID per 30 tanpa memotong sisanya. **Sisa:** Belum browser E2E semua panel/role; indeks produksi perlu deploy dan verifikasi. |
| AUD-21 / TINGGI | Pembuatan termin gagal karena undefined pada payload Firestore | EMULATOR | server/financeCommands.ts:26 | Payload undefined dibersihkan sebelum Firestore; field command memakai allowlist. **Sisa:** Uji formulir termin browser dan data legacy. |
| AUD-22 / TINGGI | Gate workflow yang dites tidak terhubung ke jalur aktivasi nyata | EMULATOR | server/projectService.ts:3 | Aktivasi resmi API mengecek penawaran AGREED dan preflight dalam transaksi; setup belum selesai memblokir aktivasi. **Sisa:** Matriks preflight lengkap dan workflow operasional setelah ACTIVE belum E2E. |
| AUD-23 / TINGGI | Tombol lanjut setup mengarah ke wizard yang tidak bisa melanjutkan proyek | EMULATOR+KODE | src/views/NewProjectWizardView.tsx:72 | Resume memakai ID route/stabil; backend menyimpan payload setup/job dan melanjutkan item tanpa menimpa progress. **Sisa:** Alur klik wizard dan restart browser belum diuji; batch template di luar setup belum semua resumable. |
| AUD-24 / TINGGI | Perhitungan quotation membulatkan volume pekerjaan sebelum dikali | UNIT | src/engine/financial/financialEngine.ts:103 | Quantity dipertahankan sebagai pecahan; pembulatan hanya total rupiah per baris. **Sisa:** Aturan presisi volume sangat besar dan kebijakan pembulatan pajak perlu persetujuan finance. |
| AUD-25 / TINGGI | Pencatatan pembayaran langsung Confirmed meski UI menyebut Draft | EMULATOR | server/financeCommands.ts:98 | Pembayaran baru Draft; konfirmasi membutuhkan checker berbeda dengan izin approve. **Sisa:** Uji UI dua akun dan mekanisme persetujuan internal. |
| AUD-26 / TINGGI | Jalur pembayaran normal dapat membayar invoice Void | EMULATOR | server/financeCommands.ts:157 | Pembayaran ditolak pada Draft/Void/Cancelled dan parent proyek lain. **Sisa:** Periksa data lama yang pernah membayar invoice batal sebelum rilis. |
| AUD-27 / TINGGI | Angka ringkasan, cashflow dan dokumen tidak memakai definisi transaksi yang sama | PARSIAL | src/engine/financial/reportModel.ts:2 | Basis bersama: pembayaran Confirmed, biaya Paid untuk kas, Approved/Paid untuk biaya akrual, transaksi manual dan proyeksi dibedakan. **Sisa:** Seluruh PDF/rekap periode belum dibandingkan visual dengan buku besar nyata; jangan anggap proyeksi sebagai laba terealisasi. |
| AUD-28 / TINGGI | Invoice/bill dan akumulasi termin ditulis terpisah, tanpa kontrol duplikasi | EMULATOR | server/financeCommands.ts:138 | Invoice, reservasi termin, batas kontrak, nomor server, receipt dan audit ditulis atomik; key berbeda payload ditolak. **Sisa:** Migrasi counter/nomor invoice lama dan rekonsiliasi duplikasi historis belum dijalankan. |
| AUD-29 / TINGGI | Penghapusan hard delete meninggalkan relasi dan histori finansial | PARSIAL | server/projectService.ts:32 | Proyek/master diarsipkan; pembayaran posted immutable dan pembatalan beralasan; kontrak ber-tagihan tidak dapat dihapus/diubah. **Sisa:** Tidak semua objek non-finansial memakai soft delete; retensi/restore master dan audit di staging. |
| AUD-30 / SEDANG | Tombol Unduh Transmittal di panel Dokumen tidak melakukan apa pun | KODE/BUILD | src/views/project/ProjectDocumentsWorkspace.tsx:5 | Tombol Unduh Transmittal kini memanggil generator aktual dengan proyek dan profil perusahaan. **Sisa:** Uji hasil download serta data item transmittal di staging. |
| AUD-31 / SEDANG | PDF resmi memakai identitas hardcoded dan menerima klien tidak lengkap | UNIT+KODE | src/lib/brandedPdf.ts:15 | Generator memakai profil perusahaan; rekening harus lengkap; klien quotation wajib lengkap; receipt belum Confirmed ditolak. **Sisa:** Periksa layout, logo, bank, tanda tangan dan semua jenis PDF multi-halaman secara visual. |
| AUD-32 / SEDANG | AI action/konfirmasi belum terhubung ke operasi nyata | EMULATOR+KODE | server/repairRoutes.ts:24 | Konfirmasi AI diarahkan command status nyata dengan version check, scope, PIC dan audit; no-op status bukan klaim menyimpan. **Sisa:** Respons tool dari provider dan konfirmasi UI end-to-end belum diuji; provider Solar belum mengeluarkan structured tool actions. |
| AUD-33 / TINGGI | Tombol audit dan laporan bawaan memberi jaminan keamanan melebihi pengujiannya | KODE/DOKUMEN | src/views/SettingsView.tsx:1 | Tombol diagnostik dilabeli simulasi/pola; status export tidak mengaku production-tested; laporan input diberi banner historis. **Sisa:** Audit manual semua label lain dan validasi release staging masih wajib. |
| AUD-34 / SEDANG | Notifikasi bersifat generik dan tandai selesai hanya dalam memori | UNIT+KODE | src/engine/notificationEngine.ts:2 | Notifikasi berasal overdue drawing/invoice/bill; dismiss tersimpan per user/browser. **Sisa:** Belum sinkron lintas perangkat; polling tiap menit belum diuji beban. |
| AUD-35 / SEDANG | Status kirim email dapat menyesatkan pengguna | EMULATOR/STUB | server/emailOutbox.ts:24 | Simulator eksplisit non-produksi; accepted bukan delivered; UNKNOWN ditahan tanpa retry otomatis. **Sisa:** Uji SMTP nyata, bounce, delivered dan rekonsiliasi operator. |
| AUD-36 / TINGGI | Pengiriman email tidak dibatasi ke proyek/penerima yang diizinkan | EMULATOR+HTTP | server/emailOutbox.ts:5 | Hanya role berizin/proyek terscope, tujuan PIC tersimpan, HTML di-escape; outbox dedup dan kuota project/day. **Sisa:** Scheduler dan batas global organisasi/provider belum diuji/dikonfigurasi. |
| AUD-37 / TINGGI | Kunci AI disimpan di browser dan pembatasan biaya hanya sebagian | EMULATOR+KODE | server/repairRoutes.ts:71 | Kunci tidak disimpan browser; input key ditolak; reservasi token/biaya organisasi dan per-user atomik. **Sisa:** Harga plafon operator, limit provider, model nyata, audit pemakaian aktual dan invoice provider belum direkonsiliasi. |
| AUD-38 / TINGGI | Dependensi impor spreadsheet memiliki advisori keamanan aktif | AUDIT+KODE | src/workers/spreadsheet.worker.ts:4 | SheetJS 0.20.3 resmi dipin; parser worker 10MB/20 sheet/10000 row/15 detik. Dependensi produksi dan Functions diperbarui. **Sisa:** Lima moderate pada Firebase CLI dev masih terbuka; file Excel korup/zip-bomb dan worker browser belum E2E. |
| AUD-39 / SEDANG | Refresh deep link gagal pada production catch-all Express | HTTP | server.ts:1730 | Express 4 catch-all valid, deep link HTML, API/aset/source/berkas tersembunyi 404; bundle server tidak publik. **Sisa:** Verifikasi reverse proxy, HTTPS dan cache hosting staging. |
| AUD-40 / SEDANG | Beberapa batch besar belum dipotong meski laporan mengklaim seluruhnya aman | UNIT+EMULATOR | src/lib/chunkedWriteBatch.ts:3 | Batch template dipecah 200, laporan partial commit eksplisit; setup proyek pakai job/checkpoint dan stable ID. **Sisa:** Operasi template umum belum semuanya memiliki job resumable/idempotensi penuh setelah kegagalan. |
| AUD-41 / SEDANG | Frontend dan listener belum memiliki bukti kestabilan pada skala produksi | BELUM TERBUKTI | src/App.tsx:1 | Lazy view dan parsing worker; reset data akun pada beberapa provider; batas daftar eksplisit. **Sisa:** Belum load test, memory profiling, perangkat rendah, jaringan lambat atau browser E2E skala produksi. |
| AUD-42 / SEDANG | Paket belum menyediakan release gate dan konfigurasi operasi yang dapat direproduksi | PARSIAL | package.json:15 | Lockfile npm, env example, indeks, gate lokal/emulator, runbook dan matriks bukti disediakan. **Sisa:** Full release approval, staging, deploy, rollback/restore drill dan CI deployment belum dilakukan. |

## Cakupan tombol dan fitur

Inventaris audit terdahulu memuat 502 deklarasi kontrol UI. Perbaikan ini menelusuri jalur berisiko dan memperbaiki handler yang diketahui, termasuk Unduh Transmittal, konfirmasi AI, diagnostik, kirim pengingat, resume wizard, status pembayaran, arsip master dan ekspor. Tidak ada rekaman uji klik browser untuk seluruh 502 kontrol; angka tersebut bukan jumlah tombol yang telah lulus. Build/typecheck atau keberadaan handler tidak otomatis berarti fitur telah diuji end-to-end. Tombol status AI hanya memuat konfigurasi server, tidak mengaku menguji koneksi/provider.

## Syarat sebelum rilis

1. Selesaikan desain Storage/proxy atau migrasi; akses langsung saat ini sengaja mati.
2. Backup dan rekonsiliasi data lama, lalu pensiunkan writer/trigger finance lama sebelum command baru menulis. Jangan menghapus audit/receipt untuk memaksa retry.
3. Verifikasi IAM server, database named default, trigger v2, indeks dan seluruh peran di staging. Backend Express wajib tersedia; aplikasi tidak cukup di-host statis.
4. Verifikasi perusahaan/rekening/PDF dengan finance. Uji maker/checker/reversal, resume dan transaksi bersamaan melalui browser.
5. Konfigurasi dan buktikan provider AI/biaya serta SMTP/delivery tanpa klaim zero-billing otomatis. Tinjau download token Storage publik yang telah dibagikan.
6. Uji beban, perangkat rendah, logout/perpindahan akun, paging dan seluruh kontrol kritis. Bundle utama sekitar 1.3MB minified dan listener besar masih risiko performa.
7. Tinjau lima moderate dependency dev, uji restore/rollback dan kumpulkan bukti staging untuk keputusan pemilik aplikasi.

Rincian langkah di DEPLOYMENT.md. Matriks risiko awal tidak diturunkan otomatis menjadi aman; residual yang belum diuji tetap terbuka.
