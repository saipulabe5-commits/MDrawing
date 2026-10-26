/**
 * MDrawing Unified Permission Matrix & Security Specification
 * 
 * Defines the authoritative permission rules across:
 * - Frontend UI (Navigation, Buttons, Masking)
 * - Server Express APIs (/api/*)
 * - Cloud Firestore Security Rules (firestore.rules)
 * - Cloud Storage Security Rules (storage.rules)
 */

import { CanonicalUserRole } from "../types";
import { Capability } from "./authorization";

export interface PermissionDefinition {
  description: string;
  allowedRoles: CanonicalUserRole[];
  scope: "COMPANY_WIDE" | "PROJECT_ASSIGNED" | "CREATOR_ONLY" | "SELF_ONLY";
  requiresActive: true;
  explicitDenyOverridesRole: boolean;
}

/**
 * 1. Base Role Capability Defaults
 */
export const BASE_ROLE_CAPABILITIES: Record<CanonicalUserRole, Capability[]> = {
  OWNER: [
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
  ],
  ADMIN: [
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
  ],
  FINANCE: [
    "canViewFinance",
    "canEditFinance",
    "canApproveFinance",
    "canViewVendorCost",
    "canViewClientInvoice",
    "canViewVendorPayment",
    "canExportFinanceReport",
    "canManageVendor",
  ],
  PROJECT_LEADER: [
    "canEditProject",
    "canManageDrawingRegister",
    "canUpdateDrawingStatus",
    "canManageTransmittal",
  ],
  TEAM: [
    "canUpdateDrawingStatus",
  ],
  VIEWER: [],
  CLIENT_VIEWER: [],
};

/**
 * 2. Scope Matrix: Who has Company-Wide vs Project-Assigned Access
 */
export const SCOPE_POLICY = {
  COMPANY_WIDE_ROLES: ["OWNER", "ADMIN"] as CanonicalUserRole[],
  PROJECT_SCOPED_ROLES: ["FINANCE", "PROJECT_LEADER", "TEAM", "VIEWER", "CLIENT_VIEWER"] as CanonicalUserRole[],
};

/**
 * 3. Commercial & Quotation Governance (AUD-07 & AUD-08)
 */
export const QUOTATION_RULES = {
  READ: {
    requiresActive: true,
    requiresCapability: "canViewFinance" as Capability,
    allowedScopes: {
      COMPANY_WIDE: ["OWNER", "ADMIN"],
      PROJECT_ASSIGNED: ["FINANCE", "PROJECT_LEADER", "TEAM", "VIEWER", "CLIENT_VIEWER"], // provided they have canViewFinance
      PIPELINE_UNASSIGNED: "CREATOR_OR_COMPANY_WIDE", // creator UID or OWNER/ADMIN
    },
    nonFinanceMasking: "PRICE_AND_AMOUNTS_MUST_BE_MASKED_OR_DENIED",
  },
  CREATE: {
    requiresActive: true,
    requiresCapability: "canEditFinance" as Capability,
    allowedRoles: ["OWNER", "ADMIN", "FINANCE"],
  },
  UPDATE: {
    requiresActive: true,
    requiresCapability: "canEditFinance" as Capability,
    allowedScopes: {
      PROJECT_ASSIGNED: "MUST_HAVE_PROJECT_MUTATE_ACCESS",
      PIPELINE_UNASSIGNED: "CREATOR_OR_COMPANY_WIDE",
    },
  },
  DELETE: {
    requiresActive: true,
    rules: [
      "OWNER and ADMIN can delete any quotation",
      "Non-owners can ONLY delete status == 'Draft'",
      "Must have canEditFinance == true",
      "Must be within authorized scope: assigned project + creator UID, or pipeline creator UID",
      "VIEWER and TEAM without edit finance can NEVER delete a quotation",
    ],
  },
};

/**
 * 4. User Profile Isolation & PIC Directory (AUD-15)
 */
export const USER_SECURITY_ISOLATION = {
  FULL_SECURITY_DOC: {
    collection: "users/{userId}",
    get: "SELF_OR_OWNER_OR_ADMIN",
    list: "OWNER_OR_ADMIN_ONLY",
    sensitiveFields: [
      "canViewFinance",
      "canEditFinance",
      "canApproveFinance",
      "canExportFinanceReport",
      "canVoidFinanceTransaction",
      "canEditPaidTransaction",
      "canViewVendorCost",
      "canViewVendorPayment",
      "canManageTransmittal",
      "assignedProjectIds",
      "role",
    ],
  },
  PUBLIC_PIC_DIRECTORY: {
    collection: "userDirectory/{userId}",
    get: "ANY_ACTIVE_USER",
    list: "ANY_ACTIVE_USER",
    allowedFields: [
      "uid",
      "name",
      "email",
      "role",
      "isActive",
      "updatedAt",
    ],
    forbiddenFields: [
      "canViewFinance",
      "canEditFinance",
      "canApproveFinance",
      "canExportFinanceReport",
      "canVoidFinanceTransaction",
      "canEditPaidTransaction",
      "canViewVendorCost",
      "canViewVendorPayment",
      "canManageTransmittal",
      "assignedProjectIds",
    ],
  },
};

/**
 * 5. Deterministic Conflict Resolution Invariants (AUD-11)
 * 
 * 1. INACTIVE ALWAYS DENIED:
 *    If user.isActive !== true, ALL requests are REJECTED across UI, API, Rules, Storage.
 * 
 * 2. OWNER EXEMPTION:
 *    Active OWNER possesses unconditional access to all features and all projects.
 * 
 * 3. EXPLICIT DENY WINS (AUD-11):
 *    For non-OWNER users, if user[capability] === false (or Firestore get(cap, true) == false),
 *    the capability is DENIED regardless of whether their role (e.g., FINANCE or ADMIN)
 *    ordinarily includes it in BASE_ROLE_CAPABILITIES.
 * 
 * 4. EXPLICIT GRANT:
 *    If user[capability] === true, the capability is GRANTED even if base role lacks it,
 *    provided user.isActive === true and project assignment scope allows it.
 * 
 * 5. ROLE FALLBACK:
 *    If capability is undefined/not set on the user document, fallback to BASE_ROLE_CAPABILITIES[user.role].
 */
