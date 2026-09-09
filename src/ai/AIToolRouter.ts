import { AppUser } from "../types";
import { AIPolicyGuard } from "./AIPolicyGuard";
import { AIToolExecutionRequest, AIToolExecutionResult, AIAuditRecord } from "./types";
import { hasCapability, canAccessProject } from "../security/authorization";
import { db } from "../lib/firebase";
import { collection, addDoc } from "firebase/firestore";

export class AIToolRouter {
  private policyGuard: AIPolicyGuard;
  private auditLog: AIAuditRecord[] = [];

  constructor(policyGuard?: AIPolicyGuard) {
    this.policyGuard = policyGuard || new AIPolicyGuard();
  }

  /**
   * Executes or routes a tool with full RBAC validation and high-risk confirmation guards.
   */
  public async executeTool(
    user: AppUser | null,
    request: AIToolExecutionRequest,
    contextData: {
      projectId?: string;
      projectData?: any;
      onUpdateDrawingStatus?: (drawingId: string, newStatus: string) => Promise<void>;
      onCreateDrawing?: (drawingData: any) => Promise<void>;
    }
  ): Promise<AIToolExecutionResult> {
    if (!user || !user.isActive) {
      return {
        success: false,
        message: "Otorisasi gagal: Sesi pengguna tidak aktif.",
      };
    }

    const { toolName, parameters, confirmedByUser } = request;
    const targetProjectId = parameters?.projectId || contextData.projectId;

    // Check project boundary
    if (targetProjectId && !canAccessProject(user, targetProjectId)) {
      return {
        success: false,
        message: `Akses ditolak: Anda tidak memiliki wewenang pada proyek '${targetProjectId}'.`,
      };
    }

    // Route based on tool name
    switch (toolName) {
      case "updateDrawingStatus": {
        // Capability check
        if (!hasCapability(user, "canUpdateDrawingStatus")) {
          return {
            success: false,
            message: "Akses ditolak: Anda tidak memiliki wewenang mengubah status gambar.",
          };
        }

        const { drawingId, drawingNumber, newStatus, reason } = parameters;
        if (!drawingId || !newStatus) {
          return {
            success: false,
            message: "Parameter drawingId dan newStatus diperlukan.",
          };
        }

        // High-Risk Confirmation check
        if (!confirmedByUser) {
          return {
            success: false,
            message: "Tindakan ini memerlukan konfirmasi persetujuan dari Anda.",
            requiresConfirmation: true,
            confirmationDetails: {
              actionTitle: "Konfirmasi Perubahan Status Gambar",
              actionDescription: `Mengubah status gambar ${drawingNumber || drawingId} menjadi '${newStatus}'.`,
              impactSummary: `Status gambar dalam Drawing Register proyek akan segera diperbarui ke '${newStatus}'. Alasan: ${reason || "Diusulkan oleh AI Agent"}.`,
              parameters,
            },
          };
        }

        // Execute write if handler provided
        if (contextData.onUpdateDrawingStatus) {
          try {
            await contextData.onUpdateDrawingStatus(drawingId, newStatus);
            await this.recordAudit(user, toolName, "UPDATE_STATUS", targetProjectId, drawingId, true, true);
            return {
              success: true,
              message: `Status gambar ${drawingNumber || drawingId} berhasil diubah menjadi '${newStatus}'.`,
            };
          } catch (err: any) {
            return {
              success: false,
              message: `Gagal memperbarui status: ${err?.message || "Kesalahan sistem."}`,
            };
          }
        }

        return {
          success: false,
          message: `Permintaan perubahan status gambar gagal dieksekusi: Fungsi handler tidak tersedia di context saat ini.`,
          data: { drawingId, newStatus },
        };
      }

      case "getFinancialSummary": {
        if (!hasCapability(user, "canViewFinance")) {
          return {
            success: false,
            message: "Akses ditolak: Peran Anda tidak memiliki izin untuk melihat ringkasan keuangan.",
          };
        }
        return {
          success: true,
          message: "Data ringkasan keuangan berhasil diverifikasi.",
          data: contextData.projectData?.finances || {},
        };
      }

      case "getDrawingRegister": {
        return {
          success: true,
          message: "Data register gambar berhasil dimuat.",
          data: contextData.projectData?.drawings || [],
        };
      }

      default:
        return {
          success: false,
          message: `Tool '${toolName}' tidak dikenal atau tidak didukung.`,
        };
    }
  }

  private async recordAudit(
    user: AppUser,
    tool: string,
    action: string,
    projectId?: string,
    targetId?: string,
    confirmedByUser: boolean = false,
    success: boolean = true
  ) {
    const record: AIAuditRecord = {
      id: `audit_ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      actorUid: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      timestamp: new Date().toISOString(),
      projectId,
      tool,
      action,
      targetId,
      requestSummary: `Tool ${tool} executed with action ${action}`,
      resultSummary: success ? "Executed successfully" : "Execution failed",
      confirmationRequired: true,
      confirmedByUser,
      success,
      model: "gemini-3.8-flash",
    };
    this.auditLog.push(record);
    try {
      await addDoc(collection(db, "aiAuditLogs"), record);
    } catch (e) {
      console.error("Failed to persist AI audit log to Firestore", e);
    }
  }

  public getAuditLog(): AIAuditRecord[] {
    return [...this.auditLog];
  }
}
