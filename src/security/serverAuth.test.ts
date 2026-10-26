/**
 * Test Suite: Server Authentication & Access Revocation Security Verification (TAHAP 01)
 *
 * Verifies AUD-05 and AUD-06 fixes:
 * 1. Akun aktif berizin diterima (Active authorized account accepted)
 * 2. Akun inactive ditolak (Inactive account rejected)
 * 3. Profil hilang ditolak (Missing canonical profile rejected)
 * 4. Token OWNER lama setelah demotion ditolak (Stale token claims rejected when DB demoted)
 * 5. Revoked token ditolak (Revoked ID token rejected)
 * 6. Database unavailable tidak memberikan privilege (Database down fails closed, 503)
 * 7. Export tidak membaca source ketika otorisasi gagal (Export rejects before file access)
 *
 * Executable: `tsx src/security/serverAuth.test.ts`
 */

import {
  authenticateRequest,
  type AuthDependencies,
} from "../../server/auth";
import {
  handleExportSourceCode,
} from "../../server/exportHandler";

// Color utilities for clean console output
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

// Helper to build controlled mock Firebase Auth
function createMockAuth(overrides: {
  verifyIdTokenImpl?: (token: string, checkRevoked?: boolean) => Promise<any>;
} = {}) {
  return {
    verifyIdToken: overrides.verifyIdTokenImpl || (async (token: string, checkRevoked?: boolean) => {
      if (token === "token_revoked") {
        const err: any = new Error("Firebase ID token has been revoked.");
        err.code = "auth/id-token-revoked";
        throw err;
      }
      if (token === "token_invalid") {
        const err: any = new Error("Decoding Firebase ID token failed.");
        err.code = "auth/argument-error";
        throw err;
      }
      // Default valid token
      return {
        uid: "uid_" + token,
        email: `${token}@mdrawing.app`,
        role: token.includes("stale_owner") ? "OWNER" : "VIEWER",
        auth_time: Math.floor(Date.now() / 1000) - 3600,
      };
    }),
    revokeRefreshTokens: async (uid: string) => {
      // Mock revocation
    },
    setCustomUserClaims: async (uid: string, claims: any) => {
      // Mock setting claims
    },
  };
}

// Helper to build controlled mock Firestore Admin DB
function createMockDb(documents: Record<string, { exists: boolean; data?: any }>, throwError: boolean = false) {
  return {
    collection: (collName: string) => ({
      doc: (docId: string) => ({
        get: async () => {
          if (throwError) {
            throw new Error("Firestore unavailable: DEADLINE_EXCEEDED (simulated network timeout)");
          }
          const found = documents[`${collName}/${docId}`];
          if (!found) {
            return { exists: false, data: () => null };
          }
          return {
            exists: found.exists,
            data: () => found.data,
          };
        },
      }),
    }),
  };
}

// Helper to create mock Express Request and Response
function createMockHttp(options: {
  authHeader?: string;
  method?: string;
  url?: string;
}) {
  const req: any = {
    method: options.method || "GET",
    originalUrl: options.url || "/api/export-source-code",
    path: options.url || "/api/export-source-code",
    headers: {
      ...(options.authHeader ? { authorization: options.authHeader } : {}),
    },
    socket: { remoteAddress: "127.0.0.1" },
  };

  let statusCode = 200;
  let responseBody: any = null;
  const headersSet: Record<string, string> = {};

  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(body: any) {
      responseBody = body;
      return res;
    },
    send(body: any) {
      responseBody = body;
      return res;
    },
    setHeader(key: string, val: string) {
      headersSet[key.toLowerCase()] = val;
      return res;
    },
    getStatusCode() {
      return statusCode;
    },
    getBody() {
      return responseBody;
    },
    getHeaders() {
      return headersSet;
    },
  };

  return { req, res };
}

async function runTahap01Tests() {
  console.log(`${CYAN}================================================================================${RESET}`);
  console.log(`${CYAN}🔒 TAHAP 01: SERVER AUTHENTICATION & ACCESS REVOCATION SECURITY VERIFICATION${RESET}`);
  console.log(`${CYAN}================================================================================\n${RESET}`);

  // --------------------------------------------------------------------------
  // TEST 1: Akun aktif berizin diterima
  // --------------------------------------------------------------------------
  {
    const uid = "uid_active_owner";
    const auth = createMockAuth();
    const db = createMockDb({
      [`users/${uid}`]: {
        exists: true,
        data: {
          uid,
          email: "active_owner@mdrawing.app",
          role: "OWNER",
          isActive: true,
          canViewFinance: true,
          canEditFinance: true,
        },
      },
    });

    const { req } = createMockHttp({ authHeader: "Bearer active_owner" });
    const result = await authenticateRequest(
      req,
      { checkRevoked: true, requireOwner: true, requireActive: true },
      { authInstance: auth, adminDb: db }
    );

    assertTest(
      "TEST-01",
      "Akun aktif berizin diterima",
      "ok: true, user.role: 'OWNER', user.isActive: true",
      `ok: ${result.ok}, user.role: '${result.user?.role}', user.isActive: ${result.user?.isActive}`,
      result.ok === true &&
        result.user.role === "OWNER" &&
        result.user.isActive === true &&
        result.user.isOwner === true
    );
  }

  // --------------------------------------------------------------------------
  // TEST 2: Akun inactive ditolak
  // --------------------------------------------------------------------------
  {
    const uid = "uid_inactive_owner";
    const auth = createMockAuth();
    const db = createMockDb({
      [`users/${uid}`]: {
        exists: true,
        data: {
          uid,
          email: "inactive_owner@mdrawing.app",
          role: "OWNER",
          isActive: false, // Deactivated by Admin/Owner
        },
      },
    });

    const { req } = createMockHttp({ authHeader: "Bearer inactive_owner" });
    const result = await authenticateRequest(
      req,
      { checkRevoked: true, requireActive: true },
      { authInstance: auth, adminDb: db }
    );

    assertTest(
      "TEST-02",
      "Akun inactive ditolak",
      "ok: false, status: 403, code: 'ACCOUNT_INACTIVE'",
      `ok: ${result.ok}, status: ${result.status}, code: '${result.code}'`,
      result.ok === false &&
        result.status === 403 &&
        result.code === "ACCOUNT_INACTIVE"
    );
  }

  // --------------------------------------------------------------------------
  // TEST 3: Profil hilang ditolak
  // --------------------------------------------------------------------------
  {
    const auth = createMockAuth();
    const db = createMockDb({}); // Empty database, user doc does not exist

    const { req } = createMockHttp({ authHeader: "Bearer ghost_user" });
    const result = await authenticateRequest(
      req,
      { checkRevoked: true, requireActive: true },
      { authInstance: auth, adminDb: db }
    );

    assertTest(
      "TEST-03",
      "Profil hilang ditolak",
      "ok: false, status: 401, code: 'USER_NOT_FOUND'",
      `ok: ${result.ok}, status: ${result.status}, code: '${result.code}'`,
      result.ok === false &&
        result.status === 401 &&
        result.code === "USER_NOT_FOUND"
    );
  }

  // --------------------------------------------------------------------------
  // TEST 4: Token OWNER lama setelah demotion ditolak
  // --------------------------------------------------------------------------
  {
    const uid = "uid_stale_owner_demoted";
    // Token claims still state role: 'OWNER' (unrefreshed client token)
    const auth = createMockAuth({
      verifyIdTokenImpl: async () => ({
        uid,
        email: "demoted@mdrawing.app",
        role: "OWNER", // Stale claim!
      }),
    });
    // Canonical database record has been demoted to 'TEAM'
    const db = createMockDb({
      [`users/${uid}`]: {
        exists: true,
        data: {
          uid,
          email: "demoted@mdrawing.app",
          role: "TEAM", // Canonical demoted role
          isActive: true,
        },
      },
    });

    const { req } = createMockHttp({ authHeader: "Bearer stale_owner_demoted" });
    // Attempt operation requiring OWNER (e.g. export source code, claims modification)
    const result = await authenticateRequest(
      req,
      { checkRevoked: true, requireOwner: true, requireActive: true },
      { authInstance: auth, adminDb: db }
    );

    assertTest(
      "TEST-04",
      "Token OWNER lama setelah demotion ditolak",
      "ok: false, status: 403, code: 'INSUFFICIENT_PERMISSIONS' (canonical DB role 'TEAM' overrides stale token)",
      `ok: ${result.ok}, status: ${result.status}, code: '${result.code}'`,
      result.ok === false &&
        result.status === 403 &&
        result.code === "INSUFFICIENT_PERMISSIONS"
    );
  }

  // --------------------------------------------------------------------------
  // TEST 5: Revoked token ditolak
  // --------------------------------------------------------------------------
  {
    const auth = createMockAuth();
    const db = createMockDb({});

    const { req } = createMockHttp({ authHeader: "Bearer token_revoked" });
    const result = await authenticateRequest(
      req,
      { checkRevoked: true },
      { authInstance: auth, adminDb: db }
    );

    assertTest(
      "TEST-05",
      "Revoked token ditolak",
      "ok: false, status: 401, code: 'TOKEN_REVOKED'",
      `ok: ${result.ok}, status: ${result.status}, code: '${result.code}'`,
      result.ok === false &&
        result.status === 401 &&
        result.code === "TOKEN_REVOKED"
    );
  }

  // --------------------------------------------------------------------------
  // TEST 6: Database unavailable tidak memberikan privilege
  // --------------------------------------------------------------------------
  {
    const auth = createMockAuth({
      verifyIdTokenImpl: async () => ({
        uid: "uid_privileged_claim",
        email: "owner@mdrawing.app",
        role: "OWNER", // Attempting to use token claims while DB is down
      }),
    });
    const db = createMockDb({}, true); // Database throws connection error

    const { req } = createMockHttp({ authHeader: "Bearer db_down_token" });
    const result = await authenticateRequest(
      req,
      { checkRevoked: true, requireOwner: true },
      { authInstance: auth, adminDb: db }
    );

    assertTest(
      "TEST-06",
      "Database unavailable tidak memberikan privilege",
      "ok: false, status: 503, code: 'AUTH_SERVICE_UNAVAILABLE' (fail-closed, 0 privileges granted)",
      `ok: ${result.ok}, status: ${result.status}, code: '${result.code}'`,
      result.ok === false &&
        result.status === 503 &&
        result.code === "AUTH_SERVICE_UNAVAILABLE"
    );
  }

  // --------------------------------------------------------------------------
  // TEST 7: Export tidak membaca source ketika otorisasi gagal
  // --------------------------------------------------------------------------
  {
    let fileCollectorInvoked = 0;
    const trackingCollector = async (dir: string) => {
      fileCollectorInvoked++;
      return [{ relativePath: "secret.ts", absolutePath: "/fake/secret.ts" }];
    };

    // Sub-case 7a: Missing token
    {
      const { req, res } = createMockHttp({});
      await handleExportSourceCode(req, res, { fileCollector: trackingCollector });
      const status = res.getStatusCode();
      const body = res.getBody();
      assertTest(
        "TEST-07A",
        "Export tanpa token ditolak sebelum membaca filesystem",
        "status: 401, fileCollector calls: 0",
        `status: ${status}, fileCollector calls: ${fileCollectorInvoked}, error: '${body?.error}'`,
        status === 401 && fileCollectorInvoked === 0
      );
    }

    // Sub-case 7b: Demoted user (token says OWNER, DB says VIEWER)
    {
      const uid = "uid_demoted_export";
      const auth = createMockAuth({
        verifyIdTokenImpl: async () => ({ uid, email: "demoted@mdrawing.app", role: "OWNER" }),
      });
      const db = createMockDb({
        [`users/${uid}`]: {
          exists: true,
          data: { uid, role: "VIEWER", isActive: true },
        },
      });

      const { req, res } = createMockHttp({ authHeader: "Bearer token_demoted" });
      await handleExportSourceCode(req, res, {
        fileCollector: trackingCollector,
        authDeps: { authInstance: auth, adminDb: db },
      });
      const status = res.getStatusCode();
      assertTest(
        "TEST-07B",
        "Export token demoted ditolak sebelum membaca filesystem",
        "status: 403, fileCollector calls: 0",
        `status: ${status}, fileCollector calls: ${fileCollectorInvoked}`,
        status === 403 && fileCollectorInvoked === 0
      );
    }

    // Sub-case 7c: Inactive user
    {
      const uid = "uid_inactive_export";
      const auth = createMockAuth();
      const db = createMockDb({
        [`users/${uid}`]: {
          exists: true,
          data: { uid, role: "OWNER", isActive: false },
        },
      });

      const { req, res } = createMockHttp({ authHeader: "Bearer inactive_export" });
      await handleExportSourceCode(req, res, {
        fileCollector: trackingCollector,
        authDeps: { authInstance: auth, adminDb: db },
      });
      const status = res.getStatusCode();
      assertTest(
        "TEST-07C",
        "Export pengguna inactive ditolak sebelum membaca filesystem",
        "status: 403, fileCollector calls: 0",
        `status: ${status}, fileCollector calls: ${fileCollectorInvoked}`,
        status === 403 && fileCollectorInvoked === 0
      );
    }

    // Sub-case 7d: Revoked token
    {
      const auth = createMockAuth();
      const db = createMockDb({});

      const { req, res } = createMockHttp({ authHeader: "Bearer token_revoked" });
      await handleExportSourceCode(req, res, {
        fileCollector: trackingCollector,
        authDeps: { authInstance: auth, adminDb: db },
      });
      const status = res.getStatusCode();
      assertTest(
        "TEST-07D",
        "Export token revoked ditolak sebelum membaca filesystem",
        "status: 401, fileCollector calls: 0",
        `status: ${status}, fileCollector calls: ${fileCollectorInvoked}`,
        status === 401 && fileCollectorInvoked === 0
      );
    }

    // Sub-case 7e: Database unavailable during export
    {
      const auth = createMockAuth({
        verifyIdTokenImpl: async () => ({ uid: "uid_db_down", role: "OWNER" }),
      });
      const db = createMockDb({}, true);

      const { req, res } = createMockHttp({ authHeader: "Bearer token_db_down" });
      await handleExportSourceCode(req, res, {
        fileCollector: trackingCollector,
        authDeps: { authInstance: auth, adminDb: db },
      });
      const status = res.getStatusCode();
      assertTest(
        "TEST-07E",
        "Export saat database down ditolak 503 sebelum membaca filesystem",
        "status: 503, fileCollector calls: 0",
        `status: ${status}, fileCollector calls: ${fileCollectorInvoked}`,
        status === 503 && fileCollectorInvoked === 0
      );
    }
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  const passedCount = reports.filter((r) => r.passed).length;
  const totalCount = reports.length;
  console.log(`${CYAN}================================================================================${RESET}`);
  console.log(`📊 TAHAP 01 TEST RESULTS: ${passedCount}/${totalCount} tests passed`);
  console.log(`${CYAN}================================================================================${RESET}\n`);

  if (passedCount !== totalCount) {
    console.error(`${RED}❌ Some tests failed!${RESET}`);
    process.exit(1);
  } else {
    console.log(`${GREEN}✅ ALL 7 MANDATORY TESTS PASSED!${RESET}\n`);
  }
}

runTahap01Tests().catch((err) => {
  console.error("Test execution failed with unhandled error:", err);
  process.exit(1);
});
