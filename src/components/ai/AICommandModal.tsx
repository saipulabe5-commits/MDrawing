import React, { useState, useEffect, useRef } from "react";
import * as LucideIcons from "lucide-react";
import { useAI } from "../../context/AIContext";
import { useProjects } from "../../context/ProjectContext";
import { useAuth } from "../../context/AuthContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { DrawingItem, Invoice, VendorBill } from "../../types";
import toast from "react-hot-toast";

const QUICK_PROMPTS = [
  "Apa kondisi proyek ini?",
  "Kenapa progress terlambat?",
  "Apa risiko terbesar?",
  "Kenapa profit turun?",
  "Siapa yang punya drawing overdue?",
  "Invoice mana yang perlu ditindaklanjuti?",
  "Vendor mana yang paling berisiko?",
  "Siapkan Owner Brief.",
  "Siapkan agenda meeting.",
  "Ringkas perubahan proyek sejak minggu lalu.",
];

export const AICommandModal: React.FC = () => {
  const {
    isOpen,
    setIsOpen,
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

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [promptInput, setPromptInput] = useState("");
  const [isConfirmingTool, setIsConfirmingTool] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Set default project if none selected and projects are available
  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

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

  if (!isOpen) return null;

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || promptInput).trim();
    if (!textToSend || isAnalyzing) return;

    if (quotaState.status === "LOCKED") {
      toast.error("Fitur AI terkunci karena kuota gratis habis.");
      return;
    }

    if (quotaState.status === "BILLING_BLOCKED") {
      toast.error("Fitur AI dinonaktifkan di bawah kebijakan Zero-Billing.");
      return;
    }

    setPromptInput("");

    // Fetch context data for the selected project
    let drawings: DrawingItem[] = [];
    let invoices: Invoice[] = [];
    let vendorBills: VendorBill[] = [];
    const targetProject = projects.find((p) => p.id === selectedProjectId) || null;

    if (selectedProjectId) {
      try {
        const dSnap = await getDocs(
          query(collection(db, "drawingItems"), where("projectId", "==", selectedProjectId))
        );
        drawings = dSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DrawingItem));

        if (appUser?.canViewFinance || appUser?.role === "OWNER" || appUser?.role === "ADMIN") {
          const iSnap = await getDocs(
            query(collection(db, "invoices"), where("projectId", "==", selectedProjectId))
          );
          invoices = iSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Invoice));

          const vSnap = await getDocs(
            query(collection(db, "vendorBills"), where("projectId", "==", selectedProjectId))
          );
          vendorBills = vSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as VendorBill));
        }
      } catch (err) {
        console.warn("[AICommandModal] Error pre-fetching project context:", err);
      }
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={() => setIsOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="MDrawing AI Command Center"
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800/90 rounded-2xl shadow-2xl overflow-hidden transition-all text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* macOS Style Window Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 shrink-0">
          <div className="flex items-center gap-3">
            {/* macOS traffic light visual dots */}
            <div className="flex items-center gap-1.5 mr-1">
              <button
                onClick={() => setIsOpen(false)}
                className="w-3 h-3 rounded-full bg-rose-500 hover:opacity-80 transition-opacity"
                title="Tutup (Esc)"
              />
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight">MDrawing AI</span>
              <span className="text-[11px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase">
                Free-Tier
              </span>
              {quotaState.mode === "ECONOMY" && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  Economy Mode
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Project Context Selector */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <LucideIcons.FolderGit2 className="w-3.5 h-3.5 shrink-0" />
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium max-w-[180px] truncate cursor-pointer"
              >
                <option value="">Semua Proyek (Global)</option>
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
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <LucideIcons.X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quota Lock Alert Banner */}
        {isLocked && (
          <div className="px-5 py-3 bg-rose-500/10 border-b border-rose-500/20 flex items-center gap-3 text-xs text-rose-700 dark:text-rose-300">
            <LucideIcons.Lock className="w-4 h-4 shrink-0" />
            <div className="flex-1">
              <strong>Fitur AI Sementara Terkunci: </strong>
              {quotaState.reason || "Batas kuota gratis provider sedang habis. Seluruh fitur utama MDrawing tetap berfungsi normal."}
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
