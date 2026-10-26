import { AIQuotaManager } from "./AIQuotaManager";
import { AIPolicyGuard } from "./AIPolicyGuard";
import { AIErrorHandler } from "./AIErrorHandler";
import { AIContextBuilder, AIProjectContextData } from "./AIContextBuilder";
import { StructuredAIResponse } from "./types";
import { AppUser } from "../types";
import { auth } from "../lib/firebase";

interface CachedEntry {
  response: StructuredAIResponse;
  timestamp: number;
}

export class AIClient {
  private quotaManager: AIQuotaManager;
  private policyGuard: AIPolicyGuard;
  private cache: Map<string, CachedEntry> = new Map();
  private readonly CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes cache for identical queries

  constructor(quotaManager: AIQuotaManager, policyGuard?: AIPolicyGuard) {
    this.quotaManager = quotaManager;
    this.policyGuard = policyGuard || new AIPolicyGuard(this.quotaManager.getConfig());
  }

  /**
   * Executes an AI command through the client-side protective pipeline to the secure server proxy.
   */
  public async executeCommand(
    user: AppUser | null,
    prompt: string,
    contextData: AIProjectContextData = {}
  ): Promise<StructuredAIResponse> {
    const startTime = Date.now();

    // 1. Quota & Zero-Billing Policy Pre-Check (FAIL-FAST)
    const canRequest = this.quotaManager.checkCanRequest();
    if (!canRequest.allowed) {
      return {
        requestId: `blocked_${Date.now()}`,
        status: canRequest.status,
        facts: ["Permintaan dibatalkan oleh AI Quota Manager."],
        analysis: canRequest.reason || "Fitur AI saat ini tidak dapat memproses permintaan.",
        risks: ["Kebijakan perlindungan kuota free-tier aktif."],
        recommendations: [
          canRequest.status === "LOCKED"
            ? "Tunggu hingga kuota gratis dari provider tersedia kembali."
            : "Periksa konfigurasi atau koneksi jaringan Anda.",
        ],
        modelUsed: this.quotaManager.getState().model,
        latencyMs: 0,
        timestamp: new Date().toISOString(),
      };
    }

    // 2. Input sanitization & injection guard
    const { safePrompt } = this.policyGuard.sanitizePrompt(prompt);

    // 3. User & Project Authorization Validation
    const authCheck = this.policyGuard.validateUserAuthorization(
      user,
      undefined,
      contextData.project?.id
    );
    if (!authCheck.authorized) {
      return {
        requestId: `unauth_${Date.now()}`,
        status: "ERROR",
        facts: ["Akses ditolak oleh Security Guard."],
        analysis: authCheck.reason || "Anda tidak memiliki wewenang untuk melihat data ini.",
        risks: ["Pelanggaran batas akses otorisasi dicegah."],
        recommendations: ["Hubungi Project Owner jika Anda memerlukan akses ke data proyek ini."],
        modelUsed: this.quotaManager.getState().model,
        latencyMs: 0,
        timestamp: new Date().toISOString(),
      };
    }

    // 4. Cache check (exact prompt + project + role)
    const cacheKey = `${user?.role}_${contextData.project?.id || "global"}_${safePrompt.trim().toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.response;
    }

    // 5. Build minimal deterministic grounded context
    const { contextString } = AIContextBuilder.buildContext(
      user,
      contextData,
      canRequest.mode
    );

    // 6. Obtain Firebase Auth token
    let idToken = "";
    try {
      if (auth.currentUser) {
        idToken = await auth.currentUser.getIdToken();
      }
    } catch (e) {
      console.warn("[AIClient] Failed to get current user idToken:", e);
    }

    // 7. Network request to secure server-side proxy
    try {
      const response = await fetch("/api/ai/command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          prompt: safePrompt,
          contextString,
          mode: canRequest.mode,
          projectId: contextData.project?.id,
          model: this.quotaManager.getState().model,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const handledError = AIErrorHandler.handle({
          status: response.status,
          message: data?.error || data?.message || "Server AI request failed",
          retryAfter: data?.retryAfter,
        });

        this.quotaManager.setStatus(
          handledError.status,
          handledError.userMessage,
          handledError.retryAfterMs
        );

        return {
          requestId: `err_${Date.now()}`,
          status: handledError.status,
          facts: ["Permintaan gagal diproses oleh server."],
          analysis: handledError.userMessage,
          risks: ["Terjadi kendala pada komunikasi dengan model AI."],
          recommendations: [
            handledError.isRetryable
              ? "Coba beberapa saat lagi."
              : "Gunakan data proyek manual pada menu MDrawing.",
          ],
          modelUsed: this.quotaManager.getState().model,
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
      }

      // Success
      const latencyMs = Date.now() - startTime;
      const usage = data.usageMetadata || {};
      this.quotaManager.recordSuccess(
        usage.promptTokenCount || 0,
        usage.candidatesTokenCount || 0,
        latencyMs
      );

      const structuredResponse: StructuredAIResponse = {
        requestId: data.requestId || `resp_${Date.now()}`,
        status: "READY",
        facts: Array.isArray(data.facts) ? data.facts : [],
        analysis: data.analysis || data.rawText || "",
        risks: Array.isArray(data.risks) ? data.risks : [],
        recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
        rawText: data.rawText,
        suggestedTools: data.suggestedTools || [],
        usageMetadata: usage,
        modelUsed: data.modelUsed || this.quotaManager.getState().model,
        latencyMs,
        timestamp: new Date().toISOString(),
      };

      // Save to cache
      this.cache.set(cacheKey, {
        response: structuredResponse,
        timestamp: Date.now(),
      });

      return structuredResponse;
    } catch (networkErr: any) {
      const handled = AIErrorHandler.handle(networkErr);
      this.quotaManager.setStatus(handled.status, handled.userMessage, handled.retryAfterMs);

      return {
        requestId: `net_err_${Date.now()}`,
        status: handled.status,
        facts: ["Gagal menghubungkan ke server."],
        analysis: handled.userMessage,
        risks: ["Koneksi jaringan terputus atau server tidak merespons."],
        recommendations: ["Periksa koneksi internet Anda."],
        modelUsed: this.quotaManager.getState().model,
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
