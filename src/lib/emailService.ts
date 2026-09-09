import { auth } from "./firebase";
import { DrawingItem } from "../types";

export interface ManualReminderParams {
  to?: string;
  recipientEmail?: string;
  recipientName?: string;
  picName?: string;
  drawingNumber: string;
  drawingName: string;
  projectName?: string;
  deadlineDate?: string;
  progress?: number;
  status?: string;
  notes?: string;
  customNote?: string;
}

export interface EmailServiceResponse {
  success: boolean;
  message?: string;
  messageId?: string;
  previewUrl?: string | null;
  recipient?: string;
  error?: string;
}

export interface DeadlineCheckResponse {
  success: boolean;
  message?: string;
  timestamp: string;
  totalChecked: number;
  processedCount: number;
  sentCount: number;
  results: Array<{
    itemId: string;
    drawingNumber: string;
    picName: string;
    picEmail: string;
    notificationType: "H-3" | "H-0";
    deadlineDate: string;
    status: "SENT" | "FAILED" | "SKIPPED";
    error?: string;
    previewUrl?: string;
  }>;
  error?: string;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Sends a manual progress & deadline reminder email to PIC
 */
export async function sendManualReminderEmail(params: ManualReminderParams): Promise<EmailServiceResponse> {
  const headers = await getAuthHeader();
  const response = await fetch("/api/send-manual-reminder", {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Gagal mengirim email pengingat.");
  }
  return data;
}

/**
 * Runs the deadline checker (H-3 and Hari-H) across drawing items
 */
export async function triggerDeadlineCheck(
  items?: DrawingItem[],
  forceSend = false,
  cronSecret?: string
): Promise<DeadlineCheckResponse> {
  const headers = await getAuthHeader();
  if (cronSecret) {
    headers["x-cron-secret"] = cronSecret;
  }

  const response = await fetch("/api/check-deadline-emails", {
    method: "POST",
    headers,
    body: JSON.stringify({
      items,
      forceSend,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Gagal memproses pengecekan deadline.");
  }
  return data;
}
