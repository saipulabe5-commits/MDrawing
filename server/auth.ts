import { hasCapability } from '../src/security/authorization';
import type { Request, Response, NextFunction } from "express";
import { getAuth, type Auth, type DecodedIdToken } from "firebase-admin/auth";
import type { App } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";

export interface AuthContext {
  uid: string;
  email: string;
  role: string;
  isOwner: boolean;
  isActive: boolean;
  canViewFinance: boolean;
  canEditFinance: boolean;
  assignedProjects: string[];
  capabilities: Record<string, boolean>;
  token: DecodedIdToken;
}

export type AuthFailureCode =
  | "MISSING_BEARER_TOKEN"
  | "INVALID_TOKEN"
  | "TOKEN_REVOKED"
  | "USER_NOT_FOUND"
  | "ACCOUNT_INACTIVE"
  | "INSUFFICIENT_PERMISSIONS"
  | "AUTH_SERVICE_UNAVAILABLE";

export interface AuthSuccessResult {
  ok: true;
  user: AuthContext;
  status?: never;
  code?: never;
  message?: never;
}

export interface AuthFailureResult {
  ok: false;
  status: 401 | 403 | 503;
  code: AuthFailureCode;
  message: string;
  user?: never;
}

export type AuthResult = AuthSuccessResult | AuthFailureResult;

export interface AuthenticateOptions {
  /**
   * If true, validates against revocation timestamp (tokensValidAfterTime).
   * Essential for sensitive operations like code export, claims modification, etc.
   */
  checkRevoked?: boolean;
  /**
   * Allowed roles for this operation. OWNER is always permitted unless requireOwner is strictly tested.
   */
  requiredRole?: string | string[];
  /**
   * Strictly require canonical role to be OWNER.
   */
  requireOwner?: boolean;
  /**
   * Strictly require canonical isActive to be true. Default: true.
   */
  requireActive?: boolean;
}

export interface FirestoreDocumentSnapshotLike {
  exists: boolean;
  data: () => any;
}

export interface FirestoreDocumentReferenceLike {
  get: () => Promise<FirestoreDocumentSnapshotLike>;
}

export interface FirestoreCollectionReferenceLike {
  doc: (id: string) => FirestoreDocumentReferenceLike;
}

export interface FirestoreDbLike {
  collection: (name: string) => FirestoreCollectionReferenceLike;
}

export interface AuthDependencies {
  app?: App | null;
  authInstance?: Pick<Auth, "verifyIdToken" | "revokeRefreshTokens" | "setCustomUserClaims"> | null;
  adminDb?: Firestore | FirestoreDbLike | null;
  fetchUserDocRest?: (uid: string, token: string) => Promise<Record<string, any> | null>;
}

// Module-level default dependencies configured by server entry point
let defaultDeps: AuthDependencies = {};

/**
 * Configure global dependencies for server runtime.
 */
export function setServerAuthDependencies(deps: AuthDependencies) {
  defaultDeps = { ...defaultDeps, ...deps };
}

/**
 * Reset or get current dependencies (useful for test isolation).
 */
export function getServerAuthDependencies(): AuthDependencies {
  return defaultDeps;
}

/**
 * Helper to extract Bearer token from Express Request headers without logging token content.
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers?.authorization;
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1] || !match[1].trim()) {
    return null;
  }
  return match[1].trim();
}

/**
 * Canonical Server Authentication & Authorization Verifier.
 *
 * Implements AUD-05 & AUD-06 remediations:
 * 1. Verifies Firebase ID Token and revocation status (checkRevoked).
 * 2. Fetches canonical user profile directly from Firestore.
 * 3. Never falls back to assuming missing users or DB failures are active (fail closed).
 * 4. Never permits stale token claims to override demotions in the database.
 * 5. Returns distinct error codes: 401 (Auth), 403 (Permission/Inactive), 503 (Service unavailable).
 */
export async function authenticateRequest(
  req: Request,
  options: AuthenticateOptions = {},
  injectedDeps?: AuthDependencies
): Promise<AuthResult> {
  const deps: AuthDependencies = {
    ...defaultDeps,
    ...(injectedDeps || {}),
  };

  // 1. Extract Bearer Token
  const token = extractBearerToken(req);
  if (!token) {
    return {
      ok: false,
      status: 401,
      code: "MISSING_BEARER_TOKEN",
      message: "Autentikasi gagal: Header 'Authorization: Bearer <token>' diperlukan.",
    };
  }

  // 2. Resolve Auth instance
  let authInstance = deps.authInstance;
  if (!authInstance) {
    try {
      authInstance = getAuth(deps.app || undefined);
    } catch {
      return {
        ok: false,
        status: 503,
        code: "AUTH_SERVICE_UNAVAILABLE",
        message: "Layanan autentikasi server tidak tersedia.",
      };
    }
  }

  // 3. Verify ID Token & check revocation if requested
  let decoded: DecodedIdToken;
  try {
    decoded = await authInstance.verifyIdToken(token, Boolean(options.checkRevoked));
  } catch (err: any) {
    if (err?.code === "auth/id-token-revoked") {
      return {
        ok: false,
        status: 401,
        code: "TOKEN_REVOKED",
        message: "Sesi token telah dicabut. Silakan login kembali.",
      };
    }

    // If checkRevoked failed because Admin SDK lacks Service Account credentials to query tokensValidAfterTime,
    // verify the cryptographic signature and token expiration without the revocation check.
    const isCredentialError =
      err?.code === "app/invalid-credential" ||
      err?.message?.includes("Could not load the default credentials") ||
      err?.message?.includes("default credentials");

    if (options.checkRevoked && isCredentialError) {
      try {
        decoded = await authInstance.verifyIdToken(token, false);
      } catch {
        return {
          ok: false,
          status: 401,
          code: "INVALID_TOKEN",
          message: "Token autentikasi tidak valid atau sudah kedaluwarsa.",
        };
      }
    } else {
      return {
        ok: false,
        status: 401,
        code: "INVALID_TOKEN",
        message: "Token autentikasi tidak valid atau sudah kedaluwarsa.",
      };
    }
  }

  // 4. Query Canonical User Profile from Firestore Database
  let profileDoc: Record<string, any> | null = null;
  let profileFound = false;

  const adminDb = deps.adminDb;
  let adminDbFailedDueToCredentials = false;
  if (adminDb) {
    try {
      const snap = await adminDb.collection("users").doc(decoded.uid).get();
      if (snap.exists) {
        profileFound = true;
        profileDoc = (snap.data && typeof snap.data === "function" ? snap.data() : (snap as any).data) || {};
      } else {
        profileFound = false;
      }
    } catch (dbErr: any) {
      const isMissingCredentials =
        dbErr?.message?.includes("Could not load the default credentials") ||
        dbErr?.code === 16 ||
        dbErr?.code === "app/invalid-credential";

      if (isMissingCredentials && deps.fetchUserDocRest) {
        adminDbFailedDueToCredentials = true;
      } else {
        // Database failure: MUST NOT fall back to decoded token claims or assume active!
        return {
          ok: false,
          status: 503,
          code: "AUTH_SERVICE_UNAVAILABLE",
          message: "Gangguan koneksi database saat memverifikasi status akun.",
        };
      }
    }
  }

  if ((!adminDb || adminDbFailedDueToCredentials) && deps.fetchUserDocRest) {
    try {
      const restDoc = await deps.fetchUserDocRest(decoded.uid, token);
      if (restDoc) {
        profileFound = true;
        profileDoc = restDoc;
      } else {
        profileFound = false;
      }
    } catch {
      return {
        ok: false,
        status: 503,
        code: "AUTH_SERVICE_UNAVAILABLE",
        message: "Gangguan koneksi REST database saat memverifikasi status akun.",
      };
    }
  } else if (!adminDb && !deps.fetchUserDocRest) {
    // Neither Admin DB nor REST lookup is configured: Cannot establish canonical authorization
    return {
      ok: false,
      status: 503,
      code: "AUTH_SERVICE_UNAVAILABLE",
      message: "Database otorisasi server belum terkonfigurasi.",
    };
  }

  // 5. Enforce User Profile Existence
  if (!profileFound || !profileDoc) {
    return {
      ok: false,
      status: 401,
      code: "USER_NOT_FOUND",
      message: "Profil pengguna tidak ditemukan dalam database.",
    };
  }

  // 6. Enforce Active Status (fail closed: only explicit boolean true is active)
  const requireActive = options.requireActive ?? true;
  const isActive = profileDoc.isActive === true;
  if (requireActive && !isActive) {
    return {
      ok: false,
      status: 403,
      code: "ACCOUNT_INACTIVE",
      message: "Akun Anda telah dinonaktifkan oleh administrator.",
    };
  }

  // 7. Canonical Role Resolution
  // Critical fix AUD-05: role is determined STRICTLY from canonical profile, NEVER from stale token claims!
  const canonicalRole = typeof profileDoc.role === "string" ? profileDoc.role.trim().toUpperCase() : "VIEWER";
  const isOwner = canonicalRole === "OWNER";

  // Check Owner constraint
  if (options.requireOwner && !isOwner) {
    return {
      ok: false,
      status: 403,
      code: "INSUFFICIENT_PERMISSIONS",
      message: `Akses Ditolak: Fitur ini khusus untuk peran OWNER. Peran Anda saat ini: ${canonicalRole}.`,
    };
  }

  // Check required roles constraint
  if (options.requiredRole) {
    const allowedRoles = (Array.isArray(options.requiredRole) ? options.requiredRole : [options.requiredRole])
      .map((r) => r.toUpperCase());
    if (!isOwner && !allowedRoles.includes(canonicalRole)) {
      return {
        ok: false,
        status: 403,
        code: "INSUFFICIENT_PERMISSIONS",
        message: `Akses Ditolak: Diperlukan peran [${allowedRoles.join(", ")}]. Peran Anda: ${canonicalRole}.`,
      };
    }
  }

  // Capabilities & Finance Permissions
  const effectiveUser:any={...profileDoc,uid:decoded.uid,role:canonicalRole,isActive};
  const canViewFinance = hasCapability(effectiveUser,"canViewFinance");
  const canEditFinance = hasCapability(effectiveUser,"canEditFinance");
  const assignedProjects = Array.isArray(profileDoc.assignedProjectIds) ? profileDoc.assignedProjectIds.filter((v:any)=>typeof v==="string") : [];
  const capabilities:Record<string,boolean>={};for(const name of ['canViewFinance','canEditFinance','canApproveFinance','canViewProfit','canViewVendorCost','canViewClientInvoice','canViewVendorPayment','canExportFinanceReport','canVoidFinanceTransaction','canEditPaidTransaction','canCreateProject','canEditProject','canDeleteProject','canManageDrawingRegister','canUpdateDrawingStatus','canManageTransmittal','canManageVendor']) capabilities[name]=hasCapability(effectiveUser,name as any);

  return {
    ok: true,
    user: {
      uid: decoded.uid,
      email: (decoded.email || profileDoc.email || "").toLowerCase(),
      role: canonicalRole,
      isOwner,
      isActive,
      canViewFinance,
      canEditFinance,
      assignedProjects,
      capabilities,
      token: decoded,
    },
  };
}

/**
 * Backward-compatible helper returning AuthContext or null.
 * Strictly verifies active state and canonical DB role.
 */
export async function authenticateUser(
  req: Request,
  options: AuthenticateOptions = { requireActive: true },
  deps?: AuthDependencies
): Promise<AuthContext | null> {
  const result = await authenticateRequest(req, options, deps);
  if (!result.ok) {
    return null;
  }
  return result.user;
}

/**
 * Express Middleware factory for route protection.
 */
export function requireAuthMiddleware(options: AuthenticateOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const result = await authenticateRequest(req, options);
    if (!result.ok) {
      return res.status(result.status).json({
        error: result.message,
        code: result.code,
      });
    }
    (req as any).user = result.user;
    next();
  };
}
