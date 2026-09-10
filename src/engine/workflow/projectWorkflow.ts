/**
 * MDrawing Canonical Project Workflow Engine
 * Single Source of Truth for Project Lifecycle Stages, Gates, Pre-Flight Verification, and State Transitions.
 * 
 * PT. Asa Perdana Mandiri - MDrawing System
 */

import { Project, DrawingItem, Quotation, FinanceTerm, VendorContract, AppUser } from "../../types";

export type CanonicalWorkflowStage =
  | "INTAKE"
  | "PROJECT_SETUP"
  | "CLIENT_SETUP"
  | "TIMELINE_COMMERCIAL"
  | "DRAWING_SETUP"
  | "TEAM_SETUP"
  | "DRAWING_REGISTER"
  | "COMMERCIAL_SETUP"
  | "VENDOR_SETUP"
  | "FINANCIAL_SETUP"
  | "PRE_FLIGHT"
  | "ACTIVE"
  | "ON_HOLD"
  | "OPERATIONS"
  | "CLOSING"
  | "COMPLETED"
  | "CANCELLED";

export interface WorkflowStageDefinition {
  id: CanonicalWorkflowStage;
  label: string;
  order: number;
  required: boolean;
  stepNumber: number; // 1 to 12 for the Wizard
  isWizardStep: boolean;
  description: string;
}

export const CANONICAL_WORKFLOW_STAGES: Record<CanonicalWorkflowStage, WorkflowStageDefinition> = {
  INTAKE: {
    id: "INTAKE",
    label: "Penerimaan Proyek",
    order: 0,
    required: true,
    stepNumber: 0,
    isWizardStep: false,
    description: "Inisiasi awal proyek sebelum masuk ke tahap setup detail."
  },
  PROJECT_SETUP: {
    id: "PROJECT_SETUP",
    label: "Identitas Proyek",
    order: 1,
    required: true,
    stepNumber: 1,
    isWizardStep: true,
    description: "Nama, kode kanonik unik, jenis proyek, dan lokasi fisik."
  },
  CLIENT_SETUP: {
    id: "CLIENT_SETUP",
    label: "Data Klien",
    order: 2,
    required: true,
    stepNumber: 2,
    isWizardStep: true,
    description: "Klien pemilik pekerjaan, kontak representatif, dan informasi penagihan (NPWP)."
  },
  TIMELINE_COMMERCIAL: {
    id: "TIMELINE_COMMERCIAL",
    label: "Jadwal & Baseline Nilai",
    order: 3,
    required: true,
    stepNumber: 3,
    isWizardStep: true,
    description: "Rentang tanggal mulai dan target selesai, nilai kontrak estimasi, kebijakan pajak."
  },
  DRAWING_SETUP: {
    id: "DRAWING_SETUP",
    label: "Struktur Lembar Gambar",
    order: 4,
    required: true,
    stepNumber: 4,
    isWizardStep: true,
    description: "Pemilihan template master, struktur grup gambar, atau impor sheet AutoCAD."
  },
  TEAM_SETUP: {
    id: "TEAM_SETUP",
    label: "Struktur Tim & PIC",
    order: 5,
    required: true,
    stepNumber: 5,
    isWizardStep: true,
    description: "Penetapan Project Leader (wajib) dan penugasan PIC Drafter ke grup/gambar."
  },
  DRAWING_REGISTER: {
    id: "DRAWING_REGISTER",
    label: "Drawing Register Review",
    order: 6,
    required: false,
    stepNumber: 0,
    isWizardStep: false,
    description: "Verifikasi nomor gambar standar CAD, skala gambar, prioritas, dan PIC."
  },
  COMMERCIAL_SETUP: {
    id: "COMMERCIAL_SETUP",
    label: "Komersial & Quotation",
    order: 6,
    required: true,
    stepNumber: 6,
    isWizardStep: true,
    description: "Penyusunan Rencana Anggaran Biaya (RAB) / Quotation resmi dan status approval."
  },
  VENDOR_SETUP: {
    id: "VENDOR_SETUP",
    label: "Setup Vendor & Subkon",
    order: 7,
    required: false,
    stepNumber: 7,
    isWizardStep: true,
    description: "Penugasan vendor outsource/lab (opsional jika seluruh pekerjaan internal)."
  },
  FINANCIAL_SETUP: {
    id: "FINANCIAL_SETUP",
    label: "Setup Termin & Keuangan",
    order: 8,
    required: true,
    stepNumber: 8,
    isWizardStep: true,
    description: "Termin pembayaran klien (total 100%) dan alokasi budget operasional."
  },
  PRE_FLIGHT: {
    id: "PRE_FLIGHT",
    label: "Pre-Flight Inspection",
    order: 9,
    required: true,
    stepNumber: 9,
    isWizardStep: true,
    description: "Pemeriksaan integritas sistem sebelum proyek diizinkan aktif secara hukum."
  },
  ACTIVE: {
    id: "ACTIVE",
    label: "Aktivasi & Operasi",
    order: 10,
    required: true,
    stepNumber: 10,
    isWizardStep: true,
    description: "Proyek resmi berjalan, nomor dokumen terkunci, komitmen finansial aktif."
  },
  ON_HOLD: {
    id: "ON_HOLD",
    label: "Tertunda (On Hold)",
    order: 11,
    required: false,
    stepNumber: 11,
    isWizardStep: false,
    description: "Proyek dijeda sementara atas permintaan klien atau kendala lapangan."
  },
  OPERATIONS: {
    id: "OPERATIONS",
    label: "Operasional Penuh",
    order: 12,
    required: false,
    stepNumber: 12,
    isWizardStep: false,
    description: "Fase eksekusi gambar, transmittal, penagihan invoice, dan pembayaran vendor."
  },
  CLOSING: {
    id: "CLOSING",
    label: "Penyelesaian Akhir",
    order: 13,
    required: false,
    stepNumber: 13,
    isWizardStep: false,
    description: "As-built drawing lengkap, seluruh invoice terbayar, audit rekonsiliasi final."
  },
  COMPLETED: {
    id: "COMPLETED",
    label: "Proyek Selesai",
    order: 14,
    required: false,
    stepNumber: 14,
    isWizardStep: false,
    description: "Proyek ditutup permanen dengan rekam jejak keuangan dan drawing aman."
  },
  CANCELLED: {
    id: "CANCELLED",
    label: "Dibatalkan",
    order: 15,
    required: false,
    stepNumber: 15,
    isWizardStep: false,
    description: "Proyek dibatalkan secara resmi dengan audit log alasan pembatalan."
  },
};

export const WIZARD_ORDERED_STAGES: CanonicalWorkflowStage[] = [
  "PROJECT_SETUP",
  "CLIENT_SETUP",
  "TIMELINE_COMMERCIAL",
  "DRAWING_SETUP",
  "TEAM_SETUP",
  "COMMERCIAL_SETUP",
  "VENDOR_SETUP",
  "FINANCIAL_SETUP",
  "PRE_FLIGHT",
  "ACTIVE",
];

export interface ProjectWorkflowContext {
  project: Partial<Project>;
  drawingItems?: DrawingItem[];
  quotation?: Quotation | null;
  financeTerms?: FinanceTerm[];
  vendorContracts?: VendorContract[];
  allProjectCodes?: string[];
  user?: AppUser | null;
}

export interface StageValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PreFlightChecklistItem {
  id: string;
  category: "IDENTITY" | "TIMELINE" | "DRAWINGS" | "TEAM" | "COMMERCIAL" | "FINANCE" | "VENDOR";
  label: string;
  isReady: boolean;
  isRequired: boolean;
  reasonIfBlocked?: string;
  remedyAction?: string;
  stageToJump: CanonicalWorkflowStage;
}

export interface PreFlightResult {
  isReady: boolean;
  items: PreFlightChecklistItem[];
  blockingReasons: string[];
  warnings: string[];
}

/**
 * Validates canonical project code format: e.g. PRJ-2026-001 or APM-ARC-01
 */
export function isValidProjectCodeFormat(code: string): boolean {
  if (!code || typeof code !== "string") return false;
  const trimmed = code.trim().toUpperCase();
  // Must be at least 3 characters, alphanumeric with hyphens/slashes
  return /^[A-Z0-9]{2,10}([-/][A-Z0-9]{2,10})+$/.test(trimmed);
}

/**
 * Stage-by-Stage Canonical Validator
 */
export function validateWorkflowStage(
  stage: CanonicalWorkflowStage,
  context: ProjectWorkflowContext
): StageValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const p = context.project;

  switch (stage) {
    case "PROJECT_SETUP": {
      if (!p.projectName || p.projectName.trim().length < 3) {
        errors.push("Nama proyek wajib diisi (minimal 3 karakter).");
      }
      if (!p.projectCode || p.projectCode.trim().length < 3) {
        errors.push("Kode proyek wajib diisi.");
      } else if (!isValidProjectCodeFormat(p.projectCode)) {
        errors.push("Format kode proyek harus kanonik (contoh: PRJ-2026-001 atau APM-ARC-01).");
      } else if (context.allProjectCodes && context.allProjectCodes.length > 0) {
        const cleanCode = p.projectCode.trim().toUpperCase();
        const isDuplicate = context.allProjectCodes.some(
          c => c.toUpperCase() === cleanCode && (!p.id || c.toUpperCase() !== (p.projectCode || "").toUpperCase())
        );
        if (isDuplicate) {
          errors.push(`Kode proyek "${p.projectCode}" sudah terdaftar pada proyek lain.`);
        }
      }
      if (!p.projectType || p.projectType.trim().length === 0) {
        errors.push("Jenis proyek wajib dipilih.");
      }
      if (!p.location || p.location.trim().length < 3) {
        errors.push("Lokasi proyek wajib diisi (minimal 3 karakter).");
      }
      break;
    }

    case "CLIENT_SETUP": {
      if (!p.clientName || p.clientName.trim().length < 2) {
        errors.push("Klien pemberi kerja wajib dipilih atau dibuat.");
      }
      break;
    }

    case "TIMELINE_COMMERCIAL": {
      if (!p.startDate) {
        errors.push("Tanggal mulai proyek wajib diisi.");
      }
      if (!p.targetDate) {
        errors.push("Target tanggal selesai proyek wajib diisi.");
      }
      if (p.startDate && p.targetDate) {
        const start = new Date(p.startDate);
        const target = new Date(p.targetDate);
        if (target < start) {
          errors.push("Target selesai tidak boleh mendahului tanggal mulai.");
        }
      }
      if (typeof p.contractValue !== "number" || p.contractValue < 0 || isNaN(p.contractValue)) {
        errors.push("Nilai kontrak harus bernilai angka positif atau nol.");
      }
      if (typeof p.budgetOtherExpenses === "number") {
        if (p.budgetOtherExpenses < 0) {
          errors.push("Budget operasional tidak boleh bernilai negatif.");
        }
        if (p.contractValue && p.contractValue > 0 && p.budgetOtherExpenses > p.contractValue * 0.1) {
          errors.push(`Alokasi budget operasional maksimal 10% dari estimasi nilai kontrak (Maksimal: Rp ${Math.round(p.contractValue * 0.1).toLocaleString('id-ID')}).`);
        }
      }
      break;
    }

    case "DRAWING_SETUP": {
      // Drawing structure setup must have confirmed groups or items
      const items = context.drawingItems || [];
      if (items.length === 0) {
        warnings.push("Belum ada lembar gambar yang ditambahkan ke proyek.");
      }
      break;
    }

    case "TEAM_SETUP": {
      // Project Leader is mandatory according to system principles
      const leaderId = (p as any).projectLeaderId;
      const leaderName = (p as any).projectLeaderName;
      if (!leaderId && !leaderName) {
        errors.push("Project Leader wajib ditetapkan sebelum proyek dapat dijalankan.");
      }
      if (!p.members || p.members.length === 0) {
        warnings.push("Belum ada anggota tim drafter yang ditugaskan ke proyek ini.");
      }
      break;
    }

    case "DRAWING_REGISTER": {
      const items = context.drawingItems || [];
      if (items.length > 0) {
        // Check for duplicate drawing numbers
        const seenNumbers = new Set<string>();
        for (const item of items) {
          if (!item.drawingNumber || item.drawingNumber.trim().length === 0) {
            errors.push(`Terdapat gambar tanpa nomor gambar standar CAD ("${item.drawingName}").`);
            break;
          }
          const upperNum = item.drawingNumber.trim().toUpperCase();
          if (seenNumbers.has(upperNum)) {
            errors.push(`Nomor gambar ganda terdeteksi: "${item.drawingNumber}". Setiap lembar harus unik.`);
            break;
          }
          seenNumbers.add(upperNum);
        }
      }
      break;
    }

    case "COMMERCIAL_SETUP": {
      if (context.quotation) {
        if (context.quotation.items.length === 0) {
          errors.push("Quotation tidak memiliki item rincian pekerjaan.");
        }
        if (context.quotation.grandTotal <= 0) {
          warnings.push("Grand total quotation bernilai Rp 0.");
        }
      }
      break;
    }

    case "VENDOR_SETUP": {
      const contracts = context.vendorContracts || [];
      for (const vc of contracts) {
        if (!vc.vendorName) {
          errors.push("Kontrak vendor belum menetapkan nama vendor.");
        }
        if (vc.contractValue <= 0) {
          warnings.push(`Kontrak untuk ${vc.vendorName || "Vendor"} memiliki nilai Rp 0.`);
        }
      }
      break;
    }

    case "FINANCIAL_SETUP": {
      const terms = context.financeTerms || [];
      if (terms.length > 0) {
        const totalPercentage = terms.reduce((acc, t) => {
          return t.amountType === "Percentage" ? acc + (t.percentageValue || 0) : acc;
        }, 0);
        if (Math.abs(totalPercentage - 100) > 0.01) {
          errors.push(`Total persentase termin penagihan harus tepat 100% (saat ini ${totalPercentage}%).`);
        }
      } else {
        warnings.push("Termin penagihan klien belum dikonfigurasi.");
      }
      break;
    }

    case "PRE_FLIGHT": {
      // Aggregate all prior required stages
      const pStage = validateWorkflowStage("PROJECT_SETUP", context);
      const cStage = validateWorkflowStage("CLIENT_SETUP", context);
      const tStage = validateWorkflowStage("TIMELINE_COMMERCIAL", context);
      const teamStage = validateWorkflowStage("TEAM_SETUP", context);
      const drwStage = validateWorkflowStage("DRAWING_REGISTER", context);
      const finStage = validateWorkflowStage("FINANCIAL_SETUP", context);

      errors.push(...pStage.errors, ...cStage.errors, ...tStage.errors, ...teamStage.errors, ...drwStage.errors, ...finStage.errors);
      warnings.push(...pStage.warnings, ...cStage.warnings, ...tStage.warnings, ...teamStage.warnings, ...drwStage.warnings, ...finStage.warnings);
      break;
    }

    case "ACTIVE": {
      const preflight = evaluatePreFlightInspection(context);
      if (!preflight.isReady) {
        errors.push(...preflight.blockingReasons);
      }
      break;
    }

    default:
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Evaluates comprehensive Pre-Flight Checklist for Project Activation
 */
export function evaluatePreFlightInspection(context: ProjectWorkflowContext): PreFlightResult {
  const items: PreFlightChecklistItem[] = [];
  const p = context.project;
  const drwItems = context.drawingItems || [];
  const terms = context.financeTerms || [];

  // 1. Project Identity
  const hasIdentity = !!p.projectName && p.projectName.trim().length >= 3;
  const hasCode = !!p.projectCode && isValidProjectCodeFormat(p.projectCode);
  items.push({
    id: "check_identity",
    category: "IDENTITY",
    label: "Nama & Kode Proyek Kanonik",
    isReady: hasIdentity && hasCode,
    isRequired: true,
    reasonIfBlocked: !hasIdentity 
      ? "Nama proyek belum diisi atau kurang dari 3 karakter." 
      : !hasCode 
      ? "Format kode proyek tidak valid atau kosong." 
      : undefined,
    remedyAction: "Lengkapi nama dan kode proyek di Step 1.",
    stageToJump: "PROJECT_SETUP"
  });

  // 2. Client Setup
  const hasClient = !!p.clientName && p.clientName.trim().length >= 2;
  items.push({
    id: "check_client",
    category: "COMMERCIAL",
    label: "Klien Pemberi Kerja Terverifikasi",
    isReady: hasClient,
    isRequired: true,
    reasonIfBlocked: !hasClient ? "Belum ada klien yang dipilih untuk proyek ini." : undefined,
    remedyAction: "Pilih klien di Step 2.",
    stageToJump: "CLIENT_SETUP"
  });

  // 3. Timeline
  const hasDates = !!p.startDate && !!p.targetDate;
  const datesValid = hasDates && new Date(p.targetDate!) >= new Date(p.startDate!);
  items.push({
    id: "check_timeline",
    category: "TIMELINE",
    label: "Jadwal Waktu Mulai & Target Selesai",
    isReady: datesValid,
    isRequired: true,
    reasonIfBlocked: !hasDates 
      ? "Tanggal mulai atau target selesai belum ditentukan." 
      : !datesValid 
      ? "Target tanggal selesai mendahului tanggal mulai." 
      : undefined,
    remedyAction: "Sesuaikan rentang tanggal di Step 3.",
    stageToJump: "TIMELINE_COMMERCIAL"
  });

  // 4. Commercial Baseline
  const hasContract = typeof p.contractValue === "number" && p.contractValue >= 0 && !isNaN(p.contractValue);
  items.push({
    id: "check_contract",
    category: "COMMERCIAL",
    label: "Nilai Kontrak / Estimasi Komersial",
    isReady: hasContract,
    isRequired: true,
    reasonIfBlocked: !hasContract ? "Nilai kontrak belum ditentukan secara valid." : undefined,
    remedyAction: "Isi estimasi nilai kontrak di Step 3.",
    stageToJump: "TIMELINE_COMMERCIAL"
  });

  // 5. Team Leadership
  const hasLeader = !!(p as any).projectLeaderId || !!(p as any).projectLeaderName;
  items.push({
    id: "check_team_leader",
    category: "TEAM",
    label: "Penetapan Project Leader (Mandatory)",
    isReady: hasLeader,
    isRequired: true,
    reasonIfBlocked: !hasLeader ? "Project Leader belum ditugaskan untuk memimpin proyek ini." : undefined,
    remedyAction: "Pilih Project Leader di Step 5.",
    stageToJump: "TEAM_SETUP"
  });

  // 6. Drawing Register (Opsional saat pendaftaran - dinamis saat proyek berjalan)
  const noDuplicateDrawings = (() => {
    if (drwItems.length === 0) return true;
    const s = new Set<string>();
    for (const item of drwItems) {
      if (!item.drawingNumber) continue;
      const code = item.drawingNumber.trim().toUpperCase();
      if (s.has(code)) return false;
      s.add(code);
    }
    return true;
  })();
  items.push({
    id: "check_drawings",
    category: "DRAWINGS",
    label: "Drawing Register & Nomor CAD",
    isReady: noDuplicateDrawings,
    isRequired: false,
    reasonIfBlocked: !noDuplicateDrawings 
      ? "Terdapat nomor lembar gambar duplikat pada drawing register." 
      : undefined,
    remedyAction: "Daftar gambar dapat dikelola secara dinamis di modul Master Drawing.",
    stageToJump: "DRAWING_SETUP"
  });

  // 7. Finance Terms Coherence
  const termsTotal100 = terms.length === 0 || Math.abs(
    terms.reduce((acc, t) => t.amountType === "Percentage" ? acc + (t.percentageValue || 0) : acc, 0) - 100
  ) < 0.01;
  items.push({
    id: "check_finance_terms",
    category: "FINANCE",
    label: "Konsistensi Termin Pembayaran (100%)",
    isReady: termsTotal100,
    isRequired: true,
    reasonIfBlocked: !termsTotal100 ? "Total persentase termin pembayaran tidak sama dengan 100%." : undefined,
    remedyAction: "Sesuaikan persentase termin pembayaran di Step 8.",
    stageToJump: "FINANCIAL_SETUP"
  });

  const blockingReasons = items
    .filter(it => it.isRequired && !it.isReady)
    .map(it => it.reasonIfBlocked || `${it.label} belum memenuhi syarat.`);

  const warnings = items
    .filter(it => !it.isRequired && !it.isReady)
    .map(it => it.reasonIfBlocked || `${it.label} perlu perhatian.`);

  return {
    isReady: blockingReasons.length === 0,
    items,
    blockingReasons,
    warnings
  };
}

/**
 * Checks if a target stage is accessible from current stage
 * Rule: Previous required stages must be completed before advancing.
 */
export function canNavigateToStage(
  targetStage: CanonicalWorkflowStage,
  currentStage: CanonicalWorkflowStage,
  completedStages: CanonicalWorkflowStage[],
  context: ProjectWorkflowContext
): { allowed: boolean; reason?: string } {
  // If project is already ACTIVE, allow jumping between any operational workspace view
  if (context.project.status === "Berjalan" || context.project.status === "Selesai" || currentStage === "ACTIVE") {
    return { allowed: true };
  }

  const targetDef = CANONICAL_WORKFLOW_STAGES[targetStage];
  const currentDef = CANONICAL_WORKFLOW_STAGES[currentStage];

  // Can always stay or go back to an already completed/previous stage
  if (targetDef.order <= currentDef.order || completedStages.includes(targetStage)) {
    return { allowed: true };
  }

  // Jumping ahead more than 1 step without completing current
  const targetIndex = WIZARD_ORDERED_STAGES.indexOf(targetStage);
  const currentIndex = WIZARD_ORDERED_STAGES.indexOf(currentStage);

  if (targetIndex > currentIndex + 1) {
    return {
      allowed: false,
      reason: "Tahapan berikutnya masih terkunci. Harap selesaikan tahapan saat ini terlebih dahulu."
    };
  }

  // Validate current stage before allowing step + 1
  const currentValidation = validateWorkflowStage(currentStage, context);
  if (!currentValidation.valid) {
    return {
      allowed: false,
      reason: `Selesaikan tahapan ${currentDef.label} terlebih dahulu: ${currentValidation.errors.join(", ")}`
    };
  }

  return { allowed: true };
}
