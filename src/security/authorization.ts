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
  // FINANCE and VIEWER have global read-level access if allowed by policy
  if (user.role === "FINANCE" || user.role === "VIEWER") return true;
  
  // CLIENT_VIEWER, TEAM, PROJECT_LEADER must be explicitly assigned to the project
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
  return user.role === "OWNER" || user.role === "ADMIN" || user.role === "FINANCE";
}

export function getAllowedFinanceProjectIds(user: AppUser | null, allProjects: { id: string }[]): string[] {
  if (!user || !user.isActive) return [];
  if (isCompanyWideFinanceRole(user)) {
    return allProjects.map((p) => p.id);
  }
  return user.assignedProjectIds || [];
}


