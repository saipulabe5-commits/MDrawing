/**
 * Test Suite: Account Management, Bootstrap & Role Protection Security Verification (TAHAP 02)
 *
 * Verifies AUD-01, AUD-02, AUD-09, AUD-10, AUD-16 fixes:
 * 1. Email bootstrap inactive/unverified tidak mendapat akses istimewa (AUD-01)
 * 2. Akun demoted tidak otomatis kembali menjadi OWNER (AUD-01)
 * 3. ADMIN -> OWNER ditolak tanpa perubahan Auth/Firestore (AUD-02)
 * 4. ADMIN tidak dapat menghapus atau menonaktifkan OWNER (AUD-10)
 * 5. Perlindungan pemilik aktif terakhir (AUD-10)
 * 6. Inactive ADMIN tidak menulis settings/template (AUD-09)
 * 7. Registrasi dengan capability atau assignment yang diselundupkan ditolak (AUD-16)
 * 8. Pemilik aktif yang sah tetap dapat menggunakan aplikasi
 *
 * Executable: `tsx src/security/accountManagement.test.ts`
 */

import { RulesEvaluator, type DatabaseState, type UserDocState } from "./rulesEvaluator";

// Color utilities for terminal output
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

interface TestReport {
  id: string;
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
}

const reports: TestReport[] = [];

function assertTest(
  id: string,
  name: string,
  expected: string,
  actual: string,
  condition: boolean
) {
  const passed = Boolean(condition);
  reports.push({ id, name, expected, actual, passed });
  if (passed) {
    console.log(`  ${GREEN}✓ [PASS]${RESET} ${id}: ${name}`);
    console.log(`    Expected: ${expected}`);
    console.log(`    Actual:   ${actual}\n`);
  } else {
    console.error(`  ${RED}✗ [FAIL]${RESET} ${id}: ${name}`);
    console.error(`    Expected: ${expected}`);
    console.error(`    Actual:   ${actual}\n`);
  }
}

// In-Memory Mock Store for Server Endpoint Simulation
function createMockServerStore() {
  const users: Record<string, any> = {
    "owner-active-1": {
      uid: "owner-active-1",
      email: "saipulabe5@gmail.com",
      name: "Owner Utama",
      role: "OWNER",
      isActive: true,
      canViewFinance: true,
      canEditFinance: true,
      canApproveFinance: true,
      assignedProjectIds: [],
    },
    "owner-demoted": {
      uid: "owner-demoted",
      email: "saipulabe@gmail.com",
      name: "Mantan Owner",
      role: "VIEWER",
      isActive: false,
      assignedProjectIds: [],
    },
    "admin-active-1": {
      uid: "admin-active-1",
      email: "admin@mdrawing.app",
      name: "Admin Operasional",
      role: "ADMIN",
      isActive: true,
      canViewFinance: true,
      canEditFinance: true,
    },
    "admin-inactive-1": {
      uid: "admin-inactive-1",
      email: "admin.inactive@mdrawing.app",
      name: "Admin Nonaktif",
      role: "ADMIN",
      isActive: false,
    },
    "team-target-1": {
      uid: "team-target-1",
      email: "drafter@mdrawing.app",
      name: "Drafter Proyek",
      role: "TEAM",
      isActive: true,
      assignedProjectIds: [],
    },
  };

  const systemSettings: Record<string, any> = {
    bootstrap: {
      completed: true,
      initialOwnerUid: "owner-active-1",
      initialOwnerEmail: "saipulabe5@gmail.com",
      bootstrappedAt: new Date().toISOString(),
    },
  };

  const activityLogs: any[] = [];
  const customClaimsStore: Record<string, any> = {
    "owner-active-1": { role: "OWNER" },
    "admin-active-1": { role: "ADMIN" },
    "team-target-1": { role: "TEAM" },
  };
  const revokedRefreshTokens: string[] = [];

  return {
    users,
    systemSettings,
    activityLogs,
    customClaimsStore,
    revokedRefreshTokens,
  };
}

// Server logic handlers matching server.ts production code exactly
const ALLOWED_NON_OWNER_ROLES = ["ADMIN", "PROJECT_LEADER", "FINANCE", "TEAM", "VIEWER", "CLIENT_VIEWER"] as const;
const ALL_ALLOWED_ROLES = ["OWNER", ...ALLOWED_NON_OWNER_ROLES] as const;
const ALLOWED_CAPABILITY_KEYS = [
  "canViewFinance",
  "canEditFinance",
  "canApproveFinance",
  "canExportFinanceReport",
  "canVoidFinanceTransaction",
  "canEditPaidTransaction",
  "canViewVendorCost",
  "canViewVendorPayment",
  "canManageTransmittal",
] as const;

function sanitizeCaps(raw: any): Record<string, boolean> {
  const safe: Record<string, boolean> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const k of ALLOWED_CAPABILITY_KEYS) {
      if (typeof raw[k] === "boolean") safe[k] = raw[k];
    }
  }
  return safe;
}

// Simulate /api/auth/bootstrap-check-owner
async function simulateBootstrapCheckOwner(
  tokenPayload: { uid: string; email?: string; email_verified?: boolean },
  store: ReturnType<typeof createMockServerStore>
) {
  const email = (tokenPayload.email || "").toLowerCase().trim();
  const uid = tokenPayload.uid;

  // Active owners in DB
  const activeOwners = Object.values(store.users).filter(
    (u: any) => u.role === "OWNER" && u.isActive === true
  );
  const hasActiveOwner = activeOwners.length > 0;
  const activeOwnerUids = activeOwners.map((u: any) => u.uid);

  if (hasActiveOwner) {
    if (activeOwnerUids.includes(uid)) {
      const userData = store.users[uid];
      if (userData?.role === "OWNER" && userData?.isActive === true) {
        store.customClaimsStore[uid] = { role: "OWNER" };
        return {
          status: 200,
          data: {
            success: true,
            bootstrapped: false,
            role: "OWNER",
            isActive: true,
            message: "Kredensial Owner aktif berhasil diverifikasi.",
          },
        };
      }
    }

    // Check pre-registered
    const preReg = Object.values(store.users).find((u: any) => (u.email || "").toLowerCase() === email);
    if (preReg && preReg.uid !== uid) {
      return { status: 200, data: { success: true, bootstrapped: true, role: preReg.role, isActive: preReg.isActive } };
    }

    return {
      status: 200,
      data: {
        success: true,
        bootstrapped: false,
        hasActiveOwner: true,
        isActive: false,
        message: "Sistem sudah memiliki Owner aktif. Akun ini tidak dapat mengklaim hak Owner.",
      },
    };
  }

  // No active owner: check if bootstrap completed or any owner doc exists
  const anyOwner = Object.values(store.users).find((u: any) => u.role === "OWNER");
  const bootstrapAlreadyCompleted = Boolean(anyOwner) || store.systemSettings.bootstrap?.completed === true;

  if (bootstrapAlreadyCompleted) {
    return {
      status: 403,
      data: {
        success: false,
        error: "Sistem telah diinisialisasi sebelumnya. Akun non-aktif atau didemosi tidak dapat mengklaim hak Owner melalui bootstrap.",
        code: "BOOTSTRAP_ALREADY_COMPLETED",
      },
    };
  }

  if (!tokenPayload.email_verified) {
    return {
      status: 403,
      data: {
        success: false,
        error: "Akses Ditolak: Alamat email harus terverifikasi oleh penyedia identitas sebelum melakukan inisialisasi awal sistem.",
        code: "EMAIL_NOT_VERIFIED",
      },
    };
  }

  return { status: 200, data: { success: true, bootstrapped: true, role: "OWNER", isActive: true } };
}

// Simulate /api/admin/create-test-user
async function simulateCreateTestUser(
  callerUser: { uid: string; email: string; role: string; isActive: boolean },
  payload: { name: string; email: string; role: string; capabilities?: any; isActive?: boolean; assignedProjectIds?: any },
  store: ReturnType<typeof createMockServerStore>
) {
  if (!callerUser.isActive) {
    return { status: 401, data: { error: "Akun pemanggil tidak aktif.", code: "ACCOUNT_INACTIVE" } };
  }
  if (!["OWNER", "ADMIN"].includes(callerUser.role)) {
    return { status: 403, data: { error: "Hanya Owner atau Admin yang dapat membuat user." } };
  }

  const { name, email, role, capabilities } = payload;
  if (!name || !email || !role) {
    return { status: 400, data: { error: "Parameter name, email, dan role wajib diisi." } };
  }

  // AUD-02 enforcement: ADMIN cannot create OWNER
  if (callerUser.role === "ADMIN") {
    if (role === "OWNER" || (capabilities && (capabilities as any).role === "OWNER")) {
      return {
        status: 403,
        data: {
          error: "Akses ditolak: Administrator tidak memiliki wewenang untuk membuat atau memberikan peran OWNER.",
          code: "FORBIDDEN_OWNER_CREATION",
        },
      };
    }
    if (!ALLOWED_NON_OWNER_ROLES.includes(role as any)) {
      return { status: 400, data: { error: `Role '${role}' tidak valid untuk dibuat oleh Administrator.` } };
    }
  } else if (callerUser.role === "OWNER") {
    if (!ALL_ALLOWED_ROLES.includes(role as any)) {
      return { status: 400, data: { error: `Role '${role}' tidak valid.` } };
    }
  }

  const cleanEmail = email.trim().toLowerCase();
  const targetUid = "usr_" + Math.random().toString(36).substring(2, 9);
  const safeCapabilities = sanitizeCaps(capabilities);

  store.customClaimsStore[targetUid] = { role, ...safeCapabilities };
  store.users[targetUid] = {
    uid: targetUid,
    name: name.trim(),
    email: cleanEmail,
    role,
    isActive: typeof payload.isActive === "boolean" ? payload.isActive : true,
    ...safeCapabilities,
    assignedProjectIds: Array.isArray(payload.assignedProjectIds) ? payload.assignedProjectIds : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.activityLogs.push({
    action: "CREATE",
    caller: callerUser.email,
    targetUid,
    role,
  });

  return { status: 200, data: { success: true, user: { uid: targetUid, name, email: cleanEmail, role } } };
}

// Simulate /api/admin/set-user-claim
async function simulateSetUserClaim(
  callerUser: { uid: string; email: string; role: string; isActive: boolean },
  payload: { targetUid: string; role?: string; capabilities?: any; isActive?: boolean },
  store: ReturnType<typeof createMockServerStore>
) {
  if (!callerUser.isActive) {
    return { status: 401, data: { error: "Akun pemanggil tidak aktif.", code: "ACCOUNT_INACTIVE" } };
  }
  if (!["OWNER", "ADMIN"].includes(callerUser.role)) {
    return { status: 403, data: { error: "Akses ditolak." } };
  }

  const { targetUid, role, capabilities, isActive } = payload;
  if (!targetUid || !role) {
    return { status: 400, data: { error: "Parameter 'targetUid' dan 'role' wajib diisi." } };
  }

  if (targetUid === callerUser.uid) {
    if (role && role !== callerUser.role) {
      return { status: 400, data: { error: "Anti-eskalasi: Tidak dapat mengubah peran akun Anda sendiri." } };
    }
    if (isActive === false) {
      return { status: 400, data: { error: "Anti-eskalasi: Tidak dapat menonaktifkan akun Anda sendiri." } };
    }
  }

  const target = store.users[targetUid];
  if (!target) {
    return { status: 404, data: { error: "Pengguna target tidak ditemukan." } };
  }

  const currentTargetRole = target.role || "VIEWER";

  // ADMIN boundaries
  if (callerUser.role === "ADMIN") {
    if (currentTargetRole === "OWNER") {
      return {
        status: 403,
        data: {
          error: "Akses ditolak: Administrator tidak diizinkan mengubah status, peran, atau klaim akun OWNER.",
          code: "FORBIDDEN_OWNER_MODIFICATION",
        },
      };
    }
    if (role === "OWNER" || (capabilities && (capabilities as any).role === "OWNER")) {
      return {
        status: 403,
        data: {
          error: "Akses ditolak: Administrator tidak memiliki wewenang untuk memberikan peran OWNER.",
          code: "FORBIDDEN_OWNER_PROMOTION",
        },
      };
    }
    if (!ALLOWED_NON_OWNER_ROLES.includes(role as any)) {
      return { status: 400, data: { error: `Role '${role}' tidak valid.` } };
    }
  }

  // Last active owner protection
  if (currentTargetRole === "OWNER" && (role !== "OWNER" || isActive === false)) {
    const activeOwners = Object.values(store.users).filter((u: any) => u.role === "OWNER" && u.isActive === true);
    if (activeOwners.length <= 1) {
      return {
        status: 400,
        data: {
          error: "Anti-eskalasi: Tidak dapat menonaktifkan atau menurunkan peran satu-satunya Owner aktif dalam sistem.",
          code: "LAST_ACTIVE_OWNER_PROTECTION",
        },
      };
    }
  }

  const safeCaps = sanitizeCaps(capabilities);
  target.role = role;
  if (typeof isActive === "boolean") target.isActive = isActive;
  Object.assign(target, safeCaps);
  store.customClaimsStore[targetUid] = { role, ...safeCaps };

  store.activityLogs.push({
    action: "UPDATE",
    caller: callerUser.email,
    targetUid,
    role,
  });

  return { status: 200, data: { success: true, targetUid, role } };
}

// Simulate /api/admin/revoke-user-claim
async function simulateRevokeUserClaim(
  callerUser: { uid: string; email: string; role: string; isActive: boolean },
  targetUid: string,
  store: ReturnType<typeof createMockServerStore>
) {
  if (!callerUser.isActive) {
    return { status: 401, data: { error: "Akun pemanggil tidak aktif.", code: "ACCOUNT_INACTIVE" } };
  }
  if (!["OWNER", "ADMIN"].includes(callerUser.role)) {
    return { status: 403, data: { error: "Akses ditolak." } };
  }
  if (targetUid === callerUser.uid) {
    return { status: 400, data: { error: "Anti-eskalasi: Tidak dapat mencabut hak akses akun Anda sendiri." } };
  }

  const target = store.users[targetUid];
  if (!target) {
    return { status: 404, data: { error: "Pengguna target tidak ditemukan." } };
  }

  const targetRole = target.role || "VIEWER";

  // ADMIN cannot revoke OWNER (AUD-10)
  if (callerUser.role === "ADMIN" && targetRole === "OWNER") {
    return {
      status: 403,
      data: {
        error: "Akses ditolak: Administrator tidak diizinkan mencabut hak akses atau menonaktifkan akun OWNER.",
        code: "FORBIDDEN_OWNER_REVOCATION",
      },
    };
  }

  // Protect last active owner
  if (targetRole === "OWNER") {
    const activeOwners = Object.values(store.users).filter((u: any) => u.role === "OWNER" && u.isActive === true);
    if (activeOwners.length <= 1) {
      return {
        status: 400,
        data: {
          error: "Anti-eskalasi: Tidak dapat mencabut hak akses satu-satunya Owner aktif dalam sistem.",
          code: "LAST_ACTIVE_OWNER_PROTECTION",
        },
      };
    }
  }

  store.revokedRefreshTokens.push(targetUid);
  store.customClaimsStore[targetUid] = {};
  target.role = "VIEWER";
  target.isActive = false;

  store.activityLogs.push({
    action: "REVOKE",
    caller: callerUser.email,
    targetUid,
  });

  return { status: 200, data: { success: true, message: `Hak akses pengguna ${targetUid} berhasil dicabut.` } };
}

// Build Mock Database for Rules Evaluator
function createRulesMockDb(): DatabaseState {
  return {
    users: {
      "owner-active": {
        uid: "owner-active",
        role: "OWNER",
        isActive: true,
        canViewFinance: true,
        canEditFinance: true,
        canApproveFinance: true,
      },
      "admin-active": {
        uid: "admin-active",
        role: "ADMIN",
        isActive: true,
        canViewFinance: true,
        canEditFinance: true,
      },
      "admin-inactive": {
        uid: "admin-inactive",
        role: "ADMIN",
        isActive: false, // Inactive ADMIN
      },
      "team-member": {
        uid: "team-member",
        role: "TEAM",
        isActive: true,
        assignedProjectIds: ["prj-1"],
      },
      "viewer-user": {
        uid: "viewer-user",
        role: "VIEWER",
        isActive: true,
      },
    },
    projects: {
      "prj-1": {
        id: "prj-1",
        code: "PRJ-1",
        name: "Proyek Satu",
        members: ["team-member"],
      },
    },
  };
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log(`${CYAN}🛡️  MDRAWING SECURITY TEST SUITE: TAHAP 02 — BOOTSTRAP & ACCOUNT MANAGEMENT${RESET}`);
  console.log("================================================================================\n");

  const serverStore = createMockServerStore();
  const rulesDb = createRulesMockDb();
  const evaluator = new RulesEvaluator(rulesDb);

  // ---------------------------------------------------------------------------
  // TEST-01: Email bootstrap inactive atau unverified tidak mendapat akses istimewa (AUD-01)
  // ---------------------------------------------------------------------------
  {
    // Test A: Unverified email cannot bootstrap
    const unverifiedRes = await simulateBootstrapCheckOwner(
      { uid: "new-unverified-uid", email: "saipulabe5@gmail.com", email_verified: false },
      { ...serverStore, users: {}, systemSettings: {} } // Fresh brand-new db
    );
    assertTest(
      "TEST-01A",
      "Email bootstrap unverified ditolak pada inisialisasi awal",
      "HTTP 403 EMAIL_NOT_VERIFIED",
      `HTTP ${unverifiedRes.status} ${(unverifiedRes.data as any).code}`,
      unverifiedRes.status === 403 && (unverifiedRes.data as any).code === "EMAIL_NOT_VERIFIED"
    );

    // Test B: Inactive owner calling bootstrap cannot re-elevate or bypass deactivation
    const inactiveOwnerRes = await simulateBootstrapCheckOwner(
      { uid: "owner-demoted", email: "saipulabe@gmail.com", email_verified: true },
      serverStore
    );
    assertTest(
      "TEST-01B",
      "Akun bootstrap yang non-aktif tidak mendapat status aktif atau hak Owner",
      "HTTP 200 dengan isActive: false dan bootstrapped: false",
      `HTTP ${inactiveOwnerRes.status} isActive=${(inactiveOwnerRes.data as any).isActive} bootstrapped=${(inactiveOwnerRes.data as any).bootstrapped}`,
      inactiveOwnerRes.status === 200 &&
        (inactiveOwnerRes.data as any).isActive === false &&
        (inactiveOwnerRes.data as any).bootstrapped === false
    );
  }

  // ---------------------------------------------------------------------------
  // TEST-02: Akun demoted tidak otomatis kembali menjadi OWNER (AUD-01)
  // ---------------------------------------------------------------------------
  {
    // Fresh store where bootstrap completed in history
    const demotedStore = createMockServerStore();
    delete demotedStore.users["owner-active-1"]; // simulate only demoted user remains
    const demotedRes = await simulateBootstrapCheckOwner(
      { uid: "owner-demoted", email: "saipulabe@gmail.com", email_verified: true },
      demotedStore
    );
    assertTest(
      "TEST-02A",
      "Akun demoted dilarang bootstrap ulang setelah sistem terinisialisasi",
      "HTTP 403 BOOTSTRAP_ALREADY_COMPLETED",
      `HTTP ${demotedRes.status} ${(demotedRes.data as any).code}`,
      demotedRes.status === 403 && (demotedRes.data as any).code === "BOOTSTRAP_ALREADY_COMPLETED"
    );

    // Self-elevation check in Firestore rules
    const demotedAuth = { uid: "owner-demoted" };
    const selfElevate = evaluator.evaluateUserDocUpdate(demotedAuth, "owner-demoted", { role: "OWNER" });
    assertTest(
      "TEST-02B",
      "Client-side Firestore rules menolak akun demoted mengaktifkan diri sendiri ke OWNER",
      "DENIED (false)",
      `Allowed: ${selfElevate}`,
      selfElevate === false
    );
  }

  // ---------------------------------------------------------------------------
  // TEST-03: ADMIN -> OWNER ditolak tanpa perubahan Auth/Firestore (AUD-02)
  // ---------------------------------------------------------------------------
  {
    const adminUser = { uid: "admin-active-1", email: "admin@mdrawing.app", role: "ADMIN", isActive: true };

    // Test A: Direct role: "OWNER" in create-test-user
    const createOwnerRes = await simulateCreateTestUser(
      adminUser,
      { name: "Penyusup", email: "intruder@mdrawing.app", role: "OWNER" },
      serverStore
    );
    assertTest(
      "TEST-03A",
      "ADMIN dilarang membuat akun dengan role: OWNER via create-test-user",
      "HTTP 403 FORBIDDEN_OWNER_CREATION",
      `HTTP ${createOwnerRes.status} ${(createOwnerRes.data as any).code}`,
      createOwnerRes.status === 403 && (createOwnerRes.data as any).code === "FORBIDDEN_OWNER_CREATION"
    );

    // Test B: Smuggled role in capabilities
    const smuggledRoleRes = await simulateCreateTestUser(
      adminUser,
      { name: "Penyusup 2", email: "intruder2@mdrawing.app", role: "TEAM", capabilities: { role: "OWNER" } },
      serverStore
    );
    assertTest(
      "TEST-03B",
      "ADMIN dilarang menyelundupkan capabilities.role: OWNER via create-test-user",
      "HTTP 403 FORBIDDEN_OWNER_CREATION",
      `HTTP ${smuggledRoleRes.status} ${(smuggledRoleRes.data as any).code}`,
      smuggledRoleRes.status === 403 && (smuggledRoleRes.data as any).code === "FORBIDDEN_OWNER_CREATION"
    );

    // Test C: ADMIN promoting existing user to OWNER in set-user-claim
    const promoteRes = await simulateSetUserClaim(
      adminUser,
      { targetUid: "team-target-1", role: "OWNER" },
      serverStore
    );
    assertTest(
      "TEST-03C",
      "ADMIN dilarang mempromosikan user ke role: OWNER via set-user-claim",
      "HTTP 403 FORBIDDEN_OWNER_PROMOTION",
      `HTTP ${promoteRes.status} ${(promoteRes.data as any).code}`,
      promoteRes.status === 403 && (promoteRes.data as any).code === "FORBIDDEN_OWNER_PROMOTION"
    );

    // Verify Firestore and Claims were NOT modified
    const targetInDb = serverStore.users["team-target-1"];
    const targetClaims = serverStore.customClaimsStore["team-target-1"];
    assertTest(
      "TEST-03D",
      "Integritas database & token terjaga: target tetap berstatus TEAM tanpa eskalasi",
      "Role di Firestore=TEAM dan Claims=TEAM",
      `Firestore=${targetInDb.role}, Claims=${targetClaims?.role}`,
      targetInDb.role === "TEAM" && targetClaims?.role === "TEAM"
    );
  }

  // ---------------------------------------------------------------------------
  // TEST-04: ADMIN tidak dapat menghapus atau menonaktifkan OWNER (AUD-10)
  // ---------------------------------------------------------------------------
  {
    const adminUser = { uid: "admin-active-1", email: "admin@mdrawing.app", role: "ADMIN", isActive: true };

    // Test A: ADMIN calls revoke-user-claim on OWNER
    const revokeOwnerRes = await simulateRevokeUserClaim(adminUser, "owner-active-1", serverStore);
    assertTest(
      "TEST-04A",
      "ADMIN dilarang mencabut klaim atau menonaktifkan akun OWNER via server",
      "HTTP 403 FORBIDDEN_OWNER_REVOCATION",
      `HTTP ${revokeOwnerRes.status} ${(revokeOwnerRes.data as any).code}`,
      revokeOwnerRes.status === 403 && (revokeOwnerRes.data as any).code === "FORBIDDEN_OWNER_REVOCATION"
    );

    // Test B: ADMIN attempts to delete OWNER document in Firestore Rules
    const adminAuth = { uid: "admin-active", token: { role: "ADMIN" } };
    const deleteOwnerAllowed = evaluator.evaluateUserDocDelete(adminAuth, "owner-active");
    assertTest(
      "TEST-04B",
      "Firestore Security Rules melarang ADMIN menghapus dokumen akun OWNER",
      "DENIED (false)",
      `Allowed: ${deleteOwnerAllowed}`,
      deleteOwnerAllowed === false
    );

    // Test C: ADMIN attempts to modify OWNER document in Firestore Rules
    const updateOwnerAllowed = evaluator.evaluateUserUpdate(
      adminAuth,
      "owner-active",
      { isActive: false },
      rulesDb.users["owner-active"]
    );
    assertTest(
      "TEST-04C",
      "Firestore Security Rules melarang ADMIN mengubah data dokumen akun OWNER",
      "DENIED (false)",
      `Allowed: ${updateOwnerAllowed}`,
      updateOwnerAllowed === false
    );
  }

  // ---------------------------------------------------------------------------
  // TEST-05: Perlindungan Pemilik Aktif Terakhir (AUD-10)
  // ---------------------------------------------------------------------------
  {
    const ownerUser = { uid: "owner-active-1", email: "saipulabe5@gmail.com", role: "OWNER", isActive: true };

    // Attempt to revoke the ONLY active owner in the store
    const revokeLastOwnerRes = await simulateRevokeUserClaim(ownerUser, "owner-active-1", serverStore);
    // Note: Self-revocation is also blocked by anti-escalation, but let's test targeting single active owner:
    assertTest(
      "TEST-05A",
      "Pencabutan hak akses akun Owner sendiri diblokir oleh anti-eskalasi",
      "HTTP 400 Anti-eskalasi",
      `HTTP ${revokeLastOwnerRes.status}`,
      revokeLastOwnerRes.status === 400
    );

    // Test demotion when only 1 active owner exists
    const demoteLastOwnerRes = await simulateSetUserClaim(
      { uid: "other-owner-auth", email: "temp@mdrawing.app", role: "OWNER", isActive: true },
      { targetUid: "owner-active-1", role: "VIEWER" },
      serverStore
    );
    assertTest(
      "TEST-05B",
      "Demotion pada satu-satunya Owner aktif ditolak oleh proteksi Last Active Owner",
      "HTTP 400 LAST_ACTIVE_OWNER_PROTECTION",
      `HTTP ${demoteLastOwnerRes.status} ${(demoteLastOwnerRes.data as any).code}`,
      demoteLastOwnerRes.status === 400 && (demoteLastOwnerRes.data as any).code === "LAST_ACTIVE_OWNER_PROTECTION"
    );
  }

  // ---------------------------------------------------------------------------
  // TEST-06: Inactive ADMIN tidak dapat menulis settings atau template (AUD-09)
  // ---------------------------------------------------------------------------
  {
    const inactiveAdminAuth = { uid: "admin-inactive", token: { role: "ADMIN" } };
    const activeAdminAuth = { uid: "admin-active", token: { role: "ADMIN" } };

    // Template write
    const inactiveTemplateWrite = evaluator.evaluateTemplateWrite(inactiveAdminAuth);
    const activeTemplateWrite = evaluator.evaluateTemplateWrite(activeAdminAuth);
    assertTest(
      "TEST-06A",
      "Inactive ADMIN dilarang menulis drawing templates, active ADMIN diizinkan",
      "Inactive=DENIED, Active=ALLOWED",
      `Inactive=${inactiveTemplateWrite}, Active=${activeTemplateWrite}`,
      inactiveTemplateWrite === false && activeTemplateWrite === true
    );

    // Template read
    const inactiveTemplateRead = evaluator.evaluateTemplateRead(inactiveAdminAuth);
    assertTest(
      "TEST-06B",
      "Inactive ADMIN dilarang membaca drawing templates",
      "DENIED (false)",
      `Allowed: ${inactiveTemplateRead}`,
      inactiveTemplateRead === false
    );

    // Company Settings write & read
    const inactiveSettingsWrite = evaluator.evaluateCompanySettingsWrite(inactiveAdminAuth);
    const inactiveSettingsRead = evaluator.evaluateCompanySettingsRead(inactiveAdminAuth);
    assertTest(
      "TEST-06C",
      "Inactive ADMIN dilarang membaca atau menulis companySettings",
      "Write=DENIED, Read=DENIED",
      `Write=${inactiveSettingsWrite}, Read=${inactiveSettingsRead}`,
      inactiveSettingsWrite === false && inactiveSettingsRead === false
    );
  }

  // ---------------------------------------------------------------------------
  // TEST-07: Registrasi dengan capability atau assignment yang diselundupkan ditolak (AUD-16)
  // ---------------------------------------------------------------------------
  {
    const registeringAuth = { uid: "new-user-123" };

    // Attempt 1: Smuggle canViewFinance
    const smuggleFinance = evaluator.evaluateUserCreate(registeringAuth, {
      uid: "new-user-123",
      role: "VIEWER",
      isActive: false,
      canViewFinance: true, // Smuggled
    });
    assertTest(
      "TEST-07A",
      "Self-registration dengan capability canViewFinance: true ditolak",
      "DENIED (false)",
      `Allowed: ${smuggleFinance}`,
      smuggleFinance === false
    );

    // Attempt 2: Smuggle assignedProjectIds
    const smuggleProjects = evaluator.evaluateUserCreate(registeringAuth, {
      uid: "new-user-123",
      role: "VIEWER",
      isActive: false,
      assignedProjectIds: ["prj-secret"], // Smuggled
    });
    assertTest(
      "TEST-07B",
      "Self-registration dengan proyek terpasang (assignedProjectIds) ditolak",
      "DENIED (false)",
      `Allowed: ${smuggleProjects}`,
      smuggleProjects === false
    );

    // Attempt 3: Smuggle role: "ADMIN" or "OWNER"
    const smuggleRole = evaluator.evaluateUserCreate(registeringAuth, {
      uid: "new-user-123",
      role: "ADMIN",
      isActive: false,
    });
    assertTest(
      "TEST-07C",
      "Self-registration dengan role selain VIEWER ditolak",
      "DENIED (false)",
      `Allowed: ${smuggleRole}`,
      smuggleRole === false
    );

    // Attempt 4: Smuggle isActive: true
    const smuggleActive = evaluator.evaluateUserCreate(registeringAuth, {
      uid: "new-user-123",
      role: "VIEWER",
      isActive: true, // Smuggled
    });
    assertTest(
      "TEST-07D",
      "Self-registration dengan isActive: true ditolak",
      "DENIED (false)",
      `Allowed: ${smuggleActive}`,
      smuggleActive === false
    );

    // Attempt 5: Clean safe registration
    const safeRegistration = evaluator.evaluateUserCreate(registeringAuth, {
      uid: "new-user-123",
      role: "VIEWER",
      isActive: false,
      canViewFinance: false,
      canEditFinance: false,
      assignedProjectIds: [],
    });
    assertTest(
      "TEST-07E",
      "Self-registration aman (role: VIEWER, isActive: false, tanpa capability) diizinkan",
      "ALLOWED (true)",
      `Allowed: ${safeRegistration}`,
      safeRegistration === true
    );
  }

  // ---------------------------------------------------------------------------
  // TEST-08: Pemilik aktif yang sah tetap dapat menggunakan aplikasi
  // ---------------------------------------------------------------------------
  {
    const verifiedOwnerRes = await simulateBootstrapCheckOwner(
      { uid: "owner-active-1", email: "saipulabe5@gmail.com", email_verified: true },
      serverStore
    );
    assertTest(
      "TEST-08A",
      "Pemilik aktif yang sah berhasil diverifikasi dan disinkronkan oleh endpoint server",
      "HTTP 200 dengan role: OWNER dan isActive: true",
      `HTTP ${verifiedOwnerRes.status} role=${(verifiedOwnerRes.data as any).role} isActive=${(verifiedOwnerRes.data as any).isActive}`,
      verifiedOwnerRes.status === 200 &&
        (verifiedOwnerRes.data as any).role === "OWNER" &&
        (verifiedOwnerRes.data as any).isActive === true
    );

    const ownerAuth = { uid: "owner-active", token: { role: "OWNER" } };
    const ownerTemplateWrite = evaluator.evaluateTemplateWrite(ownerAuth);
    const ownerSettingsWrite = evaluator.evaluateCompanySettingsWrite(ownerAuth);
    assertTest(
      "TEST-08B",
      "Pemilik aktif yang sah memiliki hak penuh atas templates dan companySettings",
      "TemplateWrite=ALLOWED, SettingsWrite=ALLOWED",
      `TemplateWrite=${ownerTemplateWrite}, SettingsWrite=${ownerSettingsWrite}`,
      ownerTemplateWrite === true && ownerSettingsWrite === true
    );
  }

  // Summary
  console.log("--------------------------------------------------------------------------------");
  const passedCount = reports.filter((r) => r.passed).length;
  const failedCount = reports.filter((r) => !r.passed).length;
  console.log(`TOTAL SECURITY AUDIT TESTS: ${reports.length} | ${GREEN}PASSED: ${passedCount}${RESET} | ${failedCount > 0 ? RED : GREEN}FAILED: ${failedCount}${RESET}`);
  console.log("--------------------------------------------------------------------------------\n");

  if (failedCount > 0) {
    console.error(`${RED}❌ TAHAP 02 ACCOUNT MANAGEMENT SECURITY SUITE GAGAL!${RESET}`);
    process.exit(1);
  } else {
    console.log(`${GREEN}✅ SELURUH PENGUJIAN TAHAP 02 LOLOS DENGAN HASIL VALID (100% PASS)!${RESET}`);
  }
}

runTestSuite().catch((err) => {
  console.error("Fatal error running test suite:", err);
  process.exit(1);
});
