/**
 * MDrawing Automated Security Test Suite — Tahap 03
 * Verifies Quotation Governance, Project Scope Isolation, Explicit Deny Precedence, and User Directory Isolation
 * 
 * AUD-07: Pengguna tanpa finance tidak dapat membaca harga quotation.
 * AUD-08: VIEWER tidak dapat menghapus Draft quotation proyek lain / pengguna lain.
 * AUD-11: Explicit deny capability mengalahkan fallback role (kecuali OWNER aktif).
 * AUD-15: Isolasi profil keamanan pengguna dan direktori PIC minimal.
 */

import { RulesEvaluator, AuthContext, DatabaseState } from "./rulesEvaluator";
import { 
  hasCapability, 
  canAccessProject, 
  canReadQuotation, 
  canCreateQuotation, 
  canUpdateQuotation, 
  canDeleteQuotation,
  canViewQuotationPrice,
  isCompanyWideFinanceRole,
} from "./authorization";
import { 
  sanitizeUserForPublicDirectory, 
  PublicUserDirectoryItem 
} from "./userDirectory";
import { AppUser } from "../types";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passedCount++;
    console.log(`✅ [PASS] ${message}`);
  } else {
    failedCount++;
    console.error(`❌ [FAIL] ${message}`);
  }
}

// -------------------------------------------------------------
// Test Fixtures
// -------------------------------------------------------------
const ownerUser: AppUser = {
  uid: "usr-owner-1",
  name: "Owner User",
  email: "owner@mdrawing.com",
  role: "OWNER",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const adminUser: AppUser = {
  uid: "usr-admin-1",
  name: "Admin User",
  email: "admin@mdrawing.com",
  role: "ADMIN",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const financeAssignedProjA: AppUser = {
  uid: "usr-finance-assigned",
  name: "Finance Proj A",
  email: "finance.a@mdrawing.com",
  role: "FINANCE",
  isActive: true,
  assignedProjectIds: ["proj-alpha"],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const financeExplicitDeniedFinance: AppUser = {
  uid: "usr-finance-denied",
  name: "Finance Restricted",
  email: "finance.restricted@mdrawing.com",
  role: "FINANCE",
  isActive: true,
  canViewFinance: false,
  canEditFinance: false,
  assignedProjectIds: ["proj-alpha"],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const adminExplicitDeniedFinance: AppUser = {
  uid: "usr-admin-denied",
  name: "Admin Restricted",
  email: "admin.restricted@mdrawing.com",
  role: "ADMIN",
  isActive: true,
  canViewFinance: false,
  canEditFinance: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const teamMemberProjA: AppUser = {
  uid: "usr-team-1",
  name: "Team Drafter Proj A",
  email: "drafter@mdrawing.com",
  role: "TEAM",
  isActive: true,
  assignedProjectIds: ["proj-alpha"],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const viewerUser: AppUser = {
  uid: "usr-viewer-1",
  name: "Viewer User",
  email: "viewer@mdrawing.com",
  role: "VIEWER",
  isActive: true,
  assignedProjectIds: ["proj-alpha"],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const inactiveOwnerUser: AppUser = {
  uid: "usr-owner-inactive",
  name: "Owner Inactive",
  email: "owner.off@mdrawing.com",
  role: "OWNER",
  isActive: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const inactiveFinanceUser: AppUser = {
  uid: "usr-finance-inactive",
  name: "Finance Inactive",
  email: "finance.off@mdrawing.com",
  role: "FINANCE",
  isActive: false,
  assignedProjectIds: ["proj-alpha"],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

// Database Mock State
const mockDb: DatabaseState = {
  users: {
    [ownerUser.uid]: ownerUser,
    [adminUser.uid]: adminUser,
    [financeAssignedProjA.uid]: financeAssignedProjA,
    [financeExplicitDeniedFinance.uid]: financeExplicitDeniedFinance,
    [adminExplicitDeniedFinance.uid]: adminExplicitDeniedFinance,
    [teamMemberProjA.uid]: teamMemberProjA,
    [viewerUser.uid]: viewerUser,
    [inactiveOwnerUser.uid]: inactiveOwnerUser,
    [inactiveFinanceUser.uid]: inactiveFinanceUser,
  },
  projects: {
    "proj-alpha": {
      id: "proj-alpha",
      code: "PRJ-ALPHA",
      name: "Project Alpha",
      members: [financeAssignedProjA.uid, teamMemberProjA.uid, viewerUser.uid],
    },
    "proj-beta": {
      id: "proj-beta",
      code: "PRJ-BETA",
      name: "Project Beta",
      members: [],
    },
  },
};

const evaluator = new RulesEvaluator(mockDb);

function authCtx(user: AppUser | null): AuthContext | null {
  if (!user) return null;
  return {
    uid: user.uid,
    token: {
      role: user.role,
      email: user.email,
    },
  };
}

// -------------------------------------------------------------
// Test 1: VIEWER / TEAM tanpa finance tidak dapat membaca harga quotation (AUD-07)
// -------------------------------------------------------------
console.log("\n--- TEST 1: AUD-07 — Akses Quotation Tanpa Finance Ditolak ---");

const quoProjA = {
  id: "quo-alpha-1",
  projectId: "proj-alpha",
  createdBy: "usr-finance-assigned",
  status: "Draft",
  grandTotal: 50000000,
};

const quoPipeline = {
  id: "quo-pipeline-1",
  projectId: null,
  createdBy: "usr-finance-assigned",
  status: "Draft",
  grandTotal: 100000000,
};

// Negative Controls: VIEWER & TEAM assigned to project Alpha
assert(
  !canReadQuotation(viewerUser, quoProjA),
  "Frontend: VIEWER pada proyek Alpha ditolak membaca quotation proyek Alpha (tidak memiliki canViewFinance)"
);
assert(
  !canViewQuotationPrice(viewerUser, quoProjA),
  "Frontend: VIEWER ditolak melihat rincian harga quotation proyek Alpha"
);
assert(
  !evaluator.evaluateQuotationRead(authCtx(viewerUser), quoProjA),
  "Rules: VIEWER ditolak get/list quotation proyek Alpha"
);

assert(
  !canReadQuotation(teamMemberProjA, quoProjA),
  "Frontend: TEAM drafter pada proyek Alpha ditolak membaca quotation proyek Alpha (tidak memiliki canViewFinance)"
);
assert(
  !evaluator.evaluateQuotationRead(authCtx(teamMemberProjA), quoProjA),
  "Rules: TEAM drafter ditolak get/list quotation proyek Alpha"
);

// Negative Controls: Pipeline quotation without projectId
assert(
  !canReadQuotation(viewerUser, quoPipeline),
  "Frontend: VIEWER ditolak membaca pipeline quotation yang dibuat user lain"
);
assert(
  !evaluator.evaluateQuotationRead(authCtx(viewerUser), quoPipeline),
  "Rules: VIEWER ditolak membaca pipeline quotation yang dibuat user lain"
);
assert(
  !evaluator.evaluateQuotationRead(authCtx(teamMemberProjA), quoPipeline),
  "Rules: TEAM ditolak membaca pipeline quotation tanpa projectId"
);

// -------------------------------------------------------------
// Test 2: VIEWER tidak dapat menghapus Draft quotation milik pengguna/proyek lain (AUD-08)
// -------------------------------------------------------------
console.log("\n--- TEST 2: AUD-08 — Larangan VIEWER & Pengguna Lain Menghapus Draft Quotation ---");

assert(
  !canDeleteQuotation(viewerUser, quoProjA),
  "Frontend: VIEWER ditolak menghapus Draft quotation proyek Alpha"
);
assert(
  !evaluator.evaluateQuotationDelete(authCtx(viewerUser), quoProjA),
  "Rules: VIEWER ditolak delete Draft quotation proyek Alpha"
);

assert(
  !canDeleteQuotation(teamMemberProjA, quoProjA),
  "Frontend: TEAM drafter ditolak menghapus Draft quotation"
);
assert(
  !evaluator.evaluateQuotationDelete(authCtx(teamMemberProjA), quoProjA),
  "Rules: TEAM drafter ditolak delete Draft quotation"
);

// Unassigned / non-creator finance deleting someone else's draft
const otherFinanceUser: AppUser = {
  uid: "usr-finance-other",
  name: "Other Finance",
  email: "other.fin@mdrawing.com",
  role: "FINANCE",
  isActive: true,
  assignedProjectIds: ["proj-alpha"],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
mockDb.users[otherFinanceUser.uid] = otherFinanceUser;

assert(
  !canDeleteQuotation(otherFinanceUser, quoPipeline),
  "Frontend: Pengguna finance lain ditolak menghapus pipeline quotation milik user lain"
);
assert(
  !evaluator.evaluateQuotationDelete(authCtx(otherFinanceUser), quoPipeline),
  "Rules: Pengguna finance lain ditolak delete pipeline quotation milik user lain"
);

// Approved status cannot be deleted by creator or regular finance
const quoApproved = {
  id: "quo-approved-1",
  projectId: "proj-alpha",
  createdBy: "usr-finance-assigned",
  status: "AGREED",
};
assert(
  !canDeleteQuotation(financeAssignedProjA, quoApproved),
  "Frontend: Pembuat penawaran ditolak menghapus quotation berstatus 'AGREED' (hanya DRAFT yang dapat dihapus)"
);
assert(
  !evaluator.evaluateQuotationDelete(authCtx(financeAssignedProjA), quoApproved),
  "Rules: Pembuat penawaran ditolak delete quotation berstatus 'AGREED'"
);

// -------------------------------------------------------------
// Test 3: Explicit False Precedence (AUD-11)
// -------------------------------------------------------------
console.log("\n--- TEST 3: AUD-11 — Explicit False Capability Mengalahkan Role Fallback ---");

// Non-OWNER with explicit false: FINANCE role with canViewFinance: false
assert(
  hasCapability(financeExplicitDeniedFinance, "canViewFinance") === false,
  "Frontend: hasCapability mengembalikan FALSE untuk FINANCE yang memiliki override canViewFinance: false"
);
assert(
  !evaluator.canViewFinance(authCtx(financeExplicitDeniedFinance)),
  "Rules: canViewFinance mengembalikan FALSE untuk FINANCE yang memiliki override canViewFinance: false"
);
assert(
  !evaluator.evaluateQuotationRead(authCtx(financeExplicitDeniedFinance), quoProjA),
  "Rules: Operasi membaca quotation ditolak untuk FINANCE dengan override canViewFinance: false"
);

// Non-OWNER with explicit false: ADMIN role with canViewFinance: false
assert(
  hasCapability(adminExplicitDeniedFinance, "canViewFinance") === false,
  "Frontend: hasCapability mengembalikan FALSE untuk ADMIN yang memiliki override canViewFinance: false"
);
assert(
  !evaluator.canViewFinance(authCtx(adminExplicitDeniedFinance)),
  "Rules: canViewFinance mengembalikan FALSE untuk ADMIN yang memiliki override canViewFinance: false"
);

// Inactive accounts always denied across all roles (including OWNER)
assert(
  !hasCapability(inactiveOwnerUser, "canViewFinance"),
  "Frontend: Inactive OWNER ditolak mendapatkan kapabilitas apa pun"
);
assert(
  !evaluator.canViewFinance(authCtx(inactiveOwnerUser)),
  "Rules: Inactive OWNER ditolak canViewFinance"
);
assert(
  !evaluator.evaluateQuotationRead(authCtx(inactiveOwnerUser), quoProjA),
  "Rules: Inactive OWNER ditolak membaca quotation"
);

assert(
  !hasCapability(inactiveFinanceUser, "canViewFinance"),
  "Frontend: Inactive FINANCE ditolak mendapatkan kapabilitas"
);
assert(
  !evaluator.canViewFinance(authCtx(inactiveFinanceUser)),
  "Rules: Inactive FINANCE ditolak canViewFinance"
);

// Active OWNER retains capabilities unconditionally
const ownerWithFalseField: AppUser = {
  ...ownerUser,
  canViewFinance: false, // Inadvertent false field in database
};
assert(
  hasCapability(ownerWithFalseField, "canViewFinance") === true,
  "Frontend: Pemilik sah aktif (OWNER) tetap memiliki kapabilitas meskipun terdapat field false anomali"
);
assert(
  evaluator.canViewFinance(authCtx(ownerWithFalseField)) === true,
  "Rules: Pemilik sah aktif (OWNER) tetap berhak canViewFinance"
);

// -------------------------------------------------------------
// Test 4: Assigned vs Unassigned Scoped Decisions
// -------------------------------------------------------------
console.log("\n--- TEST 4: Scope Policy — Assigned vs Unassigned Projects ---");

const quoProjB = {
  id: "quo-beta-1",
  projectId: "proj-beta",
  createdBy: "usr-other",
  status: "Draft",
  grandTotal: 75000000,
};

// FINANCE assigned to Proj A attempting to access Proj B
assert(
  canAccessProject(financeAssignedProjA, "proj-alpha") === true,
  "Frontend: FINANCE assigned ke Proj Alpha berhak mengakses Proj Alpha"
);
assert(
  canAccessProject(financeAssignedProjA, "proj-beta") === false,
  "Frontend: FINANCE yang TIDAK ditugaskan ke Proj Beta DITOLAK mengakses Proj Beta"
);
assert(
  !canReadQuotation(financeAssignedProjA, quoProjB),
  "Frontend: FINANCE assigned ke Proj Alpha DITOLAK membaca quotation Proj Beta"
);
assert(
  !evaluator.evaluateQuotationRead(authCtx(financeAssignedProjA), quoProjB),
  "Rules: FINANCE assigned ke Proj Alpha DITOLAK get quotation Proj Beta"
);

// OWNER & ADMIN have company-wide access
assert(
  isCompanyWideFinanceRole(ownerUser) === true,
  "Frontend: OWNER diakui sebagai company-wide finance role"
);
assert(
  isCompanyWideFinanceRole(adminUser) === true,
  "Frontend: ADMIN diakui sebagai company-wide finance role"
);
assert(
  isCompanyWideFinanceRole(financeAssignedProjA) === false,
  "Frontend: FINANCE bukan company-wide finance role (wajib project-scoped)"
);
assert(
  canAccessProject(ownerUser, "proj-beta") === true,
  "Frontend: OWNER memiliki akses seluruh proyek (company-wide)"
);
assert(
  canAccessProject(adminUser, "proj-beta") === true,
  "Frontend: ADMIN memiliki akses seluruh proyek (company-wide)"
);

// -------------------------------------------------------------
// Test 5: PIC Directory Sanitization & Security Profile Isolation (AUD-15)
// -------------------------------------------------------------
console.log("\n--- TEST 5: AUD-15 — Isolasi Profil Keamanan & Direktori PIC Minimal ---");

const fullSecurityDoc = {
  uid: "usr-pic-sample",
  name: "Budi Drafter",
  email: "budi@mdrawing.com",
  role: "TEAM",
  isActive: true,
  canViewFinance: true,
  canEditFinance: true,
  canApproveFinance: true,
  canExportFinanceReport: true,
  canVoidFinanceTransaction: true,
  canEditPaidTransaction: true,
  canViewVendorCost: true,
  canViewVendorPayment: true,
  canManageTransmittal: true,
  assignedProjectIds: ["proj-alpha", "proj-secret"],
};

const sanitizedPIC = sanitizeUserForPublicDirectory(fullSecurityDoc);

assert(
  sanitizedPIC.uid === "usr-pic-sample" && sanitizedPIC.name === "Budi Drafter" && sanitizedPIC.email === "budi@mdrawing.com",
  "PIC Directory: Menyimpan identitas esensial PIC (uid, name, email, role, isActive)"
);
assert(
  !("canViewFinance" in sanitizedPIC) && !("canEditFinance" in sanitizedPIC) && !("canApproveFinance" in sanitizedPIC),
  "PIC Directory: Seluruh kapabilitas finansial PRIVILEGED disaring dan tidak bocor"
);
assert(
  !("assignedProjectIds" in sanitizedPIC),
  "PIC Directory: Daftar proyek rahasia (assignedProjectIds) disaring dari profil PIC"
);

// Rules evaluation for /users vs /userDirectory
assert(
  !evaluator.evaluateUserDocRead(authCtx(viewerUser), "usr-admin-1"),
  "Rules: VIEWER DITOLAK membaca dokumen profil keamanan lengkap milik user lain (/users/{adminId})"
);
assert(
  evaluator.evaluateUserDocRead(authCtx(viewerUser), viewerUser.uid) === true,
  "Rules: VIEWER tetap diizinkan membaca dokumen profil miliknya sendiri (/users/{ownId})"
);
assert(
  evaluator.evaluateUserDocRead(authCtx(adminUser), "usr-viewer-1") === true,
  "Rules: ADMIN diizinkan membaca profil pengguna untuk manajemen akun"
);

assert(
  !evaluator.evaluateUserDocList(authCtx(viewerUser)),
  "Rules: VIEWER DITOLAK melakukan list/query pada seluruh koleksi /users"
);
assert(
  !evaluator.evaluateUserDocList(authCtx(teamMemberProjA)),
  "Rules: TEAM DITOLAK melakukan list/query pada seluruh koleksi /users"
);
assert(
  evaluator.evaluateUserDocList(authCtx(adminUser)) === true,
  "Rules: ADMIN diizinkan list /users untuk pengelolaan wewenang"
);

assert(
  evaluator.evaluateUserDirectoryRead(authCtx(viewerUser)) === true,
  "Rules: VIEWER aktif diizinkan membaca direktori minimal /userDirectory untuk pemilihan PIC"
);
assert(
  evaluator.evaluateUserDirectoryRead(authCtx(teamMemberProjA)) === true,
  "Rules: TEAM aktif diizinkan membaca direktori minimal /userDirectory"
);

// Attempting to write smuggled capabilities to userDirectory
const smuggledDirectoryDoc = {
  uid: "usr-viewer-1",
  name: "Viewer Infiltrator",
  email: "viewer@mdrawing.com",
  role: "VIEWER",
  isActive: true,
  canViewFinance: true, // Smuggled capability!
};
assert(
  !evaluator.evaluateUserDirectoryWrite(authCtx(viewerUser), viewerUser.uid, smuggledDirectoryDoc),
  "Rules: Penyelundupan kapabilitas istimewa ke koleksi userDirectory DITOLAK KERAS"
);

// -------------------------------------------------------------
// Test 6: Positive Controls — Pengguna Berizin Tetap Berfungsi Sesuai Scope
// -------------------------------------------------------------
console.log("\n--- TEST 6: Positive Controls — Pengguna Berizin Tetap Berfungsi Sesuai Wewenang ---");

// 1. Authorized creator can read, update, delete own draft quotation
assert(
  canReadQuotation(financeAssignedProjA, quoProjA) === true,
  "Positive: Assigned FINANCE dapat membaca quotation pada proyeknya (Proj Alpha)"
);
assert(
  evaluator.evaluateQuotationRead(authCtx(financeAssignedProjA), quoProjA) === true,
  "Positive Rules: Assigned FINANCE diizinkan get quotation Proj Alpha"
);

assert(
  canUpdateQuotation(financeAssignedProjA, quoProjA) === true,
  "Positive: Assigned FINANCE dapat memperbarui quotation pada proyeknya"
);
assert(
  evaluator.evaluateQuotationUpdate(authCtx(financeAssignedProjA), quoProjA) === true,
  "Positive Rules: Assigned FINANCE diizinkan update quotation Proj Alpha"
);

assert(
  canDeleteQuotation(financeAssignedProjA, quoProjA) === true,
  "Positive: Pembuat finance dapat menghapus Draft quotation miliknya pada proyek Alpha"
);
assert(
  evaluator.evaluateQuotationDelete(authCtx(financeAssignedProjA), quoProjA) === true,
  "Positive Rules: Pembuat finance diizinkan delete Draft quotation miliknya pada proyek Alpha"
);

// 2. Creator can read and delete own pipeline quotation
assert(
  canReadQuotation(financeAssignedProjA, quoPipeline) === true,
  "Positive: Pembuat pipeline quotation dapat membaca penawarannya"
);
assert(
  evaluator.evaluateQuotationRead(authCtx(financeAssignedProjA), quoPipeline) === true,
  "Positive Rules: Pembuat pipeline quotation diizinkan membaca penawarannya"
);

assert(
  canDeleteQuotation(financeAssignedProjA, quoPipeline) === true,
  "Positive: Pembuat pipeline quotation dapat menghapus Draft penawarannya"
);
assert(
  evaluator.evaluateQuotationDelete(authCtx(financeAssignedProjA), quoPipeline) === true,
  "Positive Rules: Pembuat pipeline quotation diizinkan delete Draft penawarannya"
);

// 3. OWNER has full company-wide access to all quotations
assert(
  canReadQuotation(ownerUser, quoProjB) === true,
  "Positive: OWNER dapat membaca quotation di proyek mana pun (Proj Beta)"
);
assert(
  evaluator.evaluateQuotationRead(authCtx(ownerUser), quoProjB) === true,
  "Positive Rules: OWNER diizinkan get quotation di proyek mana pun"
);

assert(
  canDeleteQuotation(ownerUser, quoApproved) === true,
  "Positive: OWNER dapat menghapus quotation bahkan jika sudah disetujui (wewenang tertinggi)"
);
assert(
  evaluator.evaluateQuotationDelete(authCtx(ownerUser), quoApproved) === true,
  "Positive Rules: OWNER diizinkan delete quotation"
);

// -------------------------------------------------------------
// Test Summary
// -------------------------------------------------------------
console.log("\n====================================================");
console.log(`📊 HASIL PENGUJIAN TAHAP 03: ${passedCount} LOLOS (PASS), ${failedCount} GAGAL (FAIL)`);
console.log("====================================================");

if (failedCount > 0) {
  console.error("❌ BEBERAPA PENGUJIAN KEAMANAN GAGAL!");
  process.exit(1);
} else {
  console.log("🎉 SELURUH PENGUJIAN TAHAP 03 BERHASIL DENGAN SEMPURNA!");
}
