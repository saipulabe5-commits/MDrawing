import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Sparkles, AlertTriangle, FileCheck2, Bot, CheckCircle2, 
  XCircle, Copy, ArrowRight, RefreshCw, Key, Filter, 
  Building, ChevronRight, Download, Send, Trash2, Eye, ShieldAlert,
  X, EyeOff, Cpu, Zap
} from 'lucide-react';
import { Button, Card, Badge, SegmentedControl } from '../components/ui';
import { 
  SolarAiService, 
  SolarErrorDetectionResult, 
  SolarDocumentCheckResult, 
  SolarChatMessage,
  SolarConfig
} from '../services/solarAiService';
import { Quotation, Project, DrawingItem } from '../types';
import toast from 'react-hot-toast';

export const SolarAuditView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Tab state: 'errors' | 'documents' | 'assistant'
  const initialTab = searchParams.get('tab') || 'errors';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Solar Config state
  const [solarConfig, setSolarConfig] = useState<SolarConfig>(SolarAiService.getConfig());
  
  // Data sources
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // TAB 1: Error Detection State
  const [selectedQuotationId, setSelectedQuotationId] = useState<string>(searchParams.get('quoId') || '');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(searchParams.get('projectId') || '');
  const [errorContextType, setErrorContextType] = useState<'quotation' | 'drawings' | 'custom'>('quotation');
  const [customErrorText, setCustomErrorText] = useState('');
  const [isDetectingErrors, setIsDetectingErrors] = useState(false);
  const [errorResult, setErrorResult] = useState<SolarErrorDetectionResult | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');

  // TAB 2: Document Check State
  const [docCheckType, setDocCheckType] = useState<'quotation' | 'spk' | 'invoice' | 'bast' | 'custom'>('quotation');
  const [docTitle, setDocTitle] = useState('Surat Penawaran Harga Arsitektur');
  const [docContentText, setDocContentText] = useState('');
  const [isCheckingDoc, setIsCheckingDoc] = useState(false);
  const [docCheckResult, setDocCheckResult] = useState<SolarDocumentCheckResult | null>(null);

  // TAB 3: Assistant Chat State
  const [chatMessages, setChatMessages] = useState<SolarChatMessage[]>([
    {
      role: 'assistant',
      content: 'Halo! Saya MDrawing AI Assistant bertenaga **Upstage Solar 4 Pro**. Saya siap membantu Anda melakukan deteksi kesalahan RAB/penawaran, memeriksa kepatuhan klausul dokumen proyek, audit gambar CAD, dan konsultasi teknis arsitektur. Apa yang ingin Anda periksa hari ini?',
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [modelInput, setModelInput] = useState<'solar-pro' | 'solar-mini'>('solar-pro');
  const [showSecret, setShowSecret] = useState(false);
  const [isValidatingKey, setIsValidatingKey] = useState(false);

  const handleSaveSolarKey = async () => {
    if (!keyInput.trim()) {
      toast.error('Masukkan API Key Upstage Solar Anda.');
      return;
    }
    setIsValidatingKey(true);
    try {
      const res = await SolarAiService.validateApiKey(keyInput.trim(), modelInput);
      if (res.valid) {
        const updated = await SolarAiService.saveConfig({
          apiKey: keyInput.trim(),
          model: modelInput,
          isConfigured: true,
          lastTestedAt: new Date().toISOString(),
          lastTestStatus: 'SUCCESS',
          lastTestLatency: res.latencyMs,
        });
        setSolarConfig(updated);
        setShowKeyModal(false);
        toast.success(res.message || 'API Key Upstage Solar 4 Pro berhasil disimpan!');
      } else {
        toast.error(res.message || 'Validasi API Key gagal. Periksa kembali kunci Anda.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal memvalidasi API Key.');
    } finally {
      setIsValidatingKey(false);
    }
  };

  // Load initial data (quotations, projects, solar config)
  useEffect(() => {
    async function loadData() {
      try {
        const cfg = await SolarAiService.loadConfig();
        setSolarConfig(cfg);

        // Fetch quotations
        const qSnap = await getDocs(query(collection(db, 'quotations'), orderBy('createdAt', 'desc'), limit(30)));
        const qList = qSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Quotation));
        setQuotations(qList);

        // Auto select first quote if none in URL
        if (!selectedQuotationId && qList.length > 0) {
          setSelectedQuotationId(qList[0].id);
        }

        // Fetch projects
        const pSnap = await getDocs(query(collection(db, 'projects'), orderBy('createdAt', 'desc'), limit(30)));
        const pList = pSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
        setProjects(pList);
        if (!selectedProjectId && pList.length > 0) {
          setSelectedProjectId(pList[0].id);
        }
      } catch (err) {
        console.error('[SolarAuditView] Error loading data:', err);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadData();
  }, []);

  // When selected quotation changes, update document checker text preset
  useEffect(() => {
    if (selectedQuotationId && quotations.length > 0) {
      const q = quotations.find((item) => item.id === selectedQuotationId);
      if (q) {
        const text = `SURAT PENAWARAN HARGA
Nomor: ${q.quotationNumber} (Rev.${q.revisionNumber || 0})
Tanggal: ${q.date || new Date().toISOString().split('T')[0]}
Status: ${q.status}
Proyek: ${q.projectName || '-'}
Nilai Subtotal: Rp ${(q.subTotal || 0).toLocaleString('id-ID')}
Diskon: Rp ${(q.discount || 0).toLocaleString('id-ID')}
Pajak (PPN ${q.taxPercentage || 0}%): Rp ${(q.tax || 0).toLocaleString('id-ID')}
Grand Total: Rp ${(q.grandTotal || 0).toLocaleString('id-ID')}

ITEM PEKERJAAN:
${(q.items || []).map((it, idx) => `${idx + 1}. ${it.description} | Vol: ${it.quantity} ${it.unit} @ Rp ${it.unitPrice.toLocaleString('id-ID')} = Rp ${it.totalPrice.toLocaleString('id-ID')}`).join('\n')}

SYARAT & KETENTUAN:
1. Penawaran harga mengikat selama 30 hari kalender sejak tanggal diterbitkan.
2. Pembayaran bertahap sesuai progres tahapan gambar arsitektur.
3. Hak cipta dokumen milik PT. Asa Perdana Mandiri hingga pelunasan pembayaran.
`;
        setDocContentText(text);
        setDocTitle(`Surat Penawaran ${q.quotationNumber}`);
      }
    }
  }, [selectedQuotationId, quotations]);

  // 1. Run Error Detection
  const handleRunErrorDetection = async () => {
    if (!solarConfig.isConfigured && !solarConfig.apiKey) {
      toast.error('API Key Upstage Solar belum diatur. Silakan atur pada menu Pengaturan > AI Upstage Solar Pro.');
      return;
    }

    setIsDetectingErrors(true);
    setErrorResult(null);

    try {
      let auditPayload: any = null;

      if (errorContextType === 'quotation') {
        const q = quotations.find((it) => it.id === selectedQuotationId);
        if (!q) {
          toast.error('Pilih penawaran yang ingin diaudit.');
          setIsDetectingErrors(false);
          return;
        }
        auditPayload = {
          quotationNumber: q.quotationNumber,
          revisionNumber: q.revisionNumber,
          status: q.status,
          projectName: q.projectName,
          subTotal: q.subTotal,
          discount: q.discount,
          taxPercentage: q.taxPercentage,
          tax: q.tax,
          grandTotal: q.grandTotal,
          items: q.items,
        };
      } else if (errorContextType === 'drawings') {
        const p = projects.find((it) => it.id === selectedProjectId);
        if (!p) {
          toast.error('Pilih proyek untuk audit gambar.');
          setIsDetectingErrors(false);
          return;
        }
        // Fetch drawing items for this project
        const dSnap = await getDocs(collection(db, 'drawingItems'));
        const drawings = dSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as DrawingItem))
          .filter((d) => d.projectId === p.id);

        auditPayload = {
          projectCode: p.projectCode,
          projectName: p.projectName,
          status: p.status,
          targetDate: p.targetDate,
          contractValue: p.contractValue,
          drawingsCount: drawings.length,
          drawings: drawings.map((d) => ({
            drawingNumber: d.drawingNumber,
            drawingName: d.drawingName,
            scale: d.scale,
            status: d.status,
            picName: d.picName,
            deadline: d.deadline,
            revisionCount: d.revisionCount,
          })),
        };
      } else {
        if (!customErrorText.trim()) {
          toast.error('Masukkan data atau teks yang ingin diaudit.');
          setIsDetectingErrors(false);
          return;
        }
        auditPayload = { customText: customErrorText };
      }

      const res = await SolarAiService.detectErrors({
        contextType: errorContextType,
        data: auditPayload,
      });

      setErrorResult(res);
      toast.success(`Deteksi selesai! ${res.errors.length} catatan/kesalahan ditemukan.`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal menjalankan deteksi kesalahan Solar Pro');
    } finally {
      setIsDetectingErrors(false);
    }
  };

  // 2. Run Document Checking
  const handleRunDocumentCheck = async () => {
    if (!solarConfig.isConfigured && !solarConfig.apiKey) {
      toast.error('API Key Upstage Solar belum diatur. Silakan atur pada menu Pengaturan > AI Upstage Solar Pro.');
      return;
    }
    if (!docContentText.trim()) {
      toast.error('Isi atau pilih konten dokumen yang ingin diperiksa.');
      return;
    }

    setIsCheckingDoc(true);
    setDocCheckResult(null);

    try {
      const res = await SolarAiService.checkDocument({
        docType: docCheckType,
        docTitle: docTitle || 'Dokumen Tanpa Judul',
        contentText: docContentText,
      });

      setDocCheckResult(res);
      toast.success(`Pemeriksaan dokumen selesai! Skor Kepatuhan: ${res.complianceScore}%`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal memeriksa dokumen');
    } finally {
      setIsCheckingDoc(false);
    }
  };

  // 3. Send Message to Solar AI Assistant
  const handleSendMessage = async (presetPrompt?: string) => {
    const textToSend = (presetPrompt || inputPrompt).trim();
    if (!textToSend || isChatting) return;

    if (!solarConfig.isConfigured && !solarConfig.apiKey) {
      setShowKeyModal(true);
      toast.error('API Key Upstage Solar belum diatur. Silakan masukkan API Key Anda.');
      return;
    }

    const newHistory: SolarChatMessage[] = [
      ...chatMessages,
      { role: 'user', content: textToSend },
    ];
    setChatMessages(newHistory);
    setInputPrompt('');
    setIsChatting(true);

    try {
      // Fetch live drawing items from Firestore for real-time grounding
      const dSnap = await getDocs(
        query(collection(db, 'drawingItems'), where('isDeleted', '==', false))
      );
      const allDrawings = dSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DrawingItem));

      const now = new Date();
      const activeDrawings = allDrawings.filter((d) => !d.isDeleted);
      const overdueDrawings = activeDrawings.filter(
        (d) => d.deadline && new Date(d.deadline) < now && d.status !== 'Selesai'
      );

      // Group overdue by Drafter / PIC
      const overdueByDrafter: Record<string, DrawingItem[]> = {};
      for (const d of overdueDrawings) {
        const pic = d.picName || 'Belum Ditugaskan';
        if (!overdueByDrafter[pic]) overdueByDrafter[pic] = [];
        overdueByDrafter[pic].push(d);
      }

      let liveContext = `[DATA REAL-TIME DATABASE PT. ASA PERDANA MANDIRI]\n`;
      liveContext += `• Total Proyek Aktif: ${projects.length}\n`;
      liveContext += `• Total Lembar Gambar Aktif: ${activeDrawings.length}\n`;
      liveContext += `• Gambar Selesai / Disetujui: ${activeDrawings.filter((d) => d.status === 'Selesai').length}\n`;
      liveContext += `• Gambar Overdue (Terlambat): ${overdueDrawings.length}\n`;

      if (overdueDrawings.length > 0) {
        liveContext += `\n[DAFTAR DRAFTER DENGAN GAMBAR OVERDUE/TERLAMBAT]:\n`;
        for (const [drafter, list] of Object.entries(overdueByDrafter)) {
          liveContext += `► PIC/Drafter: "${drafter}" memiliki ${list.length} drawing yang melewati batas waktu:\n`;
          list.forEach((item) => {
            const daysOverdue = Math.max(
              0,
              Math.floor((now.getTime() - new Date(item.deadline!).getTime()) / (1000 * 60 * 60 * 24))
            );
            liveContext += `   - No: ${item.drawingNumber} | Judul: "${item.drawingName}" | Status: ${item.status} | Target: ${item.deadline} (${daysOverdue} hari overdue) | Rev.${item.revisionCount || 0} | Prioritas: ${item.priority || 'Normal'}\n`;
          });
        }
      } else {
        liveContext += `\n[STATUS OVERDUE]: Saat ini TIDAK ADA gambar yang overdue di database PT. Asa Perdana Mandiri. Seluruh drawing berjalan sesuai jadwal.\n`;
      }

      // Selected project info if any
      const targetProject = selectedProjectId ? projects.find((p) => p.id === selectedProjectId) : null;
      if (targetProject) {
        liveContext += `\n[PROYEK YANG SEDANG DIFOKUSKAN]:\n`;
        liveContext += `Kode: ${targetProject.projectCode} | Nama: ${targetProject.projectName} | Status: ${targetProject.status} | Target: ${targetProject.targetDate || '-'}\n`;
      }

      const res = await SolarAiService.chatWithSolar({
        messages: [
          {
            role: 'system',
            content:
              'Anda adalah MDrawing AI Assistant spesialis Arsitektur, QA Gambar CAD, Deteksi Kesalahan, Cek Dokumen, dan Manajemen Proyek PT. Asa Perdana Mandiri ditenagai model penalaran Upstage Solar 4 Pro.\n\n' +
              'ATURAN PENTING:\n' +
              '1. Anda MEMILIKI AKSES LENGKAP ke database proyek dan drawing PT. Asa Perdana Mandiri melalui konteks data real-time di bawah.\n' +
              '2. Jika pengguna bertanya mengenai siapa yang memiliki drawing overdue, sebutkan secara SPESIFIK: nama drafter/PIC, nomor lembar gambar, judul gambar, batas waktu, dan keterlambatan berapa hari.\n' +
              '3. DILARANG KERAS mengatakan bahwa sistem tidak memiliki akses langsung ke database atau memerlukan upload dokumen pendukung, karena data live telah disediakan lengkap di prompt!\n' +
              '4. Sajikan jawaban terstruktur: FAKTA, ANALISIS KESALAHAN/KONDISI, RISIKO, dan REKOMENDASI PERBAIKAN.',
          },
          ...newHistory.slice(0, -1).filter((m) => m.role !== 'system'),
          {
            role: 'user',
            content: `${liveContext}\n---\nPERTANYAAN PENGGUNA:\n${textToSend}`,
          },
        ],
        projectContext: targetProject,
      });

      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.content },
      ]);
    } catch (err: any) {
      toast.error(err.message || 'Gagal menerima respon dari Solar Pro');
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Kendala: ${err.message || 'Gagal berkomunikasi dengan Solar Pro.'}. Periksa kembali API Key Anda pada tombol 'Atur API Key Solar'.`,
        },
      ]);
    } finally {
      setIsChatting(false);
    }
  };

  const copyToClipboard = (text: string, label: string = 'Teks') => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} disalin ke clipboard!`);
  };

  const filteredErrors = (errorResult?.errors || []).filter((err) => {
    if (severityFilter === 'ALL') return true;
    return err.severity === severityFilter;
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
              Upstage Solar 4 Pro — Deteksi Kesalahan & Cek Dokumen
            </h1>
            <Badge variant={solarConfig.isConfigured ? 'success' : 'warning'}>
              {solarConfig.isConfigured ? 'Solar Pro Aktif' : 'Kunci Belum Dikonfigurasi'}
            </Badge>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Spesialis kecerdasan buatan untuk audit penawaran RAB, verifikasi lembar gambar CAD, kepatuhan klausul kontrak, dan asisten teknis MDrawing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setKeyInput(solarConfig.apiKey || '');
              setModelInput(solarConfig.model || 'solar-pro');
              setShowKeyModal(true);
            }}
            className={`gap-2 text-xs font-semibold ${
              solarConfig.isConfigured
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300'
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-300 animate-pulse'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            {solarConfig.isConfigured ? 'Ubah API Key' : 'Atur API Key Solar'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              SolarAiService.loadConfig().then(setSolarConfig);
              toast.success('Konfigurasi Solar diperbarui');
            }}
            className="gap-1.5 text-xs"
            title="Muat ulang konfigurasi"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sync
          </Button>
        </div>
      </div>

      {/* Main Mode Navigation */}
      <SegmentedControl
        options={[
          { label: '🔍 1. Deteksi Kesalahan (Error Detector)', value: 'errors' },
          { label: '📄 2. Cek Dokumen & Klausul (Doc Checker)', value: 'documents' },
          { label: '🤖 3. AI Assistant Solar 4 Pro', value: 'assistant' },
        ]}
        value={activeTab}
        onChange={(val) => {
          setActiveTab(val);
          navigate(`/solar-audit?tab=${val}`, { replace: true });
        }}
      />

      {/* ============================================================== */}
      {/* TAB 1: DETEKSI KESALAHAN                                       */}
      {/* ============================================================== */}
      {activeTab === 'errors' && (
        <div className="space-y-6">
          {/* Controls Card */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Target Audit Kesalahan
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Pilih data yang ingin diaudit secara mendalam oleh model penalaran Solar 4 Pro.
                </p>
              </div>

              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--color-bg-secondary)] dark:bg-white/10 border border-[var(--color-border)] text-xs">
                <button
                  onClick={() => setErrorContextType('quotation')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    errorContextType === 'quotation'
                      ? 'bg-white dark:bg-white/20 text-blue-700 dark:text-blue-400 border border-slate-200 dark:border-white/10 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                  }`}
                >
                  Penawaran / RAB
                </button>
                <button
                  onClick={() => setErrorContextType('drawings')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    errorContextType === 'drawings'
                      ? 'bg-white dark:bg-white/20 text-blue-700 dark:text-blue-400 border border-slate-200 dark:border-white/10 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                  }`}
                >
                  Gambar & CAD Sheets
                </button>
                <button
                  onClick={() => setErrorContextType('custom')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    errorContextType === 'custom'
                      ? 'bg-white dark:bg-white/20 text-blue-700 dark:text-blue-400 border border-slate-200 dark:border-white/10 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                  }`}
                >
                  Input Bebas
                </button>
              </div>
            </div>

            {/* Target Selectors */}
            {errorContextType === 'quotation' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[var(--color-text-secondary)] block mb-1.5">
                    Pilih Penawaran Harga (Quotation) *
                  </label>
                  <select
                    value={selectedQuotationId}
                    onChange={(e) => setSelectedQuotationId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-xs font-medium text-[var(--color-text-primary)]"
                  >
                    {quotations.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.quotationNumber} — {q.projectName || 'Penawaran'} [Rp {(q.grandTotal || 0).toLocaleString('id-ID')}] - {q.status}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <p className="text-xs text-[var(--color-text-secondary)] pb-2">
                    Solar Pro akan memeriksa: Formula volume x harga satuan, penerapan diskon, perhitungan PPN 11%, konsistensi nama item pekerjaan, dan kelengkapan termin.
                  </p>
                </div>
              </div>
            )}

            {errorContextType === 'drawings' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[var(--color-text-secondary)] block mb-1.5">
                    Pilih Proyek Berjalan *
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-xs font-medium text-[var(--color-text-primary)]"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode} — {p.projectName} ({p.status})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <p className="text-xs text-[var(--color-text-secondary)] pb-2">
                    Solar Pro akan memeriksa: Nomor lembar gambar ganda, skala gambar kosong/inkonsisten, drafter belum ditugaskan, tanggal target terlewat (overdue), dan inkonsistensi revisi.
                  </p>
                </div>
              </div>
            )}

            {errorContextType === 'custom' && (
              <div>
                <label className="text-xs font-bold text-[var(--color-text-secondary)] block mb-1.5">
                  Tempel Data Teknis, Rincian RAB, atau Spesifikasi Gambar *
                </label>
                <textarea
                  rows={4}
                  value={customErrorText}
                  onChange={(e) => setCustomErrorText(e.target.value)}
                  placeholder="Tempel rincian penawaran, item pekerjaan, atau data gambar di sini..."
                  className="w-full p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-xs font-mono text-[var(--color-text-primary)] focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            )}

            {/* Run Button */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Didukung oleh: <strong>Upstage Solar 4 Pro</strong> (Model: {solarConfig.model})
              </span>
              <Button
                onClick={handleRunErrorDetection}
                disabled={isDetectingErrors}
                className="gap-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 shadow-sm"
              >
                <Sparkles className={`w-4 h-4 ${isDetectingErrors ? 'animate-spin' : ''}`} />
                {isDetectingErrors ? 'Menganalisis Kesalahan...' : 'Jalankan Deteksi Kesalahan Solar Pro'}
              </Button>
            </div>
          </div>

          {/* Error Detection Results */}
          {errorResult && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Score & Summary Banner */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col justify-between">
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Skor Kesehatan Data</span>
                  <div className="my-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-[var(--color-text-primary)]">
                      {errorResult.score}
                    </span>
                    <span className="text-xs text-slate-500">/ 100</span>
                  </div>
                  <Badge
                    variant={
                      errorResult.score >= 85 ? 'success' : errorResult.score >= 70 ? 'warning' : 'danger'
                    }
                  >
                    {errorResult.overallStatus}
                  </Badge>
                </div>

                <div className="md:col-span-3 p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                        Ringkasan Audit Solar Pro
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        Latency: {errorResult.latencyMs}ms • Model: {errorResult.modelUsed}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-primary)] leading-relaxed">
                      {errorResult.summary}
                    </p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[var(--color-border)] mt-3">
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5" /> Filter:
                    </span>
                    <button
                      onClick={() => setSeverityFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        severityFilter === 'ALL'
                          ? 'bg-blue-600 text-white shadow-xs font-bold'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Semua ({errorResult.metrics.totalChecked || errorResult.errors.length})
                    </button>
                    <button
                      onClick={() => setSeverityFilter('CRITICAL')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        severityFilter === 'CRITICAL'
                          ? 'bg-rose-600 text-white'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                      }`}
                    >
                      Kritikal ({errorResult.metrics.criticalCount || 0})
                    </button>
                    <button
                      onClick={() => setSeverityFilter('WARNING')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        severityFilter === 'WARNING'
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}
                    >
                      Peringatan ({errorResult.metrics.warningCount || 0})
                    </button>
                    <button
                      onClick={() => setSeverityFilter('INFO')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        severityFilter === 'INFO'
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                      }`}
                    >
                      Saran Info ({errorResult.metrics.infoCount || 0})
                    </button>
                  </div>
                </div>
              </div>

              {/* Error Cards List */}
              <div className="space-y-3">
                {filteredErrors.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
                      Tidak Ditemukan Kesalahan pada Kategori Ini
                    </h4>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      Data yang diperiksa telah memenuhi parameter audit teknis Solar 4 Pro.
                    </p>
                  </div>
                ) : (
                  filteredErrors.map((errItem) => (
                    <div
                      key={errItem.id}
                      className={`p-4 rounded-xl border transition-all ${
                        errItem.severity === 'CRITICAL'
                          ? 'border-rose-500/40 bg-rose-500/5'
                          : errItem.severity === 'WARNING'
                          ? 'border-amber-500/40 bg-amber-500/5'
                          : 'border-blue-500/30 bg-blue-500/5'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={
                                errItem.severity === 'CRITICAL'
                                  ? 'danger'
                                  : errItem.severity === 'WARNING'
                                  ? 'warning'
                                  : 'info'
                              }
                            >
                              {errItem.severity}
                            </Badge>
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                              {errItem.category}
                            </span>
                            <span className="text-xs font-bold text-[var(--color-text-primary)]">
                              • {errItem.target}
                            </span>
                          </div>

                          <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                            {errItem.issue}
                          </p>

                          {errItem.impact && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              <strong>Dampak: </strong> {errItem.impact}
                            </p>
                          )}

                          <div className="p-2.5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-xs text-slate-800 dark:text-slate-200">
                            <strong className="text-emerald-600 dark:text-emerald-400">
                              Rekomendasi Perbaikan:
                            </strong>{' '}
                            {errItem.recommendation}
                            {errItem.suggestedCorrection && (
                              <div className="mt-1 font-mono text-[11px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 p-1.5 rounded-sm">
                                {errItem.suggestedCorrection}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 flex sm:flex-col gap-2">
                          <Button
                            variant="secondary"
                            onClick={() =>
                              copyToClipboard(
                                `${errItem.target}: ${errItem.issue}\nRekomendasi: ${errItem.recommendation}`,
                                'Temuan Audit'
                              )
                            }
                            className="text-xs gap-1 py-1.5"
                          >
                            <Copy className="w-3 h-3" /> Salin
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: CEK DOKUMEN & KLAUSUL LEGAL                             */}
      {/* ============================================================== */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5">
            <div className="border-b border-[var(--color-border)] pb-4">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-blue-500" />
                Pemeriksa Kepatuhan & Klausul Dokumen (Document Checker)
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Periksa kelengkapan klausul hukum, hak cipta gambar CAD, ketentuan pembayaran, dan identitas legalitas perusahaan sebelum diterbitkan.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-[var(--color-text-secondary)] block mb-1.5">
                  Tipe Dokumen
                </label>
                <select
                  value={docCheckType}
                  onChange={(e) => setDocCheckType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-xs font-medium text-[var(--color-text-primary)]"
                >
                  <option value="quotation">Surat Penawaran Harga (Quotation)</option>
                  <option value="spk">Surat Perintah Kerja (SPK / Kontrak)</option>
                  <option value="invoice">Faktur Tagihan (Invoice)</option>
                  <option value="bast">Berita Acara Serah Terima (BAST)</option>
                  <option value="drawing_transmittal">Transmittal Gambar Kerja</option>
                  <option value="custom">Dokumen Kustom / Bebas</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-[var(--color-text-secondary)] block mb-1.5">
                  Judul / Nomor Dokumen
                </label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="Contoh: QUO-202609-0001 RSPI Puri Indah"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-xs text-[var(--color-text-primary)]"
                />
              </div>
            </div>

            {/* Quick Preset Selector */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Preset dari Data MDrawing:</span>
              <select
                onChange={(e) => setSelectedQuotationId(e.target.value)}
                value={selectedQuotationId}
                className="px-2.5 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-xs text-[var(--color-text-primary)]"
              >
                <option value="">-- Muat Isi Dari Penawaran Tersimpan --</option>
                {quotations.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.quotationNumber} - {q.projectName || 'Penawaran'}
                  </option>
                ))}
              </select>
            </div>

            {/* Document Content Textarea */}
            <div>
              <label className="text-xs font-bold text-[var(--color-text-secondary)] block mb-1.5">
                Isi Dokumen / Teks Draft Dokumen *
              </label>
              <textarea
                rows={10}
                value={docContentText}
                onChange={(e) => setDocContentText(e.target.value)}
                placeholder="Tempel teks lengkap penawaran, klausul SPK, atau syarat dan ketentuan di sini..."
                className="w-full p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-xs font-mono text-[var(--color-text-primary)] leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Pemeriksaan standar: SNI, IAI Code of Conduct, dan Hukum Kontrak Dagang Indonesia.
              </span>
              <Button
                onClick={handleRunDocumentCheck}
                disabled={isCheckingDoc}
                className="gap-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5"
              >
                <FileCheck2 className={`w-4 h-4 ${isCheckingDoc ? 'animate-spin' : ''}`} />
                {isCheckingDoc ? 'Memeriksa Dokumen...' : 'Cek Dokumen via Solar Pro'}
              </Button>
            </div>
          </div>

          {/* Document Check Results */}
          {docCheckResult && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col justify-between">
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Skor Kepatuhan Legal</span>
                  <div className="my-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-[var(--color-text-primary)]">
                      {docCheckResult.complianceScore}%
                    </span>
                  </div>
                  <Badge
                    variant={
                      docCheckResult.complianceScore >= 85
                        ? 'success'
                        : docCheckResult.complianceScore >= 65
                        ? 'warning'
                        : 'danger'
                    }
                  >
                    {docCheckResult.overallStatus.replace(/_/g, ' ')}
                  </Badge>
                </div>

                <div className="md:col-span-3 p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                      Kesimpulan Eksekutif Auditor Solar Pro
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      Latency: {docCheckResult.latencyMs}ms
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-primary)] leading-relaxed">
                    {docCheckResult.executiveSummary}
                  </p>
                </div>
              </div>

              {/* Missing Items & Risk Alerts */}
              {(docCheckResult.missingItems?.length > 0 || docCheckResult.riskWarnings?.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {docCheckResult.missingItems?.length > 0 && (
                    <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                      <h4 className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        Poin Wajib yang Belum Tercantum:
                      </h4>
                      <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 pl-4 list-disc">
                        {docCheckResult.missingItems.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {docCheckResult.riskWarnings?.length > 0 && (
                    <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-2">
                      <h4 className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4" />
                        Peringatan Risiko Hukum / Finansial:
                      </h4>
                      <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 pl-4 list-disc">
                        {docCheckResult.riskWarnings.map((risk, idx) => (
                          <li key={idx}>{risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Clauses Breakdown Table */}
              {docCheckResult.clauses?.length > 0 && (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
                  <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
                    Audit Rinci Klausul Dokumen
                  </h4>
                  <div className="space-y-3">
                    {docCheckResult.clauses.map((clause, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--color-text-primary)]">
                            {clause.name}
                          </span>
                          <Badge
                            variant={
                              clause.status === 'PASS'
                                ? 'success'
                                : clause.status === 'WARNING'
                                ? 'warning'
                                : clause.status === 'FAIL'
                                ? 'danger'
                                : 'outline'
                            }
                          >
                            {clause.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {clause.summary}
                        </p>
                        {clause.details && (
                          <p className="text-[11px] text-slate-500">
                            {clause.details}
                          </p>
                        )}
                        {clause.recommendedClause && (
                          <div className="mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start justify-between gap-2">
                            <div>
                              <strong>Saran Redaksional Klausul:</strong> {clause.recommendedClause}
                            </div>
                            <button
                              onClick={() => copyToClipboard(clause.recommendedClause!, 'Klausul Saran')}
                              className="shrink-0 p-1 hover:bg-emerald-200/50 rounded-sm"
                              title="Salin klausul"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Amendments Textarea */}
              {docCheckResult.suggestedAmendments && (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
                      Rekomendasi Redaksi Klausul Tambahan Lengkap
                    </h4>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        copyToClipboard(docCheckResult.suggestedAmendments, 'Klausul Rekomendasi Lengkap')
                      }
                      className="text-xs gap-1.5 py-1"
                    >
                      <Copy className="w-3.5 h-3.5" /> Salin Semua Rekomendasi
                    </Button>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-slate-50 dark:bg-black/40 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-white/10 text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
                    {docCheckResult.suggestedAmendments}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: AI ASSISTANT SOLAR 4 PRO                                */}
      {/* ============================================================== */}
      {activeTab === 'assistant' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col h-[650px] overflow-hidden shadow-xs">
            {/* Assistant Header */}
            <div className="px-5 py-3.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[var(--color-text-primary)]">
                      MDrawing Solar Assistant
                    </span>
                    <Badge variant="warning">Solar 4 Pro</Badge>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Spesialis Arsitektur, QA Gambar CAD, & Finansial Proyek
                  </span>
                </div>
              </div>

              {chatMessages.length > 1 && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    setChatMessages([
                      {
                        role: 'assistant',
                        content: 'Percakapan dibersihkan. Ada yang ingin saya periksa kembali?',
                      },
                    ])
                  }
                  className="text-xs gap-1 text-slate-500 hover:text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Reset
                </Button>
              )}
            </div>

            {/* Quick Prompt Pills */}
            <div className="p-2.5 px-4 border-b border-[var(--color-border)] bg-amber-500/5 flex flex-wrap gap-2 text-xs">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" /> Coba Cepat:
              </span>
              <button
                onClick={() =>
                  handleSendMessage('Siapa yang punya drawing overdue?')
                }
                className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400 text-amber-800 dark:text-amber-200 hover:bg-amber-500/25 transition-colors text-[11px] font-bold flex items-center gap-1"
              >
                ⚠️ Siapa yang punya drawing overdue?
              </button>
              <button
                onClick={() =>
                  handleSendMessage('Audit dan deteksi apakah ada kesalahan pada perhitungan RAB dan pajak penawaran ini?')
                }
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-amber-400 transition-colors text-[11px]"
              >
                🔍 Deteksi Kesalahan RAB & Pajak
              </button>
              <button
                onClick={() =>
                  handleSendMessage('Periksa kelengkapan klausul kontrak dan batasan revisi desain arsitektur yang aman untuk arsitek.')
                }
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-amber-400 transition-colors text-[11px]"
              >
                📄 Cek Klausul SPK Gambar Kerja
              </button>
              <button
                onClick={() =>
                  handleSendMessage('Apa standar baku pemberian nomor lembar gambar CAD (Sheet Numbering) menurut standar arsitektur?')
                }
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-amber-400 transition-colors text-[11px]"
              >
                📐 Standar Nomor Lembar CAD
              </button>
            </div>

            {/* Messages Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed space-y-2 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-xs'
                        : 'bg-white dark:bg-white/10 text-[var(--color-text-primary)] rounded-tl-xs border border-slate-200 dark:border-white/10 shadow-xs'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.role === 'assistant' && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => copyToClipboard(msg.content, 'Respon Assistant')}
                          className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" /> Salin
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isChatting && (
                <div className="flex gap-3 justify-start items-center">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 animate-pulse">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-white dark:bg-white/10 p-3 rounded-xl border border-slate-200 dark:border-white/10 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 shadow-xs">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Solar 4 Pro sedang menganalisis...
                  </div>
                </div>
              )}
            </div>

            {/* Input Form */}
            <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  placeholder="Tanyakan analisis dokumen, deteksi kesalahan penawaran, atau standar gambar..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-xs text-[var(--color-text-primary)] focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                  disabled={isChatting}
                />
                <Button
                  type="submit"
                  disabled={isChatting || !inputPrompt.trim()}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl gap-1.5 text-xs font-bold"
                >
                  <Send className="w-3.5 h-3.5" />
                  Kirim
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Solar API Key Setup Modal Dialog */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl p-5 space-y-4 text-[var(--color-text-primary)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[var(--color-text-primary)]">
                    API Key Upstage Solar 4 Pro
                  </h3>
                  <span className="text-[11px] text-slate-500">Deteksi Kesalahan, Cek Dokumen & Assistant</span>
                </div>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Kunci API ini digunakan untuk memproses deteksi kesalahan RAB, kepatuhan klausul SPK/kontrak, dan konsultasi AI Assistant dengan model Upstage Solar 4 Pro. Kunci dapat diperoleh di{' '}
              <a
                href="https://console.upstage.ai/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-amber-600 font-semibold underline hover:text-amber-700"
              >
                console.upstage.ai
              </a>.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kunci API (API Key)
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="up_xxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full pl-3 pr-10 py-2.5 text-xs bg-slate-50 dark:bg-white/10 text-[var(--color-text-primary)] border border-slate-300 dark:border-white/10 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Model Engine
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setModelInput('solar-pro')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
                      modelInput === 'solar-pro'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-bold flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5" /> Solar Pro
                    </span>
                    <span className="text-[10px] text-slate-500">Penalaran & akurasi tinggi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModelInput('solar-mini')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
                      modelInput === 'solar-mini'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-bold flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" /> Solar Mini
                    </span>
                    <span className="text-[10px] text-slate-500">Respon kilat & ringan</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveSolarKey}
                disabled={isValidatingKey || !keyInput.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white shadow-xs cursor-pointer"
              >
                {isValidatingKey ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Memvalidasi...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Tes & Simpan Kunci</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
