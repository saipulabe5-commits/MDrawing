import React, { useState, useEffect, useRef } from "react";
import * as LucideIcons from "lucide-react";
import { useAI } from "../../context/AIContext";
import { useProjects } from "../../context/ProjectContext";
import { useAuth } from "../../context/AuthContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { DrawingItem, Invoice, VendorBill } from "../../types";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { SolarAiService, SolarConfig } from "../../services/solarAiService";

const QUICK_PROMPTS = [
  "Siapa yang punya drawing overdue?",
  "🔍 Deteksi kesalahan pada proyek dan RAB ini",
  "📄 Cek kelengkapan dokumen dan klausul kontrak",
  "Apa kondisi proyek ini?",
  "Kenapa progress terlambat?",
  "Apa risiko terbesar?",
  "Invoice mana yang perlu ditindaklanjuti?",
  "Siapkan Owner Brief.",
  "Ringkas perubahan proyek sejak minggu lalu.",
];

export const AICommandModal: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isOpen,
    setIsOpen,
    aiEngine,
    setAiEngine,
    isAnalyzing,
    lastResponse,
    conversationHistory,
    pendingConfirmation,
    executeCommand,
    confirmPendingAction,
    cancelPendingAction,
    clearConversation,
    quotaState,
  } = useAI();

  const { projects } = useProjects();
  const { appUser } = useAuth();

  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");
  const [promptInput, setPromptInput] = useState("");
  const [isConfirmingTool, setIsConfirmingTool] = useState(false);
  const [showSolarKeyModal, setShowSolarKeyModal] = useState(false);
  const [solarKeyInput, setSolarKeyInput] = useState("");
  const [solarModelSelect, setSolarModelSelect] = useState<"solar-pro" | "solar-mini">("solar-pro");
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [showKeySecret, setShowKeySecret] = useState(false);
  const [solarConfig, setSolarConfig] = useState<SolarConfig>(() => SolarAiService.getConfig());
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-close modal whenever route changes (e.g. user clicked /solar-audit in sidebar or elsewhere)
  useEffect(() => {
    if (isOpen) {
      setIsOpen(false);
    }
  }, [location.pathname]);

  // Robust ESC Key listener attached directly to window and document in capture phase
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        if (showSolarKeyModal) {
          setShowSolarKeyModal(false);
        } else {
          setIsOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleEscape, true);
    document.addEventListener("keydown", handleEscape, true);
    return () => {
      window.removeEventListener("keydown", handleEscape, true);
      document.removeEventListener("keydown", handleEscape, true);
    };
  }, [isOpen, showSolarKeyModal, setIsOpen]);

  // Sync Solar config
  useEffect(() => {
    SolarAiService.loadConfig().then((cfg) => {
      setSolarConfig(cfg);
      setSolarKeyInput(cfg.apiKey || "");
      setSolarModelSelect(cfg.model || "solar-pro");
    });
  }, [isOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Auto scroll down when new conversation arrives
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [conversationHistory, isAnalyzing]);

  const handleSaveSolarKey = async()=>{setIsValidatingKey(true);try{const cfg=await SolarAiService.loadConfig();setSolarConfig(cfg);toast.success(cfg.isConfigured?'Konfigurasi kunci server tersedia. Koneksi provider belum diuji.':'Kunci belum dikonfigurasi operator pada server.');}catch(e:any){toast.error(e.message);}finally{setIsValidatingKey(false);}};

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || promptInput).trim();
    if (!textToSend || isAnalyzing) return;

    if (aiEngine === "gemini") {
      if (quotaState.status === "LOCKED") {
        toast.error("Fitur Gemini Free-Tier terkunci. Anda dapat beralih ke Upstage Solar 4 Pro.");
        return;
      }

      if (quotaState.status === "BILLING_BLOCKED") {
        toast.error("Fitur Gemini dinonaktifkan di bawah kebijakan Zero-Billing. Anda dapat beralih ke Solar 4 Pro.");
        return;
      }
    }

    setPromptInput("");

    // Detect if this is an overdue/drafter/global question
    const lowerText = textToSend.toLowerCase();
    const isGlobalOrOverdueQuery =
      !selectedProjectId ||
      lowerText.includes("overdue") ||
      lowerText.includes("siapa") ||
      lowerText.includes("drafter") ||
      lowerText.includes("terlambat") ||
      lowerText.includes("semua") ||
      lowerText.includes("gambar") ||
      lowerText.includes("drawing");

    let drawings: DrawingItem[] = [];
    let invoices: Invoice[] = [];
    let vendorBills: VendorBill[] = [];
    let targetProject = projects.find((p) => p.id === selectedProjectId) || null;

    try {
      if (selectedProjectId && !isGlobalOrOverdueQuery) {
        const dSnap = await getDocs(
          query(
            collection(db, "drawingItems"),
            where("projectId", "==", selectedProjectId),
            where("isDeleted", "==", false)
          )
        );
        drawings = dSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DrawingItem));
      } else {
        // Fetch drawings across all projects for full database visibility
        const dSnap = await getDocs(
          query(collection(db, "drawingItems"), where("isDeleted", "==", false))
        );
        drawings = dSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DrawingItem));

        if (!targetProject && projects.length > 0) {
          targetProject = {
            id: "all-projects",
            projectCode: "ALL",
            projectName: `Portofolio PT. Asa Perdana Mandiri (${projects.length} Proyek)`,
            status: "BERJALAN",
            contractValue: projects.reduce((acc, p) => acc + (p.contractValue || 0), 0),
          } as any;
        }
      }

      if (appUser?.canViewFinance || appUser?.role === "OWNER" || appUser?.role === "ADMIN") {
        if (selectedProjectId) {
          const iSnap = await getDocs(
            query(collection(db, "invoices"), where("projectId", "==", selectedProjectId))
          );
          invoices = iSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Invoice));

          const vSnap = await getDocs(
            query(collection(db, "vendorBills"), where("projectId", "==", selectedProjectId))
          );
          vendorBills = vSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as VendorBill));
        } else {
          const iSnap = await getDocs(collection(db, "invoices"));
          invoices = iSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Invoice));
        }
      }
    } catch (err) {
      console.warn("[AICommandModal] Error pre-fetching project context:", err);
    }

    await executeCommand(textToSend, {
      project: targetProject,
      drawings,
      invoices,
      vendorBills,
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Analisis berhasil disalin!");
  };

  const handleExecutePending = async () => {
    setIsConfirmingTool(true);
    try {
      const res = await confirmPendingAction();
      if (res?.success) {
        toast.success(res.message);
      } else if (res?.message) {
        toast.error(res.message);
      }
    } finally {
      setIsConfirmingTool(false);
    }
  };

  const isLocked = quotaState.status === "LOCKED" || quotaState.status === "BILLING_BLOCKED";

  // If modal is not open, do not render into DOM
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(false);
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="MDrawing AI Command Center"
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-[var(--color-surface)]/95 backdrop-blur-2xl border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden transition-all text-[var(--color-text-primary)] cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* macOS Style Window Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/70 shrink-0">
          <div className="flex items-center gap-3">
            {/* macOS traffic light visual dots */}
            <div className="flex items-center gap-1.5 mr-1">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-rose-500/20 transition-colors cursor-pointer"
                title="Tutup (Esc)"
                aria-label="Tutup Modal"
              >
                <span className="w-3.5 h-3.5 rounded-full bg-rose-500 hover:scale-110 transition-transform shadow-2xs" />
              </button>
              <span className="w-3.5 h-3.5 rounded-full bg-amber-400" />
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500" />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-[var(--color-text-primary)]">MDrawing AI</span>
              
              {/* Engine Switcher */}
              <div className="flex items-center p-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setAiEngine("solar")}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                    aiEngine === "solar"
                      ? "bg-amber-500 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-amber-600"
                  }`}
                  title="Ditenagai Upstage Solar 4 Pro"
                >
                  <LucideIcons.Sparkles className="w-3 h-3" />
                  <span>Solar 4 Pro</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAiEngine("gemini")}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                    aiEngine === "gemini"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-blue-600"
                  }`}
                  title="Gemini Free-Tier"
                >
                  <LucideIcons.Bot className="w-3 h-3" />
                  <span>Gemini Free</span>
                </button>
              </div>

              {/* Solar API Key Settings Trigger Button */}
              <button
                type="button"
                onClick={() => setShowSolarKeyModal(true)}
                className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1 ${
                  solarConfig.isConfigured
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                    : "bg-rose-500/10 text-rose-600 border-rose-500/30 animate-pulse hover:bg-rose-500/20"
                }`}
                title={solarConfig.isConfigured ? "Kunci Upstage Solar Pro Aktif (Klik untuk melihat status)" : "Kunci Solar belum diatur! Klik untuk melihat status server"}
              >
                <LucideIcons.Key className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px] font-semibold">
                  {solarConfig.isConfigured ? "Key Aktif" : "Status Server"}
                </span>
              </button>

              {quotaState.mode === "ECONOMY" && aiEngine === "gemini" && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  Economy
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Link to Solar Audit Workspace */}
            <button
              onClick={() => {
                setIsOpen(false);
                navigate("/solar-audit");
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
              title="Buka Workspace Deteksi Kesalahan & Cek Dokumen Solar Pro"
            >
              <LucideIcons.FileSearch className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cek Dokumen & Error</span>
            </button>

            {/* Project Context Selector */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <LucideIcons.FolderGit2 className="w-3.5 h-3.5 shrink-0" />
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium max-w-[160px] truncate cursor-pointer"
              >
                <option value="">🌐 Semua Proyek (Global)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectCode} - {p.projectName}
                  </option>
                ))}
              </select>
            </div>

            {conversationHistory.length > 0 && (
              <button
                onClick={clearConversation}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Bersihkan Percakapan"
              >
                <LucideIcons.Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Tutup (Esc)"
              aria-label="Tutup Dialog"
            >
              <LucideIcons.X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quota Lock Alert Banner for Gemini */}
        {isLocked && aiEngine === "gemini" && (
          <div className="px-5 py-3 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between gap-3 text-xs text-rose-700 dark:text-rose-300">
            <div className="flex items-center gap-2">
              <LucideIcons.Lock className="w-4 h-4 shrink-0" />
              <div>
                <strong>Kuota Gemini Free-Tier Habis: </strong>
                {quotaState.reason || "Batas kuota gratis provider sedang habis."}
              </div>
            </div>
            <button
              onClick={() => setAiEngine("solar")}
              className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-bold text-[11px] shrink-0 flex items-center gap-1 hover:bg-amber-600 transition-colors"
            >
              <LucideIcons.Sparkles className="w-3 h-3" />
              Gunakan Solar 4 Pro
            </button>
          </div>
        )}

        {/* Unconfigured Solar Key Notice */}
        {aiEngine === "solar" && !solarConfig.isConfigured && (
          <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <LucideIcons.AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>API Key Upstage Solar belum diatur.</strong> Minta operator mengatur kunci dan batas biaya pada server sebelum memakai AI.
              </span>
            </div>
            <button
              onClick={() => setShowSolarKeyModal(true)}
              className="px-2.5 py-1 rounded-md bg-amber-500 text-white font-bold hover:bg-amber-600 shrink-0 text-[11px] cursor-pointer"
            >
              Masukkan Kunci
            </button>
          </div>
        )}

        {/* Solar API Key Setup Modal Dialog */}
        {showSolarKeyModal && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 cursor-pointer"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                e.preventDefault();
                e.stopPropagation();
                setShowSolarKeyModal(false);
              }
            }}
          >
            <div
              className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl p-5 space-y-4 cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center">
                    <LucideIcons.Key className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-sm text-[var(--color-text-primary)]">
                    Konfigurasi Upstage Solar 4 Pro
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSolarKeyModal(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title="Tutup (Esc)"
                  aria-label="Tutup Dialog Kunci"
                >
                  <LucideIcons.X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Kunci dan batas biaya diatur operator pada environment server. Jangan masukkan kunci ke browser. Portal operator:{" "}
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
                    API Key Upstage Solar
                  </label>
                  <div className="relative">
                    <input
                      type={showKeySecret ? "text" : "password"}
                      value={solarKeyInput}
                      readOnly
                      placeholder="up_xxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full pl-3 pr-10 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeySecret(!showKeySecret)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showKeySecret ? (
                        <LucideIcons.EyeOff className="w-4 h-4" />
                      ) : (
                        <LucideIcons.Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pilihan Model Upstage
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      disabled title="Model ditentukan konfigurasi server"
                      className={`p-2.5 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${
                        solarModelSelect === "solar-pro"
                          ? "border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                          : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="font-bold flex items-center gap-1">
                        <LucideIcons.Cpu className="w-3.5 h-3.5" /> Solar Pro
                      </span>
                      <span className="text-[10px] text-slate-500">Penalaran & akurasi tinggi</span>
                    </button>
                    <button
                      type="button"
                      disabled title="Model ditentukan konfigurasi server"
                      className={`p-2.5 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${
                        solarModelSelect === "solar-mini"
                          ? "border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                          : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="font-bold flex items-center gap-1">
                        <LucideIcons.Zap className="w-3.5 h-3.5" /> Solar Mini
                      </span>
                      <span className="text-[10px] text-slate-500">Respon kilat & ringan</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSolarKeyModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveSolarKey}
                  disabled={isValidatingKey}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white shadow-xs cursor-pointer"
                >
                  {isValidatingKey ? (
                    <>
                      <LucideIcons.Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Memvalidasi...</span>
                    </>
                  ) : (
                    <>
                      <LucideIcons.CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Muat ulang status</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Conversation / Results Body */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-5 space-y-6 min-h-[300px] max-h-[55vh]"
        >
          {conversationHistory.length === 0 && !isAnalyzing ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-xs border border-blue-100 dark:border-blue-900/50">
                <LucideIcons.Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  MDrawing AI Assistant
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                  Asisten analitis proaktif untuk jadwal gambar, metrik keuangan, dan mitigasi risiko proyek. 100% Free-Tier Zero-Billing.
                </p>
              </div>

              {/* Quick Prompts Cloud */}
              <div className="pt-2 max-w-xl mx-auto">
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">
                  Pertanyaan Cepat Rekomendasi
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {QUICK_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      disabled={isLocked}
                      onClick={() => handleSend(prompt)}
                      className="px-3 py-1.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 transition-all text-left disabled:opacity-50 cursor-pointer shadow-2xs"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {conversationHistory.map((item, idx) => (
                <div key={idx} className="space-y-4">
                  {/* User Query Bubble */}
                  <div className="flex justify-end">
                    <div className="max-w-xl bg-blue-600 text-white rounded-2xl rounded-tr-xs px-4 py-2.5 text-xs shadow-xs font-medium leading-relaxed">
                      {item.prompt}
                    </div>
                  </div>

                  {/* AI Structured Response */}
                  <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                    {/* Header Bar */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <LucideIcons.Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">MDrawing AI</span>
                        <span>•</span>
                        <span>{item.response.modelUsed}</span>
                        <span>•</span>
                        <span>{item.response.latencyMs}ms</span>
                      </div>
                      <button
                        onClick={() =>
                          handleCopy(
                            `ANALISIS MDRAWING AI:\n\nFAKTA:\n${item.response.facts.map((f) => `- ${f}`).join("\n")}\n\nANALISIS:\n${item.response.analysis}\n\nRISIKO:\n${item.response.risks.map((r) => `- ${r}`).join("\n")}\n\nREKOMENDASI:\n${item.response.recommendations.map((rc) => `- ${rc}`).join("\n")}`
                          )
                        }
                        className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 transition-colors p-1"
                        title="Salin Analisis"
                      >
                        <LucideIcons.Copy className="w-3.5 h-3.5" />
                        <span>Salin</span>
                      </button>
                    </div>

                    {/* Section 1: FACTS */}
                    {item.response.facts.length > 0 && (
                      <div className="space-y-1.5">
                        <h5 className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                          <LucideIcons.CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          Fakta Terverifikasi
                        </h5>
                        <ul className="space-y-1 pl-1">
                          {item.response.facts.map((fact, fIdx) => (
                            <li key={fIdx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                              <span>{fact}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Section 2: ANALYSIS */}
                    {item.response.analysis && (
                      <div className="space-y-1.5 pt-1">
                        <h5 className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                          <LucideIcons.FileText className="w-3.5 h-3.5 text-blue-500" />
                          Uraian Analisis
                        </h5>
                        <p className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-line">
                          {item.response.analysis}
                        </p>
                      </div>
                    )}

                    {/* Section 3: RISKS */}
                    {item.response.risks.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <h5 className="text-[11px] font-bold tracking-wider text-rose-600 dark:text-rose-400 uppercase flex items-center gap-1.5">
                          <LucideIcons.AlertTriangle className="w-3.5 h-3.5" />
                          Identifikasi Risiko
                        </h5>
                        <div className="grid gap-1.5">
                          {item.response.risks.map((risk, rIdx) => (
                            <div
                              key={rIdx}
                              className="text-xs p-2 rounded-xl bg-rose-500/10 text-rose-800 dark:text-rose-200 border border-rose-500/20 flex items-start gap-2"
                            >
                              <LucideIcons.AlertCircle className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
                              <span>{risk}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Section 4: RECOMMENDATIONS */}
                    {item.response.recommendations.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <h5 className="text-[11px] font-bold tracking-wider text-blue-600 dark:text-blue-400 uppercase flex items-center gap-1.5">
                          <LucideIcons.ArrowRightCircle className="w-3.5 h-3.5" />
                          Rekomendasi Langkah Aksi
                        </h5>
                        <ul className="space-y-1 pl-1">
                          {item.response.recommendations.map((rec, rcIdx) => (
                            <li key={rcIdx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {isAnalyzing && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <LucideIcons.Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Menganalisis data deterministik proyek dengan model Free-Tier...
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Pending Tool Action Confirmation Box */}
          {pendingConfirmation && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <LucideIcons.AlertCircle className="w-5 h-5 shrink-0" />
                <h5 className="font-bold text-sm">{pendingConfirmation.details.actionTitle}</h5>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                {pendingConfirmation.details.actionDescription}
              </p>
              <div className="p-2.5 rounded-xl bg-white/60 dark:bg-black/30 text-[11px] text-slate-600 dark:text-slate-300">
                <strong>Dampak:</strong> {pendingConfirmation.details.impactSummary}
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={cancelPendingAction}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleExecutePending}
                  disabled={isConfirmingTool}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-xs flex items-center gap-1.5"
                >
                  {isConfirmingTool && <LucideIcons.Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Setujui & Jalankan
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar Footer */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={promptInput}
                disabled={isLocked || isAnalyzing}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder={
                  isLocked
                    ? "Fitur AI terkunci (kuota habis)..."
                    : "Tanyakan analisis proyek, jadwal gambar, atau status keuangan (Enter)..."
                }
                className="w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50 shadow-2xs"
              />
              {promptInput && (
                <button
                  type="button"
                  onClick={() => setPromptInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  <LucideIcons.X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={!promptInput.trim() || isAnalyzing || isLocked}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <LucideIcons.Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LucideIcons.Send className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Kirim</span>
            </button>
          </form>

          {/* Quick chips below input when conversation is active */}
          {conversationHistory.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pt-2.5 pb-0.5 text-[11px]">
              <span className="text-slate-400 shrink-0">Lanjutan:</span>
              {QUICK_PROMPTS.slice(0, 4).map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(q)}
                  disabled={isLocked || isAnalyzing}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 shrink-0 whitespace-nowrap transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
