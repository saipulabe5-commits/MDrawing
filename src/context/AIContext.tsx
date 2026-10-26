import { apiRequest } from '../lib/commandClient';
import { hasCapability } from '../security/authorization';
import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { AIQuotaManager } from "../ai/AIQuotaManager";
import { AIClient } from "../ai/AIClient";
import { AIToolRouter } from "../ai/AIToolRouter";
import {
  AIQuotaState,
  StructuredAIResponse,
  AIToolExecutionRequest,
  AIToolExecutionResult,
} from "../ai/types";
import { AIProjectContextData } from "../ai/AIContextBuilder";
import { useAuth } from "./AuthContext";
import { SolarAiService } from "../services/solarAiService";

interface PendingToolConfirmation {
  request: AIToolExecutionRequest;
  details: {
    actionTitle: string;
    actionDescription: string;
    impactSummary: string;
    parameters: Record<string, any>;
  };
}

interface AIContextValue {
  quotaState: AIQuotaState;
  aiEngine: "solar" | "gemini";
  setAiEngine: (engine: "solar" | "gemini") => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;
  isAnalyzing: boolean;
  lastResponse: StructuredAIResponse | null;
  conversationHistory: Array<{ prompt: string; response: StructuredAIResponse }>;
  pendingConfirmation: PendingToolConfirmation | null;
  executeCommand: (
    prompt: string,
    contextData?: AIProjectContextData,
    forceEngine?: "solar" | "gemini"
  ) => Promise<StructuredAIResponse>;
  confirmPendingAction: () => Promise<AIToolExecutionResult | null>;
  cancelPendingAction: () => void;
  manualRetryQuota: () => boolean;
  clearConversation: () => void;
}

const AIContext = createContext<AIContextValue | undefined>(undefined);

export const AIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { appUser } = useAuth();
  const quotaManager = useMemo(() => new AIQuotaManager(), []);
  const aiClient = useMemo(() => new AIClient(quotaManager), [quotaManager]);
  const toolRouter = useMemo(() => new AIToolRouter(), []);

  const [quotaState, setQuotaState] = useState<AIQuotaState>(quotaManager.getState());
  const [aiEngine, setAiEngine] = useState<"solar" | "gemini">(() => {
    const cfg = SolarAiService.getConfig();
    return cfg.isConfigured ? "solar" : "solar"; // Default to Solar as user explicitly wants Solar 4 Pro
  });
  const [isOpen, setIsOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastResponse, setLastResponse] = useState<StructuredAIResponse | null>(null);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ prompt: string; response: StructuredAIResponse }>
  >([]);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingToolConfirmation | null>(null);

  // Subscribe to AIQuotaManager state changes
  useEffect(() => {
    const unsubscribe = quotaManager.subscribe((newState) => {
      setQuotaState(newState);
    });
    return () => unsubscribe();
  }, [quotaManager]);

  // Global Keyboard shortcut: Cmd+K, Ctrl+K, and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const executeCommand = useCallback(
    async (
      prompt: string,
      contextData: AIProjectContextData = {},
      forceEngine?: "solar" | "gemini"
    ): Promise<StructuredAIResponse> => {
      const activeEngine = forceEngine || aiEngine;
      setIsAnalyzing(true);

      try {
        if (activeEngine === "solar") {
          const solarCfg = SolarAiService.getConfig();
          const startTime = Date.now();

          // Build rich, real-time grounded context string
          let contextStr = "";
          const now = new Date();

          if (contextData?.project) {
            contextStr += `[DATA PROYEK AKTIF]\n`;
            contextStr += `Nama Proyek: ${contextData.project.projectName} (${contextData.project.projectCode})\n`;
            contextStr += `Status Proyek: ${contextData.project.status}\n`;
            if (contextData.project.targetDate) contextStr += `Target Selesai Proyek: ${contextData.project.targetDate}\n`;
            if (contextData.project.contractValue) contextStr += `Nilai Kontrak: Rp ${contextData.project.contractValue.toLocaleString("id-ID")}\n`;
          }

          if (contextData?.drawings && contextData.drawings.length > 0) {
            const activeDrawings = contextData.drawings.filter((d) => !d.isDeleted);
            const overdueDrawings = activeDrawings.filter(
              (d) => d.deadline && new Date(d.deadline) < now && d.status !== "Selesai"
            );

            // Group overdue by Drafter / PIC
            const overdueByDrafter: Record<string, typeof contextData.drawings> = {};
            for (const item of overdueDrawings) {
              const pic = item.picName || "Belum Ditugaskan";
              if (!overdueByDrafter[pic]) overdueByDrafter[pic] = [];
              overdueByDrafter[pic].push(item);
            }

            contextStr += `\n[DATA REAL-TIME LEMBAR GAMBAR & TIM DRAFTER]\n`;
            contextStr += `• Total Lembar Gambar Aktif: ${activeDrawings.length}\n`;
            contextStr += `• Gambar Selesai / Disetujui: ${activeDrawings.filter((d) => d.status === "Selesai").length}\n`;
            contextStr += `• Gambar Overdue (Terlambat): ${overdueDrawings.length}\n`;

            if (overdueDrawings.length > 0) {
              contextStr += `\n[DAFTAR DRAFTER DENGAN GAMBAR OVERDUE/TERLAMBAT]:\n`;
              for (const [drafter, list] of Object.entries(overdueByDrafter)) {
                contextStr += `► Drafter/PIC "${drafter}" memiliki ${list.length} drawing yang melewati tenggat:\n`;
                list.forEach((item) => {
                  const daysOverdue = Math.max(
                    0,
                    Math.floor((now.getTime() - new Date(item.deadline!).getTime()) / (1000 * 60 * 60 * 24))
                  );
                  contextStr += `   - No: ${item.drawingNumber} | Judul: "${item.drawingName}" | Status: ${item.status} | Deadline: ${item.deadline} (${daysOverdue} hari terlambat) | Revisi ke-${item.revisionCount || 0} | Prioritas: ${item.priority || "Normal"}\n`;
                });
              }
            } else {
              contextStr += `\n[STATUS OVERDUE]: Saat ini TIDAK ADA gambar yang berstatus overdue. Seluruh drawing berjalan sesuai jadwal.\n`;
            }

            // Overview of all drawings
            contextStr += `\n[DAFTAR RINGKAS SELURUH LEMBAR GAMBAR CAD]:\n`;
            activeDrawings.slice(0, 30).forEach((d) => {
              const isOverdue = d.deadline && new Date(d.deadline) < now && d.status !== "Selesai";
              contextStr += `• ${d.drawingNumber}: "${d.drawingName}" | PIC: ${d.picName || "Belum Ditugaskan"} | Status: ${d.status} | Target: ${d.deadline || "-"} ${isOverdue ? "[OVERDUE]" : ""}\n`;
            });
          }

          if (contextData?.invoices && contextData.invoices.length > 0) {
            const totalInv = contextData.invoices.reduce((acc, i) => acc + (i.grandTotal || i.subTotal || 0), 0);
            contextStr += `\n[DATA FINANSIAL / INVOICE]: Total Ditagihkan Rp ${totalInv.toLocaleString("id-ID")}\n`;
          }

          if (!solarCfg.isConfigured && !solarCfg.apiKey) {
            const resp: StructuredAIResponse = {
              requestId: `solar_unconfigured_${Date.now()}`,
              status: "LOCKED",
              facts: ["API Key Upstage Solar belum diatur di aplikasi."],
              analysis:
                "Untuk menggunakan model cerdas Upstage Solar 4 Pro dalam deteksi kesalahan, cek dokumen, dan asisten proyek, silakan masukkan API Key Anda pada menu Pengaturan > AI Upstage Solar Pro.",
              risks: ["Fitur Solar 4 Pro belum dapat terhubung ke server Upstage."],
              recommendations: [
                "Buka menu Pengaturan > AI Upstage Solar Pro.",
                "Masukkan API Key Upstage Solar Anda dan klik 'Simpan Konfigurasi'.",
              ],
              modelUsed: "solar-pro (kunci belum diatur)",
              latencyMs: 0,
              timestamp: new Date().toISOString(),
            };
            setLastResponse(resp);
            setConversationHistory((prev) => [...prev, { prompt, response: resp }]);
            return resp;
          }

          try {
            const solarRes = await SolarAiService.chatWithSolar({
              messages: [
                {
                  role: "system",
                  content:
                    "Anda adalah MDrawing AI Assistant spesialis Arsitektur, QA Gambar CAD, Deteksi Kesalahan, Cek Dokumen, dan Manajemen Proyek PT. Asa Perdana Mandiri yang ditenagai oleh Upstage Solar 4 Pro.\n\n" +
                    "ATURAN KRUSIAL:\n" +
                    "1. Anda hanya boleh memakai data yang diberikan, bukan mengasumsikan akses lengkap ke database real-time PT. Asa Perdana Mandiri melalui konteks data proyek dan gambar yang diberikan di bawah ini.\n" +
                    "2. Jika pengguna bertanya mengenai 'siapa yang punya drawing overdue', 'gambar yang terlambat', atau status drafter, sebutkan secara SPESIFIK dan EKSPLISIT:\n" +
                    "   - Nama Drafter / PIC yang memegang gambar overdue\n" +
                    "   - Nomor lembar gambar dan judul gambar (misal: AR-001, STR-005)\n" +
                    "   - Batas waktu (deadline) dan berapa hari keterlambatannya\n" +
                    "   - Status pengerjaan gambar saat ini\n" +
                    "   - Langkah koordinasi darurat dan rekomendasi mitigasi\n" +
                    "3. Nyatakan keterbatasan data yang tidak tersedia.\n" +
                    "4. Susun respon Anda secara profesional dan terstruktur: FAKTA, ANALISIS KESALAHAN/KONDISI, RISIKO, dan REKOMENDASI PERBAIKAN.",
                },
                {
                  role: "user",
                  content: `${contextStr ? `KONTEKS REAL-TIME DARI DATABASE APLIKASI:\n${contextStr}\n---\n` : ""}PERTANYAAN PENGGUNA:\n${prompt}`,
                },
              ],
              projectContext: contextData?.project,
            });

            const content = solarRes.content || "";
            const facts: string[] = [];
            const risks: string[] = [];
            const recs: string[] = [];

            // Simple heuristic to extract bullet points if present
            const lines = content.split("\n");
            let currentSection = "analysis";

            for (const line of lines) {
              const trimmed = line.trim();
              const lower = trimmed.toLowerCase();
              if (lower.includes("fakta:") || lower.includes("**fakta")) {
                currentSection = "facts";
              } else if (lower.includes("risiko:") || lower.includes("**risiko")) {
                currentSection = "risks";
              } else if (lower.includes("rekomendasi:") || lower.includes("**rekomendasi")) {
                currentSection = "recs";
              } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\./.test(trimmed)) {
                const item = trimmed.replace(/^[-*\d.]+\s*/, "");
                if (currentSection === "facts" && item.length > 5) facts.push(item);
                if (currentSection === "risks" && item.length > 5) risks.push(item);
                if (currentSection === "recs" && item.length > 5) recs.push(item);
              }
            }

            const structuredResponse: StructuredAIResponse = {
              requestId: `solar_${Date.now()}`,
              status: "READY",
              facts: facts.length > 0 ? facts : ["Dianalisis secara mendalam menggunakan model penalaran Upstage Solar 4 Pro."],
              analysis: content,
              risks: risks.length > 0 ? risks : [],
              recommendations: recs.length > 0 ? recs : ["Tinjau temuan di atas bersama Tim Teknis atau Project Owner."],
              modelUsed: solarRes.model || "solar-pro",
              latencyMs: solarRes.latencyMs || Date.now() - startTime,
              timestamp: new Date().toISOString(),
            };

            setLastResponse(structuredResponse);
            setConversationHistory((prev) => [...prev, { prompt, response: structuredResponse }]);
            return structuredResponse;
          } catch (solarErr: any) {
            const errResp: StructuredAIResponse = {
              requestId: `solar_err_${Date.now()}`,
              status: "ERROR",
              facts: ["Gagal memproses permintaan melalui Upstage Solar."],
              analysis: solarErr.message || "Koneksi ke API Upstage Solar mengalami kendala.",
              risks: ["Model AI tidak dapat merespons."],
              recommendations: [
                "Periksa koneksi internet Anda.",
                "Periksa kembali API Key Upstage Solar di menu Pengaturan.",
              ],
              modelUsed: "solar-pro",
              latencyMs: Date.now() - startTime,
              timestamp: new Date().toISOString(),
            };
            setLastResponse(errResp);
            setConversationHistory((prev) => [...prev, { prompt, response: errResp }]);
            return errResp;
          }
        }

        // Default Gemini Free-Tier execution
        const result = await aiClient.executeCommand(appUser, prompt, contextData);
        const suggested=(result.suggestedTools||[]).find((t:any)=>t.toolName==='updateDrawingStatus');
        if(suggested && contextData.project && hasCapability(appUser,'canUpdateDrawingStatus')){
          const params=(suggested as any).parameters||{};const drawing=contextData.drawings?.find(d=>d.id===params.drawingId);
          if(drawing && ['Belum Mulai','Proses','Review','Revisi','Selesai','Hold'].includes(params.newStatus)){
            const parameters={drawingId:drawing.id,projectId:contextData.project.id,newStatus:params.newStatus,expectedUpdatedAt:drawing.updatedAt,requestId:crypto.randomUUID()};
            setPendingConfirmation({request:{toolName:'updateDrawingStatus',parameters,confirmedByUser:false},details:{actionTitle:'Konfirmasi status gambar',actionDescription:drawing.drawingNumber+' → '+params.newStatus,impactSummary:'Status hanya berubah setelah server memeriksa izin dan versi terbaru.',parameters}});
          }
        }
        setLastResponse(result);
        setConversationHistory((prev) => [...prev, { prompt, response: result }]);
        return result;
      } finally {
        setIsAnalyzing(false);
      }
    },
    [aiClient, appUser, aiEngine]
  );

  const confirmPendingAction = useCallback(async():Promise<AIToolExecutionResult|null>=>{if(!pendingConfirmation)return null;try{const result=await apiRequest('/api/drawings/status',pendingConfirmation.request.parameters);setPendingConfirmation(null);return result;}catch(e:any){return{success:false,message:e.message};}},[pendingConfirmation]);

  const cancelPendingAction = useCallback(() => {
    setPendingConfirmation(null);
  }, []);

  const manualRetryQuota = useCallback(() => {
    return quotaManager.manualRetry();
  }, [quotaManager]);

  const clearConversation = useCallback(() => {
    setLastResponse(null);
    setConversationHistory([]);
  }, []);

  const value = useMemo(
    () => ({
      quotaState,
      aiEngine,
      setAiEngine,
      isOpen,
      setIsOpen,
      toggleOpen,
      isAnalyzing,
      lastResponse,
      conversationHistory,
      pendingConfirmation,
      executeCommand,
      confirmPendingAction,
      cancelPendingAction,
      manualRetryQuota,
      clearConversation,
    }),
    [
      quotaState,
      aiEngine,
      isOpen,
      toggleOpen,
      isAnalyzing,
      lastResponse,
      conversationHistory,
      pendingConfirmation,
      executeCommand,
      confirmPendingAction,
      cancelPendingAction,
      manualRetryQuota,
      clearConversation,
    ]
  );

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
};

export const useAI = (): AIContextValue => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error("useAI must be used within an AIProvider");
  }
  return context;
};
