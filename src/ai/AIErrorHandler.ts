import { AIStatus } from "./types";

export interface HandledAIError {
  status: AIStatus;
  userMessage: string;
  isRetryable: boolean;
  retryAfterMs?: number;
  technicalCategory: string;
}

export class AIErrorHandler {
  /**
   * Sanitizes and maps raw API/network errors to friendly, zero-billing safe AI application states.
   */
  public static handle(error: any): HandledAIError {
    const rawMsg = (error?.message || String(error || "")).toLowerCase();
    const statusCode = error?.status || error?.statusCode || error?.code;

    // Check for offline / network failure first
    if (
      rawMsg.includes("network") ||
      rawMsg.includes("failed to fetch") ||
      rawMsg.includes("econnrefused") ||
      rawMsg.includes("enotfound") ||
      (typeof navigator !== "undefined" && !navigator.onLine)
    ) {
      return {
        status: "OFFLINE",
        userMessage: "Koneksi jaringan terputus. MDrawing AI sementara tidak dapat dihubungi.",
        isRetryable: true,
        technicalCategory: "NETWORK_OFFLINE",
      };
    }

    // Rate limits and quota exhaustion (HTTP 429 or RESOURCE_EXHAUSTED)
    if (
      statusCode === 429 ||
      rawMsg.includes("429") ||
      rawMsg.includes("resource_exhausted") ||
      rawMsg.includes("quota") ||
      rawMsg.includes("rate limit")
    ) {
      // Differentiate between daily quota exhaustion vs temporary RPM limit
      const isDailyExhausted =
        rawMsg.includes("daily") ||
        rawMsg.includes("per day") ||
        rawMsg.includes("free_tier_exhausted") ||
        rawMsg.includes("exhausted");

      if (isDailyExhausted) {
        return {
          status: "LOCKED",
          userMessage:
            "Kuota AI gratis sedang habis. Fitur AI akan aktif kembali setelah quota tersedia dari provider.",
          isRetryable: false,
          technicalCategory: "DAILY_FREE_QUOTA_EXHAUSTED",
        };
      }

      // Check if retry-after is suggested (default to 10 seconds if not provided)
      let retryAfterMs = 10000;
      if (error?.retryAfter) {
        retryAfterMs = Number(error.retryAfter) * 1000;
      }

      return {
        status: "RATE_LIMITED",
        userMessage:
          "Batas kecepatan request per menit (RPM) tercapai. Menunggu jeda sesaat secara otomatis.",
        isRetryable: true,
        retryAfterMs,
        technicalCategory: "RPM_RATE_LIMITED",
      };
    }

    // Billing detection / paid model refusal (HTTP 403 or Billing blocked)
    if (
      statusCode === 403 ||
      rawMsg.includes("billing") ||
      rawMsg.includes("paid tier") ||
      rawMsg.includes("enable billing")
    ) {
      return {
        status: "BILLING_BLOCKED",
        userMessage:
          "MDrawing AI dikunci karena konfigurasi terdeteksi memerlukan billing atau model berbayar. Sesuai kebijakan Zero-Billing, request ditolak.",
        isRetryable: false,
        technicalCategory: "BILLING_DETECTED",
      };
    }

    // Authentication failure (HTTP 401)
    if (statusCode === 401 || rawMsg.includes("api key") || rawMsg.includes("unauthenticated")) {
      return {
        status: "CONFIG_ERROR",
        userMessage:
          "Konfigurasi API AI tidak valid atau belum diatur. Fitur AI tidak dapat dijalankan.",
        isRetryable: false,
        technicalCategory: "AUTH_CONFIG_INVALID",
      };
    }

    // Server error (HTTP 500 / 503)
    if (statusCode === 500 || statusCode === 503 || rawMsg.includes("overloaded") || rawMsg.includes("internal")) {
      return {
        status: "ERROR",
        userMessage: "Layanan server AI sedang sibuk atau mengalami kendala sesaat. Silakan coba kembali nanti.",
        isRetryable: true,
        retryAfterMs: 5000,
        technicalCategory: "PROVIDER_SERVER_ERROR",
      };
    }

    // General fallback
    return {
      status: "ERROR",
      userMessage: "Terjadi kesalahan saat memproses permintaan AI. Fitur non-AI MDrawing tetap berfungsi normal.",
      isRetryable: false,
      technicalCategory: "UNKNOWN_AI_ERROR",
    };
  }
}
