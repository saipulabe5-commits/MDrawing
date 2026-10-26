import { AppUser, CanonicalUserRole } from "../types";

export type AIStatus =
  | "READY"
  | "LIMITED"
  | "WARNING"
  | "LOCKED"
  | "RATE_LIMITED"
  | "ERROR"
  | "CONFIG_ERROR"
  | "BILLING_BLOCKED"
  | "OFFLINE";

export type AIMode = "NORMAL" | "ECONOMY" | "LOCKED";

export interface AIQuotaState {
  status: AIStatus;
  mode: AIMode;
  lockedAt: string | null;
  reason: string | null;
  retryAfterMs: number | null;
  model: string;
  sessionRequests: number;
  dailyRequests: number;
  estimatedTokens: number;
  lastUpdated: string;
}

export interface AIUsageRecord {
  timestamp: string;
  requestId: string;
  model: string;
  promptTokens?: number;
  candidatesTokens?: number;
  totalTokens?: number;
  status: AIStatus;
  toolInvoked?: string;
  latencyMs: number;
  isEconomyMode: boolean;
}

export interface AIConfig {
  enabled: boolean;
  freeOnly: boolean;
  allowPaid: boolean;
  allowBillingUpgrade: boolean;
  allowPaidFallback: boolean;
  maxAiCost: number;
  maxAiBudget: number;
  model: string;
  fallbackModel: string;
  maxOutputTokens: number;
  economyMaxOutputTokens: number;
  maxContextTokens: number;
  maxRequestsPerSession: number;
  maxDailyLocalRequests: number;
  warningThresholdPercent: number; // e.g. 75%
  economyModeThresholdPercent: number; // e.g. 85%
  retryPolicy: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
}

export interface StructuredAIResponse {
  requestId: string;
  status: AIStatus;
  facts: string[];
  analysis: string;
  risks: string[];
  recommendations: string[];
  rawText?: string;
  suggestedTools?: AIToolSuggestion[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  modelUsed: string;
  latencyMs: number;
  timestamp: string;
}

export interface AIToolSuggestion {
  toolName: string;
  actionName: string;
  isHighRisk: boolean;
  parameters: Record<string, any>;
  description: string;
}

export interface AIToolExecutionRequest {
  toolName: string;
  parameters: Record<string, any>;
  confirmedByUser?: boolean;
}

export interface AIToolExecutionResult {
  success: boolean;
  message: string;
  data?: any;
  requiresConfirmation?: boolean;
  confirmationDetails?: {
    actionTitle: string;
    actionDescription: string;
    impactSummary: string;
    parameters: Record<string, any>;
  };
}

export interface AIAuditRecord {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorRole: CanonicalUserRole;
  timestamp: string;
  projectId?: string;
  tool: string;
  action: string;
  targetId?: string;
  requestSummary: string;
  resultSummary: string;
  confirmationRequired: boolean;
  confirmedByUser: boolean;
  success: boolean;
  model: string;
}
