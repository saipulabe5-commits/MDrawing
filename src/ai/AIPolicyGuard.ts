import {
  DEFAULT_AI_CONFIG,
  NON_NEGOTIABLE_ZERO_BILLING,
  PERMITTED_FREE_TIER_MODELS,
  PROHIBITED_PAID_MODELS,
} from "./AIConfig";
import { AIConfig, AIStatus } from "./types";
import { AppUser } from "../types";
import { canAccessProject, hasCapability, Capability } from "../security/authorization";

export interface PolicyValidationResult {
  valid: boolean;
  status: AIStatus;
  reason?: string;
  sanitizedModel?: string;
}

export class AIPolicyGuard {
  private config: AIConfig;

  constructor(customConfig?: Partial<AIConfig>) {
    this.config = { ...DEFAULT_AI_CONFIG, ...customConfig };
  }

  /**
   * Evaluates if configuration strictly conforms to the Free-Tier & Zero-Billing Policy.
   * If any paid flags, costs, or prohibited models are present, it fails closed with BILLING_BLOCKED.
   */
  public validateZeroBillingPolicy(modelOverride?: string): PolicyValidationResult {
    // 1. Non-negotiable cost & budget guards
    if (
      this.config.allowPaid !== false ||
      this.config.allowBillingUpgrade !== false ||
      this.config.allowPaidFallback !== false ||
      this.config.maxAiCost > 0 ||
      this.config.maxAiBudget > 0 ||
      !this.config.freeOnly
    ) {
      return {
        valid: false,
        status: "BILLING_BLOCKED",
        reason: "MDrawing AI dikunci karena konfigurasi terdeteksi melanggar kebijakan Free-Tier Zero-Billing.",
      };
    }

    const targetModel = modelOverride || this.config.model;

    // 2. Prohibited model check
    if (
      PROHIBITED_PAID_MODELS.some(
        (paid) => targetModel.toLowerCase().includes(paid.toLowerCase())
      )
    ) {
      return {
        valid: false,
        status: "BILLING_BLOCKED",
        reason: `Model '${targetModel}' adalah model berbayar dan tidak diizinkan dalam kebijakan Zero-Billing MDrawing.`,
      };
    }

    // 3. Permitted model whitelist check
    const isPermitted = PERMITTED_FREE_TIER_MODELS.some(
      (perm) => perm.toLowerCase() === targetModel.toLowerCase()
    );

    if (!isPermitted) {
      return {
        valid: false,
        status: "CONFIG_ERROR",
        reason: `Model '${targetModel}' tidak termasuk dalam daftar model Free Tier yang diverifikasi untuk MDrawing.`,
      };
    }

    return {
      valid: true,
      status: "READY",
      sanitizedModel: targetModel,
    };
  }

  /**
   * Validates user RBAC and project boundary for an AI query or action.
   */
  public validateUserAuthorization(
    user: AppUser | null,
    requiredCapability?: Capability,
    targetProjectId?: string
  ): { authorized: boolean; reason?: string } {
    if (!user || !user.isActive) {
      return {
        authorized: false,
        reason: "Pengguna tidak aktif atau sesi telah berakhir.",
      };
    }

    // Project scope boundary
    if (targetProjectId && !canAccessProject(user, targetProjectId)) {
      return {
        authorized: false,
        reason: `Akses ditolak: Anda tidak memiliki wewenang untuk melihat data pada proyek '${targetProjectId}'.`,
      };
    }

    // Granular capability check
    if (requiredCapability && !hasCapability(user, requiredCapability)) {
      return {
        authorized: false,
        reason: `Akses ditolak: Peran Anda (${user.role}) tidak memiliki wewenang '${requiredCapability}'.`,
      };
    }

    return { authorized: true };
  }

  /**
   * Sanitizes untrusted user prompt or document content against injection patterns.
   */
  public sanitizePrompt(input: string): { safePrompt: string; wasSanitized: boolean } {
    if (!input) return { safePrompt: "", wasSanitized: false };

    let safePrompt = input;
    let wasSanitized = false;

    // Injection detection patterns (case-insensitive)
    const dangerousPatterns = [
      /ignore\s+(all\s+)?(previous|prior)\s+instructions/gi,
      /you\s+are\s+now\s+in\s+developer\s+mode/gi,
      /bypass\s+(rbac|authorization|security|rules)/gi,
      /override\s+system\s+instructions/gi,
      /show\s+all\s+(projects|finances|credentials|secrets)/gi,
      /disable\s+(free\s+tier|zero\s+billing|quota\s+guard)/gi,
      /act\s+as\s+unrestricted\s+root/gi,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(safePrompt)) {
        wasSanitized = true;
        safePrompt = safePrompt.replace(pattern, "[KONTEN_TIDAK_TERPERCAYA_DINEGASI]");
      }
    }

    return { safePrompt, wasSanitized };
  }
}
