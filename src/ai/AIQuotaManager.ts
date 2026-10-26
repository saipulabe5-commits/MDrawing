import { DEFAULT_AI_CONFIG } from "./AIConfig";
import { AIConfig, AIMode, AIQuotaState, AIStatus } from "./types";
import { AIUsageTracker } from "./AIUsageTracker";
import { AIPolicyGuard } from "./AIPolicyGuard";

export class AIQuotaManager {
  private config: AIConfig;
  private tracker: AIUsageTracker;
  private policyGuard: AIPolicyGuard;
  private state: AIQuotaState;
  private listeners: Set<(state: AIQuotaState) => void> = new Set();
  private rateLimitTimer: any = null;

  constructor(customConfig?: Partial<AIConfig>) {
    this.config = { ...DEFAULT_AI_CONFIG, ...customConfig };
    this.tracker = new AIUsageTracker();
    this.policyGuard = new AIPolicyGuard(this.config);

    // Initial state validation
    const policyCheck = this.policyGuard.validateZeroBillingPolicy();
    const initialStatus: AIStatus = !this.config.enabled
      ? "LOCKED"
      : !policyCheck.valid
      ? policyCheck.status
      : typeof navigator !== "undefined" && !navigator.onLine
      ? "OFFLINE"
      : "READY";

    this.state = {
      status: initialStatus,
      mode: "NORMAL",
      lockedAt: initialStatus === "LOCKED" || initialStatus === "BILLING_BLOCKED" ? new Date().toISOString() : null,
      reason: policyCheck.reason || null,
      retryAfterMs: null,
      model: this.config.model,
      sessionRequests: this.tracker.getSessionRequestCount(),
      dailyRequests: this.tracker.getDailyRequestCount(),
      estimatedTokens: this.tracker.getDailyTokenCount(),
      lastUpdated: new Date().toISOString(),
    };

    // Listen to window online/offline events if in browser
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleNetworkChange(true));
      window.addEventListener("offline", () => this.handleNetworkChange(false));
    }
  }

  public subscribe(listener: (state: AIQuotaState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(currentState);
      } catch (err) {
        console.error("[AIQuotaManager] Listener error:", err);
      }
    });
  }

  public getState(): AIQuotaState {
    return { ...this.state };
  }

  public getTracker(): AIUsageTracker {
    return this.tracker;
  }

  public getConfig(): AIConfig {
    return { ...this.config };
  }

  private handleNetworkChange(isOnline: boolean) {
    if (!isOnline) {
      this.setStatus("OFFLINE", "Koneksi jaringan terputus.");
    } else if (this.state.status === "OFFLINE") {
      this.setStatus("READY", null);
    }
  }

  /**
   * Evaluates if a new request is allowed to proceed under zero-billing policy and quota thresholds.
   */
  public checkCanRequest(): { allowed: boolean; status: AIStatus; reason?: string; mode: AIMode } {
    // 1. Check if AI is disabled or locked
    if (this.state.status === "LOCKED") {
      return {
        allowed: false,
        status: "LOCKED",
        reason: this.state.reason || "Kuota AI gratis sedang habis. Fitur AI akan aktif kembali setelah quota tersedia.",
        mode: "LOCKED",
      };
    }

    if (this.state.status === "BILLING_BLOCKED") {
      return {
        allowed: false,
        status: "BILLING_BLOCKED",
        reason: this.state.reason || "Fitur AI diblokir karena terdeteksi konfigurasi berbayar.",
        mode: "LOCKED",
      };
    }

    if (this.state.status === "CONFIG_ERROR") {
      return {
        allowed: false,
        status: "CONFIG_ERROR",
        reason: this.state.reason || "Konfigurasi AI tidak valid.",
        mode: "LOCKED",
      };
    }

    if (this.state.status === "OFFLINE") {
      return {
        allowed: false,
        status: "OFFLINE",
        reason: "Aplikasi sedang offline.",
        mode: "LOCKED",
      };
    }

    if (this.state.status === "RATE_LIMITED") {
      return {
        allowed: false,
        status: "RATE_LIMITED",
        reason: "Request rate limit (RPM) tercapai. Silakan tunggu beberapa detik.",
        mode: this.state.mode,
      };
    }

    // 2. Check local protective budgets
    const dailyRequests = this.tracker.getDailyRequestCount();
    const sessionRequests = this.tracker.getSessionRequestCount();

    if (dailyRequests >= this.config.maxDailyLocalRequests) {
      this.lockQuota("Batas request harian lokal tercapai untuk melindungi quota free-tier.");
      return {
        allowed: false,
        status: "LOCKED",
        reason: "Batas request harian lokal tercapai.",
        mode: "LOCKED",
      };
    }

    if (sessionRequests >= this.config.maxRequestsPerSession) {
      this.setStatus("WARNING", "Batas request sesi hampir tercapai. Mode hemat aktif.");
      this.setMode("ECONOMY");
    }

    // 3. Evaluate threshold-based mode transitions
    const dailyPercent = (dailyRequests / this.config.maxDailyLocalRequests) * 100;
    if (dailyPercent >= this.config.economyModeThresholdPercent) {
      this.setStatus("LIMITED", "Mode hemat aktif karena mendekati batas free-tier.");
      this.setMode("ECONOMY");
    } else if (dailyPercent >= this.config.warningThresholdPercent) {
      this.setStatus("WARNING", "Penggunaan AI mendekati ambang batas harian.");
    }

    return {
      allowed: true,
      status: this.state.status,
      mode: this.state.mode,
    };
  }

  public setStatus(status: AIStatus, reason: string | null = null, retryAfterMs: number | null = null) {
    this.state.status = status;
    this.state.reason = reason;
    this.state.retryAfterMs = retryAfterMs;
    this.state.lastUpdated = new Date().toISOString();

    if (status === "LOCKED") {
      this.state.mode = "LOCKED";
      this.state.lockedAt = new Date().toISOString();
    } else if (status === "RATE_LIMITED" && retryAfterMs) {
      // Clear any previous timer
      if (this.rateLimitTimer) clearTimeout(this.rateLimitTimer);
      this.rateLimitTimer = setTimeout(() => {
        this.recoverFromRateLimit();
      }, retryAfterMs);
    }

    this.notify();
  }

  public setMode(mode: AIMode) {
    this.state.mode = mode;
    this.state.lastUpdated = new Date().toISOString();
    this.notify();
  }

  public lockQuota(reason: string) {
    this.setStatus("LOCKED", reason);
  }

  public recoverFromRateLimit() {
    if (this.state.status === "RATE_LIMITED") {
      this.setStatus("READY", null);
    }
  }

  public manualRetry(): boolean {
    if (this.state.status === "BILLING_BLOCKED" || this.state.status === "CONFIG_ERROR") {
      const policyCheck = this.policyGuard.validateZeroBillingPolicy();
      if (!policyCheck.valid) {
        this.setStatus(policyCheck.status, policyCheck.reason);
        return false;
      }
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.setStatus("OFFLINE", "Koneksi jaringan terputus.");
      return false;
    }

    this.setStatus("READY", null);
    this.setMode("NORMAL");
    return true;
  }

  public recordSuccess(promptTokens: number = 0, candidatesTokens: number = 0, latencyMs: number = 0) {
    const totalTokens = promptTokens + candidatesTokens;
    this.tracker.recordUsage({
      timestamp: new Date().toISOString(),
      requestId: `req_${Date.now()}`,
      model: this.state.model,
      promptTokens,
      candidatesTokens,
      totalTokens,
      status: this.state.status,
      latencyMs,
      isEconomyMode: this.state.mode === "ECONOMY",
    });

    this.state.sessionRequests = this.tracker.getSessionRequestCount();
    this.state.dailyRequests = this.tracker.getDailyRequestCount();
    this.state.estimatedTokens = this.tracker.getDailyTokenCount();
    this.state.lastUpdated = new Date().toISOString();
    this.notify();
  }
}
