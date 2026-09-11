import { AIConfig } from "./types";

/**
 * NON-NEGOTIABLE ZERO-BILLING CONFIGURATION FOR MDRAWING
 * 
 * Strict Principle:
 * MDrawing is a private/internal productivity system.
 * AI MUST BE 100% FREE-TIER ONLY. ZERO PAID UPGRADE, ZERO CLOUD BILLING.
 */
export const NON_NEGOTIABLE_ZERO_BILLING = {
  AI_BILLING_MODE: "FREE_ONLY" as const,
  ALLOW_PAID_AI: false as const,
  ALLOW_BILLING_UPGRADE: false as const,
  ALLOW_PAID_MODEL_FALLBACK: false as const,
  MAX_AI_COST: 0 as const,
  MAX_AI_BUDGET: 0 as const,
};

/**
 * Whitelist of permitted free-tier models.
 * Any model requiring a paid project or billing is strictly rejected.
 */
export const PERMITTED_FREE_TIER_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
] as const;

/**
 * Models explicitly marked as PAID or billing-required in official guidelines.
 * Attempting to configure or invoke these will trigger BILLING_BLOCKED.
 */
export const PROHIBITED_PAID_MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3-pro-image",
  "gemini-3.1-flash-image",
  "gemini-3.1-flash-lite-image",
  "veo-3.1-generate-preview",
  "veo-3.1-lite-generate-preview",
  "lyria-3-clip-preview",
  "lyria-3-pro-preview",
  "gemini-1.5-pro",
  "gemini-2.0-pro",
] as const;

export const DEFAULT_AI_CONFIG: AIConfig = {
  enabled: true,
  freeOnly: true,
  allowPaid: false,
  allowBillingUpgrade: false,
  allowPaidFallback: false,
  maxAiCost: 0,
  maxAiBudget: 0,
  model: "gemini-3.8-flash",
  fallbackModel: "gemini-3.1-flash-lite",
  maxOutputTokens: 1024,
  economyMaxOutputTokens: 512,
  maxContextTokens: 4000,
  maxRequestsPerSession: 40,
  maxDailyLocalRequests: 200,
  warningThresholdPercent: 75,
  economyModeThresholdPercent: 85,
  retryPolicy: {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 15000,
    backoffMultiplier: 2,
  },
};
