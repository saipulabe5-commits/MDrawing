import { AppUser, CanonicalUserRole } from "../types";

export type Capability =
  | "canViewFinance"
  | "canEditFinance"
  | "canApproveFinance"
  | "canViewProfit"
  | "canViewVendorCost"
  | "canViewClientInvoice"
  | "canViewVendorPayment"
  | "canExportFinanceReport"
  | "canVoidFinanceTransaction"
  | "canEditPaidTransaction"
  | "canCreateProject"
  | "canEditProject"
  | "canDeleteProject"
  | "canManageDrawingRegister"
  | "canUpdateDrawingStatus"
  | "canManageTransmittal"
  | "canManageVendor";

// Canonical Base Permissions by Role (Strict RBAC with explicit capability overrides)
const BASE_ROLE_PERMISSIONS: Record<CanonicalUserRole, Set<Capability>> = {
  OWNER: new Set([
    "canViewFinance",
    "canEditFinance",
    "canApproveFinance",
    "canViewProfit",
    "canViewVendorCost",
    "canViewClientInvoice",
    "canViewVendorPayment",
    "canExportFinanceReport",
    "canVoidFinanceTransaction",
    "canEditPaidTransaction",
    "canCreateProject",
    "canEditProject",
    "canDeleteProject",
    "canManageDrawingRegister",
    "canUpdateDrawingStatus",
    "canManageTransmittal",
    "canManageVendor",
  ]),
  ADMIN: new Set([
    "canViewFinance",
    "canEditFinance",
    "canApproveFinance",
    "canViewProfit",
    "canViewVendorCost",
    "canViewClientInvoice",
    "canViewVendorPayment",
    "canExportFinanceReport",
    "canCreateProject",
    "canEditProject",
    "canManageDrawingRegister",
    "canUpdateDrawingStatus",
    "canManageTransmittal",
    "canManageVendor",
  ]),
  FINANCE: new Set([
    "canViewFinance",
    "canEditFinance",
    "canApproveFinance",
    "canViewVendorCost",
    "canViewClientInvoice",
    "canViewVendorPayment",
    "canExportFinanceReport",
    "canManageVendor",
  ]),
  PROJECT_LEADER: new Set([
    "canEditProject",
    "canManageDrawingRegister",
    "canUpdateDrawingStatus",
    "canManageTransmittal",
  ]),
  TEAM: new Set([
    "canUpdateDrawingStatus",
  ]),
  VIEWER: new Set([]),
  CLIENT_VIEWER: new Set([]),
};

/**
 * Single source of truth for capability authorization.
 * Evaluates both the base role and granular capability overrides with explicit deny protection.
 */
export function hasCapability(user: AppUser | null, capability: Capability): boolean {
  if (!user || !user.isActive) return false;
  
  // Owner has unconditional authorized access
  if (user.role === "OWNER") return true;

  // Explicit boolean override on user model takes precedence:
  // If explicitly set to false, it denies even if the role normally allows it.
  if (user[capability] === false) return false;
  if (user[capability] === true) return true;

  // Evaluate canonical base permissions by role
  const basePermissions = BASE_ROLE_PERMISSIONS[user.role];
  return basePermissions ? basePermissions.has(capability) : false;
}

export function canManageUsers(user: AppUser | null): boolean {
  if (!user || !user.isActive) return false;
  return user.role === "OWNER" || user.role === "ADMIN";
}

export function canManageProjects(user: AppUser | null): boolean {
  if (!user || !user.isActive) return false;
  return user.role === "OWNER" || user.role === "ADMIN" || user.role === "PROJECT_LEADER";
}

export function canManageTransmittal(user: AppUser | null): boolean {
  if (!user || !user.isActive) return false;
  return hasCapability(user, "canManageTransmittal");
}

export function canAccessProject(user: AppUser | null, projectId: string): boolean {
  if (!user || !user.isActive || !projectId) return false;
  // OWNER and ADMIN have company-wide project access
  if (user.role === "OWNER" || user.role === "ADMIN") return true;
  
  // Non-admin roles (FINANCE, PROJECT_LEADER, TEAM, VIEWER, CLIENT_VIEWER) must be assigned
  return Array.isArray(user.assignedProjectIds) && user.assignedProjectIds.includes(projectId);
}

export function canReadProjectData(user: AppUser | null, projectId: string): boolean {
  if (!user || !user.isActive) return false;
  return canAccessProject(user, projectId);
}

export function canWriteProjectData(user: AppUser | null, projectId: string): boolean {
  if (!user || !user.isActive || !projectId) return false;
  if (user.role === "OWNER" || user.role === "ADMIN") return true;
  if (user.role === "PROJECT_LEADER" && canAccessProject(user, projectId)) return true;
  if (user.role === "TEAM" && canAccessProject(user, projectId)) {
    return hasCapability(user, "canUpdateDrawingStatus");
  }
  return false;
}

export function canDeleteProjectData(user: AppUser | null, projectId: string): boolean {
  if (!user || !user.isActive || !projectId) return false;
  if (user.role === "OWNER") return true;
  if (user.role === "ADMIN") return hasCapability(user, "canDeleteProject");
  return false;
}

export function canApproveFinancialMutation(user: AppUser | null, projectId?: string): boolean {
  if (!user || !user.isActive) return false;
  if (projectId && !canAccessProject(user, projectId)) return false;
  return hasCapability(user, "canApproveFinance");
}

export function canVoidFinancialMutation(user: AppUser | null, projectId?: string): boolean {
  if (!user || !user.isActive) return false;
  if (projectId && !canAccessProject(user, projectId)) return false;
  return hasCapability(user, "canVoidFinanceTransaction");
}

export function isCompanyWideFinanceRole(user: AppUser | null): boolean {
  if (!user || !user.isActive) return false;
  return user.role === "OWNER" || user.role === "ADMIN";
}

export function getAllowedFinanceProjectIds(user: AppUser | null, allProjects: { id: string }[]): string[] {
  if (!user || !user.isActive) return [];
  if (isCompanyWideFinanceRole(user)) {
    return allProjects.map((p) => p.id);
  }
  return user.assignedProjectIds || [];
}

export interface QuotationScopeCheck {
  id?: string;
  projectId?: string | null;
  createdBy?: string;
  status?: string;
}

/**
 * Check if user is authorized to read the quotation.
 * Requires active status and canViewFinance capability within proper scope (AUD-07).
 */
export function canReadQuotation(user: AppUser | null, quotation: QuotationScopeCheck): boolean {
  if (!user || !user.isActive) return false;
  if (!hasCapability(user, "canViewFinance")) return false;

  // Company-wide finance authority
  if (isCompanyWideFinanceRole(user)) return true;

  // Project-associated quotation
  if (quotation.projectId && quotation.projectId.trim() !== '') {
    return canAccessProject(user, quotation.projectId);
  }

  // Pipeline quotation (no projectId)
  return Boolean(quotation.createdBy && quotation.createdBy === user.uid);
}

/**
 * Helper to determine if quotation financial prices/totals should be visible.
 * Without canViewFinance and proper scope, pricing must be masked/hidden (AUD-07).
 */
export function canViewQuotationPrice(user: AppUser | null, quotation: QuotationScopeCheck): boolean {
  return canReadQuotation(user, quotation);
}

/**
 * Check if user is authorized to create a quotation.
 */
export function canCreateQuotation(user: AppUser | null, quotation: Partial<QuotationScopeCheck>): boolean {
  if (!user || !user.isActive) return false;
  if (!hasCapability(user, "canEditFinance") && user.role !== "OWNER" && user.role !== "ADMIN") return false;

  if (isCompanyWideFinanceRole(user)) return true;

  if (quotation.projectId && quotation.projectId.trim() !== '') {
    return canAccessProject(user, quotation.projectId);
  }

  return true;
}

/**
 * Check if user is authorized to update a quotation.
 */
export function canUpdateQuotation(user: AppUser | null, quotation: QuotationScopeCheck): boolean {
  if (!user || !user.isActive) return false;
  if (!hasCapability(user, "canEditFinance") && user.role !== "OWNER" && user.role !== "ADMIN") return false;

  if (isCompanyWideFinanceRole(user)) return true;

  if (quotation.projectId && quotation.projectId.trim() !== '') {
    return canAccessProject(user, quotation.projectId);
  }

  return Boolean(quotation.createdBy && quotation.createdBy === user.uid);
}

/**
 * Check if user is authorized to delete a quotation.
 * Strictly enforces that VIEWER, unassigned, or non-owners cannot delete other users' drafts (AUD-08).
 */
export function canDeleteQuotation(user: AppUser | null, quotation: QuotationScopeCheck): boolean {
  if (!user || !user.isActive) return false;
  
  // OWNER and ADMIN can delete any quotation
  if (user.role === "OWNER" || user.role === "ADMIN") return true;

  // Non-owners can ONLY delete Draft status quotations
  const status = (quotation.status || "").toUpperCase();
  if (status !== "DRAFT") return false;

  // Must have edit finance capability
  if (!hasCapability(user, "canEditFinance")) return false;

  // Must be within authorized scope and creator
  if (quotation.projectId && quotation.projectId.trim() !== '') {
    return canAccessProject(user, quotation.projectId) && quotation.createdBy === user.uid;
  }

  return Boolean(quotation.createdBy && quotation.createdBy === user.uid);
}



