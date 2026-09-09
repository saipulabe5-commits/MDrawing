export type CanonicalUserRole =
  | "OWNER"
  | "ADMIN"
  | "FINANCE"
  | "PROJECT_LEADER"
  | "TEAM"
  | "VIEWER"
  | "CLIENT_VIEWER";

export type UserRole = CanonicalUserRole;

export interface AppUser {
  id?: string;
  uid: string;
  email: string | null;
  name: string | null;
  role: CanonicalUserRole;
  isActive: boolean;
  canViewFinance?: boolean;
  canEditFinance?: boolean;
  canApproveFinance?: boolean;
  canViewProfit?: boolean;
  canViewVendorCost?: boolean;
  canViewClientInvoice?: boolean;
  canViewVendorPayment?: boolean;
  canExportFinanceReport?: boolean;
  canVoidFinanceTransaction?: boolean;
  canEditPaidTransaction?: boolean;
  canCreateProject?: boolean;
  canEditProject?: boolean;
  canDeleteProject?: boolean;
  canManageDrawingRegister?: boolean;
  canUpdateDrawingStatus?: boolean;
  canManageTransmittal?: boolean;
  canManageVendor?: boolean;
  assignedProjectIds?: string[];
  createdAt: string;
  updatedAt: string;
  themePreference?: "light" | "dark" | "system";
}

export type User = AppUser;

export type ProjectStatus = "Planning" | "Berjalan" | "Hold" | "Selesai" | "Cancelled";

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

export interface Project {
  id: string;
  projectName: string;
  projectCode: string;
  projectType: string;
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  location: string;
  startDate: string;
  targetDate: string;
  status: ProjectStatus;
  description: string;
  members: string[]; // array of user UIDs
  projectLeaderId?: string;
  projectLeaderName?: string;
  projectLeaderEmail?: string;
  contractValue?: number;
  expectedProfit?: number;
  budgetOtherExpenses?: number;
  taxPolicy?: "NON_PPN" | "PPN_11" | "PPN_12";
  discountPolicy?: number;
  targetProfitPercentage?: number;
  // Canonical Workflow State (Phase 3)
  workflowStage?: CanonicalWorkflowStage;
  workflowVersion?: number;
  completedStages?: CanonicalWorkflowStage[];
  stageChecklist?: Record<string, boolean>;
  blockingIssues?: string[];
  activatedAt?: string;
  activatedBy?: string;
  closedAt?: string;
  closedBy?: string;
  lastWorkflowTransitionAt?: string;
  lastWorkflowTransitionBy?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type DrawingItemStatus = "Belum Mulai" | "Proses" | "Review" | "Revisi" | "Selesai" | "Hold";
export type DrawingPriority = "Rendah" | "Normal" | "Tinggi" | "Urgent";
export type DeadlineLabel = "Overdue" | "Due Soon" | "Aman" | "Hold";

export interface DrawingGroup {
  id: string;
  projectId: string;
  groupCode: string;
  groupName: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DrawingItem {
  id: string;
  projectId: string;
  groupId: string | null;
  drawingNumber: string;
  drawingName: string;
  scale: string;
  picId: string;
  picName: string;
  picEmail?: string;
  deadline: string | null;
  status: DrawingItemStatus;
  progress: number;
  priority: DrawingPriority;
  notes: string;
  revisionCount: number;
  isDeleted: boolean;
  sortOrder: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DrawingRevision {
  id: string;
  itemId: string;
  projectId: string;
  revisionNumber?: string;
  statusAtRevision?: DrawingItemStatus;
  notes: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface DrawingTransmittal {
  id: string;
  projectId: string;
  transmittalNumber: string; // format TRM/YYYY/MM/XXX
  recipientType: "Klien" | "Konsultan Pengawas" | "Kontraktor";
  recipientName: string;
  purpose: "For Review" | "For Approval" | "For Construction (IFC)" | "As-Built";
  itemIds: string[]; // drawing item yang dikirim
  itemRevisionSnapshot: {
    itemId: string;
    drawingNumber: string;
    drawingName: string;
    revisionNumber: string;
  }[]; // snapshot nomor revisi SAAT transmittal dibuat
  notes: string;
  issuedBy: string;
  issuedByName?: string;
  issuedAt: string;
  fileUrl?: string;
  pdfDocumentId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DrawingTemplate {
  id: string;
  templateName: string;
  projectType?: string;
  description: string;
  groups?: {
    groupName: string;
    sortOrder: number;
    items: {
      drawingName: string;
      drawingNumber: string;
      scale: string;
      sortOrder: number;
    }[];
  }[];
  groupCount?: number;
  itemCount?: number;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DrawingTemplateGroup {
  id: string;
  templateId: string;
  groupName: string;
  groupCode?: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DrawingTemplateItem {
  id: string;
  templateId: string;
  groupId: string;
  drawingNumber: string;
  drawingName: string;
  scale: string;
  sortOrder: number;
  priority?: DrawingPriority;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ActivityAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "STATUS_CHANGE"
  | "ASSIGN"
  | "REVISION_ADD";

export type ActivityEntityType =
  | "PROJECT"
  | "DRAWING_GROUP"
  | "DRAWING_ITEM"
  | "DRAWING_REVISION"
  | "USER"
  | "TEAM";

export interface ActivityLog {
  id: string;
  projectId?: string;
  projectName?: string;
  userId: string;
  userName: string;
  userRole?: string;
  actionType?: string;
  action?: ActivityAction | string;
  targetType?: string;
  entityType?: ActivityEntityType | string;
  targetId?: string;
  entityId?: string;
  entityName?: string;
  description?: string;
  details?: string;
  oldValue?: any;
  newValue?: any;
  createdAt: string;
}

export interface Client {
  id: string;
  clientName: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  taxId: string; // NPWP
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type QuotationStatus = "Draft" | "Sent" | "Approved" | "Rejected" | "Cancelled";

export interface QuotationItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number; // qty * unitPrice
}

export interface Quotation {
  id: string;
  projectId: string;
  clientId: string;
  quotationNumber: string;
  date: string;
  validUntil: string;
  status: QuotationStatus;
  items: QuotationItem[];
  subTotal: number;
  discount: number;
  tax: number; // percentage or nominal, assume nominal for simplicity or keep both
  taxPercentage: number;
  grandTotal: number;
  notes: string;
  termsAndConditions: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type FinanceTermTrigger = "On Quotation Approved" | "On Project Start" | "On Drawing Progress" | "On Drawing Final" | "On Custom Date" | "Manual";

export interface FinanceTerm {
  id: string;
  projectId: string;
  termName: string; // e.g., DP 30%, Termin 1 30%, Pelunasan 40%
  triggerType: FinanceTermTrigger;
  triggerCondition?: string; // e.g., progress value, custom date
  amountType: "Percentage" | "Nominal";
  percentageValue?: number; // e.g., 30
  nominalValue?: number;
  sortOrder: number;
  invoicedAmount?: number; // Track if it has been invoiced
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus = "Draft" | "Sent" | "Partial Paid" | "Paid" | "Overdue" | "Void" | "Cancelled";

export interface Invoice {
  id: string;
  projectId: string;
  clientId: string;
  termId: string; // Reference to FinanceTerm
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: InvoiceStatus;
  subTotal: number;
  taxPercentage: number;
  tax: number;
  discount: number;
  grandTotal: number;
  amountPaid: number; // Synced by Cloud Function
  paidAmount?: number;
  remainingAmount?: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus = "Draft" | "Confirmed" | "Cancelled";

export interface ClientPayment {
  id: string;
  projectId: string;
  clientId: string;
  invoiceId: string;
  paymentNumber: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string; // Transfer Bank, Cash, dll
  referenceNumber: string; // Bukti transfer
  attachmentUrl: string; // Proof to Storage
  status: PaymentStatus;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialAuditLog {
  id: string;
  projectId: string;
  transactionType: "Quotation" | "Invoice" | "ClientPayment" | "Expense" | "VendorPayment" | "Vendor" | "ProjectVendor" | "VendorBill";
  transactionId: string;
  action: "CREATE" | "UPDATE" | "VOID" | "CANCEL" | "APPROVE";
  userId: string;
  userName: string;
  userRole?: string;
  oldValue: any;
  newValue: any;
  reason?: string;
  createdAt: string;
}

export interface DocumentCounter {
  id: string; // 'quotation', 'invoice', 'payment', 'vendorBill', 'vendorPayment'
  prefix: string; // e.g. 'INV', 'QUO', 'VBILL', 'VPY'
  year: number;
  month: number;
  sequence: number;
  updatedAt: string;
}

// -------------------------------------------------------------
// VENDOR MODULE TYPES (PHASE 4)
// -------------------------------------------------------------

export type VendorType = 
  | "Struktur"
  | "MEP"
  | "Drafter Freelance"
  | "Renderer"
  | "Surveyor"
  | "Printing Vendor"
  | "Konsultan PBG"
  | "Lain-lain";

export interface Vendor {
  id: string;
  vendorName: string;
  vendorType: VendorType;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  npwp?: string;
  notes?: string;
  rating?: number;
  createdAt: string;
  updatedAt: string;
}

export type VendorWorkStatus = "Belum Mulai" | "Dalam Proses" | "On Hold" | "Selesai";

export interface ProjectVendor {
  id: string;
  projectId: string;
  vendorId: string;
  vendorName: string;
  vendorType: VendorType;
  scopeOfWork: string;
  contractValue: number;
  workStatus: VendorWorkStatus;
  startDate?: string;
  targetDate?: string;
  completionDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type VendorContract = ProjectVendor;


export type VendorTermTrigger = 
  | "On Work Start"
  | "On Work Progress"
  | "On Work Completed"
  | "On Client Payment Received"
  | "On Custom Date"
  | "Manual";

export interface VendorPaymentTerm {
  id: string;
  projectVendorId: string;
  projectId: string;
  termName: string;
  triggerType: VendorTermTrigger;
  triggerCondition?: string;
  amountType: "Percentage" | "Nominal";
  percentageValue?: number;
  nominalValue?: number;
  sortOrder: number;
  invoicedAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export type VendorBillStatus = 
  | "Draft"
  | "Received"
  | "Partial Paid"
  | "Paid"
  | "Overdue"
  | "Void"
  | "Cancelled";

export interface VendorBill {
  id: string;
  projectId: string;
  projectVendorId: string;
  vendorId: string;
  termId?: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: VendorBillStatus;
  notes?: string;
  attachmentUrl?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type VendorPaymentStatus = "Draft" | "Confirmed" | "Cancelled";

export interface VendorPayment {
  id: string;
  projectId: string;
  projectVendorId: string;
  vendorId: string;
  billId: string;
  paymentNumber: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string;
  bankSource: string;
  attachmentUrl?: string;
  status: VendorPaymentStatus;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// PHASE 5: PROJECT EXPENSES, CASHFLOW & DOCUMENTS
// -------------------------------------------------------------

export type ProjectExpenseCategory =
  | "Site Visit"
  | "Printing"
  | "Konsumsi"
  | "Transport"
  | "Software License"
  | "Alat Kantor"
  | "Subkon Lainnya"
  | "Lain-lain";

export type ProjectExpenseStatus = "Draft" | "Approved" | "Paid" | "Cancelled";

export interface ProjectExpense {
  id: string;
  projectId: string;
  expenseNumber: string;
  expenseCategory: ProjectExpenseCategory;
  expenseDate: string;
  amount: number;
  description: string;
  paidTo: string;
  paymentMethod: string;
  attachmentUrl?: string;
  isReimbursable?: boolean;
  status: ProjectExpenseStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type CashflowType = "IN" | "OUT";
export type CashflowCategory = 
  | "Client Payment"
  | "Vendor Payment"
  | "Project Expense"
  | "Modal/Injeksi"
  | "Operasional Kantor"
  | "Lain-lain";

export interface CashflowEntry {
  id: string;
  projectId?: string;
  date: string;
  type: CashflowType;
  category: CashflowCategory;
  referenceType?: "ClientPayment" | "VendorPayment" | "ProjectExpense" | "Manual";
  referenceId?: string;
  referenceNumber?: string;
  description: string;
  amount: number;
  runningBalance?: number;
  createdBy?: string;
  createdAt: string;
}

export interface BankAccountInfo {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isDefault?: boolean;
}

export interface CompanySettings {
  id: string;
  companyName: string; // "PT. Asa Perdana Mandiri"
  brandName: string; // "MDrawing"
  tagline: string; // "Sistem Manajemen Gambar & Keuangan Proyek"
  address: string;
  city: string;
  postalCode?: string;
  phone: string;
  email: string;
  website?: string;
  taxId: string; // NPWP
  bankAccounts: BankAccountInfo[];
  logoUrl?: string;
  stampUrl?: string;
  signatureUrl?: string;
  defaultSignatoryName: string;
  defaultSignatoryTitle: string;
  invoiceTerms?: string;
  quotationTerms?: string;
  updatedAt: string;
}

export type PdfTemplateType = 
  | "quotation"
  | "invoice"
  | "clientPayment"
  | "vendorBill"
  | "vendorPayment"
  | "cashflowReport"
  | "profitLossReport"
  | "financialReport"
  | "transmittal";

export interface PdfTemplate {
  id: string;
  templateType: PdfTemplateType;
  name: string;
  headerTitle: string;
  subHeader?: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyTaxId?: string;
  primaryColor: string;
  termsAndConditions: string;
  footerNote: string;
  signatoryName: string;
  signatoryTitle: string;
  showLetterhead: boolean;
  updatedAt: string;
}

export type GeneratedDocumentType =
  | "Quotation"
  | "Invoice"
  | "ClientPaymentReceipt"
  | "VendorBill"
  | "VendorPaymentReceipt"
  | "ExpenseReport"
  | "CashflowReport"
  | "ProfitLossReport"
  | "ConsolidatedFinanceReport"
  | "DrawingTransmittal"
  | "Other";

export interface GeneratedDocument {
  id: string;
  projectId?: string;
  projectName?: string;
  documentType: GeneratedDocumentType;
  documentNumber: string;
  title: string;
  version: number;
  fileUrl?: string;
  fileFormat: "PDF" | "XLSX";
  createdBy: string;
  createdByName: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

