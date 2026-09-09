import { AppUser, Project, DrawingItem, Invoice, VendorBill } from "../types";
import { hasCapability, canAccessProject } from "../security/authorization";
import { calculateProjectProgress } from "../engine/projectProgressEngine";
import { AIMode } from "./types";

export interface AIProjectContextData {
  project?: Project | null;
  drawings?: DrawingItem[];
  invoices?: Invoice[];
  vendorBills?: VendorBill[];
  recentActivities?: Array<{ action: string; timestamp: string; user: string }>;
  untrustedNotes?: string[];
}

export class AIContextBuilder {
  /**
   * Compiles minimal, privacy-safe, deterministic grounded context for Gemini reasoning.
   */
  public static buildContext(
    user: AppUser | null,
    data: AIProjectContextData,
    mode: AIMode = "NORMAL"
  ): { contextString: string; estimatedTokenCount: number } {
    if (!user || !user.isActive) {
      return { contextString: "Pengguna tidak terautentikasi.", estimatedTokenCount: 10 };
    }

    const sections: string[] = [];

    // 1. User & Identity Scope
    sections.push(`[PENGGUNA AKTIF] Peran: ${user.role} | Nama: ${user.name}`);

    // 2. Project Boundary
    if (data.project) {
      if (!canAccessProject(user, data.project.id)) {
        return {
          contextString: "[AKSES DITOLAK] Pengguna tidak memiliki akses ke proyek ini.",
          estimatedTokenCount: 15,
        };
      }

      sections.push(
        `[PROYEK] Kode: ${data.project.projectCode} | Nama: ${data.project.projectName} | Status: ${data.project.status} | Nilai Kontrak: Rp${(
          data.project.contractValue || 0
        ).toLocaleString("id-ID")} | Target Selesai: ${data.project.targetDate || "-"}`
      );
    }

    // 3. Deterministic Drawing Metrics
    if (data.drawings && data.drawings.length > 0) {
      const active = data.drawings.filter((d) => !d.isDeleted);
      const total = active.length;
      const approved = active.filter((d) => d.status === "Selesai").length;
      const inReview = active.filter((d) => d.status === "Review").length;
      const inProgress = active.filter((d) => d.status === "Proses" || d.status === "Revisi").length;
      const hold = active.filter((d) => d.status === "Hold").length;
      const notStarted = active.filter((d) => d.status === "Belum Mulai").length;
      const overdue = active.filter(
        (d) => d.deadline && new Date(d.deadline) < new Date() && d.status !== "Selesai"
      ).length;

      const progressPct = calculateProjectProgress(active as any);

      sections.push(
        `[METRIK GAMBAR (DETERMINISTIK)] Total: ${total} | Progress Keseluruhan: ${progressPct}% | Selesai: ${approved} | Review: ${inReview} | Dikerjakan: ${inProgress} | Belum Mulai: ${notStarted} | Hold: ${hold} | Terlambat: ${overdue}`
      );

      // In normal mode, list up to 4 overdue or critical drawings
      if (mode === "NORMAL" && overdue > 0) {
        const sampleOverdue = active
          .filter((d) => d.deadline && new Date(d.deadline) < new Date() && d.status !== "Selesai")
          .slice(0, 4)
          .map((d) => `${d.drawingNumber} (${d.drawingName}, target: ${d.deadline})`)
          .join(", ");
        sections.push(`[DAFTAR GAMBAR TERLAMBAT] ${sampleOverdue}`);
      }
    }

    // 4. Deterministic Finance Metrics (Grounded ONLY if user has permission)
    const canFinance = hasCapability(user, "canViewFinance");
    const canVendor = hasCapability(user, "canViewVendorCost");

    if (canFinance && data.invoices && data.invoices.length > 0) {
      const validInvoices = data.invoices.filter((i) => i.status !== "Void" && i.status !== "Cancelled");
      const totalInvoiced = validInvoices.reduce((sum, i) => sum + (Number(i.grandTotal) || 0), 0);
      const totalPaid = validInvoices.reduce(
        (sum, i) => sum + (Number(i.paidAmount ?? i.amountPaid) || 0),
        0
      );
      const remainingBalance = Math.max(0, totalInvoiced - totalPaid);
      const unpaidCount = validInvoices.filter((i) => i.status !== "Paid").length;

      sections.push(
        `[METRIK KEUANGAN KLIEN (DETERMINISTIK)] Total Ditagihkan: Rp${totalInvoiced.toLocaleString(
          "id-ID"
        )} | Diterima: Rp${totalPaid.toLocaleString("id-ID")} | Piutang Belum Lunas: Rp${remainingBalance.toLocaleString(
          "id-ID"
        )} | Invoice Aktif: ${unpaidCount}`
      );
    }

    if (canVendor && data.vendorBills && data.vendorBills.length > 0) {
      const validBills = data.vendorBills.filter((b) => b.status !== "Void" && b.status !== "Cancelled");
      const totalVendorBills = validBills.reduce(
        (sum, b) => sum + (Number(b.amount) || 0),
        0
      );
      const totalVendorPaid = validBills.reduce((sum, b) => sum + (Number(b.paidAmount) || 0), 0);
      const vendorRemaining = Math.max(0, totalVendorBills - totalVendorPaid);

      sections.push(
        `[METRIK VENDOR (DETERMINISTIK)] Total Tagihan Vendor: Rp${totalVendorBills.toLocaleString(
          "id-ID"
        )} | Terbayar: Rp${totalVendorPaid.toLocaleString("id-ID")} | Hutang Vendor: Rp${vendorRemaining.toLocaleString(
          "id-ID"
        )}`
      );
    }

    // 5. Untrusted Data Sections (strictly quarantined with prompt injection guards)
    if (data.untrustedNotes && data.untrustedNotes.length > 0) {
      const notesSnippet = data.untrustedNotes
        .slice(0, mode === "ECONOMY" ? 2 : 5)
        .map((n) => `<<<CATATAN_PENGGUNA_TIDAK_TERPERCAYA: "${n.replace(/"/g, "'")}">>>`)
        .join("\n");
      sections.push(`[DATA DOKUMEN / CATATAN LAPANGAN]:\n${notesSnippet}`);
    }

    const contextString = sections.join("\n\n");
    // Approximate token count: ~4 characters per token
    const estimatedTokenCount = Math.ceil(contextString.length / 4);

    return { contextString, estimatedTokenCount };
  }
}
