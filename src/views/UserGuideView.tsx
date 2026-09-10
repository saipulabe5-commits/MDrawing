import React, { useState, useMemo } from 'react';
import { Card, Input, Badge, Button } from '../components/ui';
import { 
  BookOpen, Search, Layers, FileText, DollarSign, 
  Users, ShieldCheck, Settings, ChevronDown, ChevronRight, 
  CheckCircle, HelpCircle, ExternalLink, Bookmark
} from 'lucide-react';

interface GuideModule {
  id: string;
  category: 'PROYEK' | 'GAMBAR' | 'KEUANGAN' | 'VENDOR' | 'KEAMANAN' | 'PENGATURAN';
  title: string;
  summary: string;
  steps: string[];
  tips: string[];
  relatedRoles: string[];
}

const GUIDE_DATA: GuideModule[] = [
  {
    id: 'guide-project',
    category: 'PROYEK',
    title: '1. Manajemen Proyek & Klien',
    summary: 'Membuat proyek baru, mengatur profil klien, estimasi anggaran, dan timeline pelaksanaan.',
    steps: [
      'Pilih menu "Proyek" pada bilah navigasi kiri.',
      'Klik tombol "Proyek Baru" di pojok kanan atas.',
      'Isi nama proyek, kode penomoran proyek, pilih atau buat klien baru, tentukan nilai kontrak (estimasi/fixed), dan tanggal target penyelesaian.',
      'Simpan proyek. Status awal adalah "Planning", dan dapat dialihkan ke "Active", "On Hold", atau "Completed".',
    ],
    tips: [
      'Menetapkan nilai kontrak dan tanggal mulai yang akurat akan otomatis mengkalkulasi burn rate dan persentase realisasi finansial.',
      'Data klien yang lengkap (email dan nomor telepon) akan otomatis tertera pada kop surat Quotation dan Invoice.',
    ],
    relatedRoles: ['OWNER', 'ADMIN', 'PROJECT_LEADER'],
  },
  {
    id: 'guide-drawings',
    category: 'GAMBAR',
    title: '2. Register Gambar Kerja, Bulk Update & Matriks Revisi',
    summary: 'Pengelolaan daftar gambar arsitektur, struktur, MEP, impor/ekspor Excel, aksi massal, dan matriks revisi.',
    steps: [
      'Masuk ke halaman rincian Proyek dan klik tab "Gambar Kerja".',
      'Kelola grup gambar dengan tombol "Buat Grup", atau terapkan susunan standar melalui tombol "Terapkan Template".',
      'Tambah gambar secara manual atau unggah massal melalui tombol "Impor Excel" dengan modal preview cerdas.',
      'Gunakan fitur "Bulk Update": centang checkbox pada baris gambar untuk memunculkan Floating Action Dock di bagian bawah layar guna mengubah Status Massal, mengubah PIC Massal, atau Hapus Massal.',
      'Klik tombol "Edit" pada baris gambar dan isi kolom "Catatan Revisi" untuk merekam perubahan desain secara permanen.',
      'Buka tab "Revisi" untuk mengakses "Matriks Revisi" (menampilkan sebaran Rev 0, Rev 1..Rev N per item, kartu KPI, dan item paling sering direvisi) serta arsip log audit.',
      'Kirim pengingat pengerjaan kepada PIC melalui tombol amplop email atau dari tab "Deadline".',
    ],
    tips: [
      'Anggota peran TEAM hanya dapat mengedit status progress dan catatan pada gambar yang ditugaskan kepada mereka.',
      'Pengubahan status massal otomatis menyelaraskan persentase progress (Belum Mulai: 0%, Pengerjaan: 50%, Review: 80%, Selesai: 100%).',
      'Gunakan tombol "Simpan Sbg Template" untuk menjadikan susunan gambar proyek saat ini sebagai template master baru.',
    ],
    relatedRoles: ['OWNER', 'ADMIN', 'PROJECT_LEADER', 'TEAM', 'VIEWER'],
  },
  {
    id: 'guide-transmittal',
    category: 'GAMBAR',
    title: '3. Surat Pengantar Gambar (Drawing Transmittal)',
    summary: 'Penerbitan surat transmittal resmi ke klien, konsultan pengawas, atau kontraktor dengan nomor TRM otomatis.',
    steps: [
      'Pada halaman rincian proyek, buka tab "Transmittal" lalu klik tombol "Buat Transmittal Baru".',
      'Pilih kategori penerima ("Klien", "Konsultan Pengawas", atau "Kontraktor") dan masukkan nama penerima resmi.',
      'Pilih tujuan pengiriman gambar: "For Review", "For Approval", "For Construction (IFC)", atau "As-Built".',
      'Pilih berkas gambar kerja yang disertakan dengan mencentang checkbox pada tabel pemilihan berkas (snapshot nomor revisi tersimpan otomatis).',
      'Tambahkan catatan atau instruksi pengantar, lalu klik "Terbitkan Transmittal".',
      'Klik tombol "Unduh PDF" pada kartu transmittal untuk mencetak surat pengantar resmi berstempel dan berkop surat PT. Asa Perdana Mandiri.',
    ],
    tips: [
      'Setiap transmittal memperoleh nomor registrasi kanonik unik (format: TRM/YYYY/MM/XXX) yang dikelola melalui atomic counter di Firestore.',
      'Hak pembuatan dan penghapusan transmittal dikontrol oleh kapabilitas canManageTransmittal (Owner, Admin, dan Project Leader).',
      'Semua berkas transmittal yang diterbitkan tercatat dalam arsip histori dokumen proyek.',
    ],
    relatedRoles: ['OWNER', 'ADMIN', 'PROJECT_LEADER'],
  },
  {
    id: 'guide-quotation',
    category: 'KEUANGAN',
    title: '4. Penawaran Harga (Quotation) & Termin',
    summary: 'Penyusunan penawaran harga profesional dengan rincian item pekerjaan, PPN, dan termin pembayaran.',
    steps: [
      'Masuk ke menu "Keuangan Proyek" lalu pilih tab "Quotation".',
      'Klik "Buat Quotation", isi nomor penawaran otomatis dan deskripsi pekerjaan.',
      'Tambahkan baris rincian (uraian, volume, satuan, dan harga satuan). PPN 11% dan diskon dihitung otomatis.',
      'Tentukan Milestone / Termin Pembayaran (misal: DP 30%, Progress 50% sebesar 40%, Pelunasan 30%).',
      'Cetak atau bagikan berkas Quotation dalam format PDF resmi bergaya macOS modern.',
    ],
    tips: [
      'Termin pembayaran yang disetujui di Quotation akan menjadi acuan dasar pembuatan Invoice penagihan secara otomatis.',
    ],
    relatedRoles: ['OWNER', 'ADMIN', 'FINANCE'],
  },
  {
    id: 'guide-invoice',
    category: 'KEUANGAN',
    title: '5. Penagihan (Invoice) & Pembayaran Klien',
    summary: 'Penerbitan tagihan termin kepada klien dan pencatatan riwayat transfer pembayaran.',
    steps: [
      'Buka tab "Invoice" pada modul Keuangan.',
      'Klik "Buat Invoice dari Termin", pilih termin yang jatuh tempo.',
      'Sistem akan otomatis mengisi nomor invoice (INV/YYYY/MM/XXX), tanggal jatuh tempo, serta rekening bank PT. Asa Perdana Mandiri.',
      'Ketika klien melakukan transfer, klik "Catat Pembayaran", masukkan nominal, metode pembayaran, nomor referensi transfer, dan unggah bukti transfer.',
      'Status invoice akan otomatis tersinkronisasi menjadi "Partial Paid" atau "Paid" secara server-side trigger.',
    ],
    tips: [
      'Seluruh perubahan nilai atau status invoice tercatat secara permanen di Financial Audit Log dengan diff oldValue/newValue.',
    ],
    relatedRoles: ['OWNER', 'ADMIN', 'FINANCE'],
  },
  {
    id: 'guide-vendor',
    category: 'VENDOR',
    title: '6. Manajemen Vendor, Subkon & Vendor Bills',
    summary: 'Pengadaan jasa pihak ketiga (struktur, MEP, render, surveyor), SPK, dan pencatatan tagihan vendor.',
    steps: [
      'Pilih menu "Vendor & Subkon" pada navigasi.',
      'Tambahkan profil vendor baru dengan spesialisasi keahlian dan nomor kontak.',
      'Tautkan vendor ke proyek spesifik (Project Vendor Contract) beserta nilai SPK yang disepakati.',
      'Ketika vendor mengirimkan tagihan, klik "Tambah Tagihan Vendor (Vendor Bill)" dan tentukan tanggal jatuh tempo.',
      'Lakukan pelunasan dengan mencatat "Vendor Payment" yang otomatis memotong saldo tagihan dan masuk ke arus kas keluar.',
    ],
    tips: [
      'Sistem akan memvalidasi agar total pembayaran ke vendor tidak melebihi nilai kontrak SPK tanpa persetujuan Owner.',
    ],
    relatedRoles: ['OWNER', 'ADMIN', 'FINANCE'],
  },
  {
    id: 'guide-cashflow',
    category: 'KEUANGAN',
    title: '7. Arus Kas (Cashflow) & Beban Proyek',
    summary: 'Pemantauan aliran kas masuk dan keluar, laba rugi per proyek, dan pengeluaran operasional.',
    steps: [
      'Buka menu "Arus Kas & Laba Rugi".',
      'Lihat ringkasan Cashflow Masuk (dari Pembayaran Klien) dan Keluar (ke Vendor dan Beban Proyek).',
      'Untuk mencatat pengeluaran harian proyek (transport, cetak gambar, ATK), gunakan tab "Pengeluaran Proyek".',
      'Gunakan filter rentang tanggal dan tombol "Ekspor Laporan Keuangan" untuk mengunduh rekap Excel atau PDF.',
    ],
    tips: [
      'Pemisahan kategori kas yang disiplin memberikan kalkulasi Margin Keuntungan Bersih proyek secara realtime dan transparan.',
    ],
    relatedRoles: ['OWNER', 'ADMIN', 'FINANCE'],
  },
  {
    id: 'guide-security',
    category: 'KEAMANAN',
    title: '8. Hak Akses & Ketetapan Anti-Eskalasi',
    summary: 'Matriks 6 peran kanonik, 10 granular capabilities, dan perlindungan integritas sistem.',
    steps: [
      'Masuk ke menu "Pengaturan" lalu pilih tab "Hak Akses & Pengguna".',
      'Owner dapat meninjau daftar pengguna terdaftar, status keaktifan akun (isActive), dan menetapkan peran kanonik.',
      'Peran yang didukung: OWNER (akses penuh mutlak), ADMIN (pengelolaan operasional & tim), PROJECT_LEADER (manajemen proyek teknis), TEAM (drafter/eksekutor gambar), FINANCE (keuangan proyek), dan VIEWER (hanya baca).',
      'Uji ketahanan aturan Firestore Rules menggunakan fitur "Dirty Dozen Security Test Suite" di tab Keamanan.',
    ],
    tips: [
      'Prinsip Anti-Eskalasi melarang siapapun menurunkan hak Owner pertama atau menunjuk Owner baru tanpa otentikasi Owner yang sah.',
      'Log Audit bersifat "Immutable": riwayat perubahan tidak dapat dihapus oleh pengguna maupun admin sistem.',
    ],
    relatedRoles: ['OWNER', 'ADMIN'],
  },
  {
    id: 'guide-settings',
    category: 'PENGATURAN',
    title: '9. Legalitas Perusahaan & Cadangan Sistem',
    summary: 'Konfigurasi identitas PT. Asa Perdana Mandiri, nomor rekening, dan ekspor source code.',
    steps: [
      'Buka menu "Pengaturan" -> tab "Perusahaan & Rekening".',
      'Perbarui alamat kantor, NPWP, email resmi, dan daftar rekening bank penerima tagihan.',
      'Atur nama dan jabatan penandatangan resmi dokumen (Default: Direktur / Project Director).',
      'Bagi peran OWNER, Anda dapat mengunduh salinan berkas cadangan kode sumber melalui tombol "Unduh Source Code (JSON)".',
    ],
    tips: [
      'Fitur Unduh Source Code secara otomatis memfilter seluruh token rahasia, kunci privat Firebase, dan kredensial sensitif sehingga aman dari kebocoran.',
    ],
    relatedRoles: ['OWNER', 'ADMIN'],
  },
];

export function UserGuideView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    'guide-project': true,
    'guide-drawings': true,
  });

  const toggleExpand = (id: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    GUIDE_DATA.forEach((g) => {
      allExpanded[g.id] = true;
    });
    setExpandedModules(allExpanded);
  };

  const collapseAll = () => {
    setExpandedModules({});
  };

  const filteredGuides = useMemo(() => {
    return GUIDE_DATA.filter((guide) => {
      if (selectedCategory !== 'ALL' && guide.category !== selectedCategory) {
        return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const inTitle = guide.title.toLowerCase().includes(q);
        const inSummary = guide.summary.toLowerCase().includes(q);
        const inSteps = guide.steps.some((s) => s.toLowerCase().includes(q));
        const inTips = guide.tips.some((t) => t.toLowerCase().includes(q));
        if (!inTitle && !inSummary && !inSteps && !inTips) {
          return false;
        }
      }

      return true;
    });
  }, [searchQuery, selectedCategory]);

  const getRoleBadgeVariant = (role: string): 'purple' | 'info' | 'success' | 'warning' | 'default' => {
    switch (role) {
      case 'OWNER': return 'purple';
      case 'ADMIN': return 'info';
      case 'PROJECT_LEADER': return 'success';
      case 'FINANCE': return 'warning';
      case 'TEAM': return 'info';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6 w-full max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              Panduan Pengguna (User Guide)
            </h1>
            <Badge variant="outline">MDrawing v1.0</Badge>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Petunjuk komprehensif alur kerja manajemen gambar kerja, revisi, dokumen pengantar, dan finansial PT. Asa Perdana Mandiri.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={expandAll}>
            Buka Semua
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll}>
            Tutup Semua
          </Button>
        </div>
      </div>

      {/* Search & Category Filter Toolbar */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
          <Input
            placeholder="Cari petunjuk (misal: 'buat invoice', 'tambah revisi', 'spk vendor', 'dirty dozen')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2 pt-1">
          {[
            { id: 'ALL', label: 'Semua Panduan' },
            { id: 'PROYEK', label: 'Proyek & Klien' },
            { id: 'GAMBAR', label: 'Gambar & Transmittal' },
            { id: 'KEUANGAN', label: 'Quotation & Invoice' },
            { id: 'VENDOR', label: 'Vendor & Subkon' },
            { id: 'KEAMANAN', label: 'Hak Akses & Keamanan' },
            { id: 'PENGATURAN', label: 'Pengaturan & Cadangan' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-black/10 dark:hover:bg-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Guides List */}
      <div className="space-y-4">
        {filteredGuides.length === 0 ? (
          <div className="py-12 text-center rounded-2xl border border-dashed border-[var(--color-border)] p-8">
            <HelpCircle className="w-8 h-8 text-[var(--color-text-secondary)] mx-auto mb-2" />
            <p className="text-sm text-[var(--color-text-secondary)]">
              Tidak ada modul panduan yang sesuai dengan kata kunci pencarian Anda.
            </p>
          </div>
        ) : (
          filteredGuides.map((guide) => {
            const isExpanded = !!expandedModules[guide.id];
            return (
              <div
                key={guide.id}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden transition-all duration-200"
              >
                {/* Header clickable */}
                <button
                  onClick={() => toggleExpand(guide.id)}
                  className="w-full text-left p-4 flex items-center justify-between gap-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[var(--color-text-primary)]">
                        {guide.title}
                      </span>
                      <Badge variant="outline">
                        {guide.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-1">
                      {guide.summary}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:flex items-center gap-1.5">
                      {guide.relatedRoles.slice(0, 3).map((role) => (
                        <Badge key={role} variant={getRoleBadgeVariant(role)}>
                          {role}
                        </Badge>
                      ))}
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    )}
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-[var(--color-border)]/50 space-y-4">
                    {/* Steps */}
                    <div className="pt-3">
                      <span className="text-xs font-semibold text-[var(--color-text-primary)] block mb-2">
                        Langkah-Langkah Penggunaan:
                      </span>
                      <ol className="space-y-2 list-decimal list-inside text-xs text-[var(--color-text-primary)] leading-relaxed">
                        {guide.steps.map((step, idx) => (
                          <li key={idx} className="pl-1">
                            <span className="ml-1">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Pro Tips */}
                    {guide.tips.length > 0 && (
                      <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-1.5">
                        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                          <Bookmark className="w-3.5 h-3.5" />
                          Tips & Praktik Terbaik:
                        </span>
                        <ul className="space-y-1 text-xs text-[var(--color-text-primary)]">
                          {guide.tips.map((tip, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Footer Roles */}
                    <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
                      <span>Peran yang relevan:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {guide.relatedRoles.map((role) => (
                          <Badge key={role} variant={getRoleBadgeVariant(role)}>
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
