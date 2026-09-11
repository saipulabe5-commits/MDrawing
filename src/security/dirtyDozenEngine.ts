import { RulesEvaluator, DatabaseState } from './rulesEvaluator';

export interface DirtyDozenScenarioResult {
  id: number;
  code: string;
  name: string;
  description: string;
  roleContext: string;
  expectedResult: "DENIED" | "ALLOWED";
  actualResult: "DENIED" | "ALLOWED" | "ERROR";
  status: "PASSED" | "FAILED";
  details: string;
  executionTimeMs: number;
}

export interface DirtyDozenSuiteSummary {
  totalTests: number;
  passedCount: number;
  failedCount: number;
  success: boolean;
  executedAt: string;
  results: DirtyDozenScenarioResult[];
}

/**
 * Build deterministic mock database state representing users, projects, and permissions
 */
function createMockDatabase(): DatabaseState {
  return {
    users: {
      'owner-active': {
        uid: 'owner-active',
        role: 'OWNER',
        isActive: true,
        canViewFinance: true,
        canEditFinance: true,
        canApproveFinance: true,
      },
      'owner-deactivated': {
        uid: 'owner-deactivated',
        role: 'OWNER',
        isActive: false, // DEACTIVATED OWNER
        canViewFinance: true,
        canEditFinance: true,
      },
      'admin-1': {
        uid: 'admin-1',
        role: 'ADMIN',
        isActive: true,
        canViewFinance: true,
        canEditFinance: true,
      },
      'finance-proj-a': {
        uid: 'finance-proj-a',
        role: 'FINANCE',
        isActive: true,
        canViewFinance: true,
        canEditFinance: true,
        assignedProjectIds: ['proj-alpha'], // Assigned ONLY to Project Alpha
      },
      'pl-proj-a': {
        uid: 'pl-proj-a',
        role: 'PROJECT_LEADER',
        isActive: true,
        assignedProjectIds: ['proj-alpha'],
      },
      'team-proj-a': {
        uid: 'team-proj-a',
        role: 'TEAM',
        isActive: true,
        assignedProjectIds: ['proj-alpha'],
      },
      'viewer-1': {
        uid: 'viewer-1',
        role: 'VIEWER',
        isActive: true,
        assignedProjectIds: ['proj-alpha'],
      },
      'inactive-user': {
        uid: 'inactive-user',
        role: 'TEAM',
        isActive: false,
      },
    },
    projects: {
      'proj-alpha': {
        id: 'proj-alpha',
        code: 'PRJ-ALPHA',
        name: 'Project Alpha',
        projectLeaderId: 'pl-proj-a',
        members: ['team-proj-a', 'finance-proj-a', 'viewer-1'],
        contractValue: 100000000,
      },
      'proj-beta': {
        id: 'proj-beta',
        code: 'PRJ-BETA',
        name: 'Project Beta',
        projectLeaderId: 'pl-other',
        members: ['team-other'],
        contractValue: 200000000,
      },
    },
  };
}

/**
 * Execute real security attack tests against rules evaluation engine
 */
export async function runDirtyDozenTestSuite(): Promise<DirtyDozenSuiteSummary> {
  const results: DirtyDozenScenarioResult[] = [];
  const db = createMockDatabase();
  const evaluator = new RulesEvaluator(db);

  // SEC-01: Anonymous Access (Unauthenticated)
  {
    const t0 = performance.now();
    const readAllowed = evaluator.evaluateProjectRead(null, 'proj-alpha');
    const writeAllowed = evaluator.evaluateProjectCreate(null);
    const pass = !readAllowed && !writeAllowed;
    results.push({
      id: 1,
      code: "SEC-01",
      name: "Akses Tanpa Autentikasi (Unauthenticated Access)",
      description: "Permintaan tanpa token otentikasi Firebase wajib ditolak secara mutlak pada seluruh collections.",
      roleContext: "Anonymous / Unauthenticated (null)",
      expectedResult: "DENIED",
      actualResult: pass ? "DENIED" : "ALLOWED",
      status: pass ? "PASSED" : "FAILED",
      details: `Evaluasi rules: readAllowed=${readAllowed}, writeAllowed=${writeAllowed}. Penolakan mutlak terverifikasi.`,
      executionTimeMs: Math.round(performance.now() - t0),
    });
  }

  // SEC-02: Deactivated User Access (isActive: false) - Including OWNER
  {
    const t0 = performance.now();
    const deactivatedOwnerAuth = {
      uid: 'owner-deactivated',
      token: { role: 'OWNER' }, // Stale OWNER claim
    };
    const readAllowed = evaluator.evaluateProjectRead(deactivatedOwnerAuth, 'proj-alpha');
    const writeAllowed = evaluator.evaluateProjectWrite(deactivatedOwnerAuth, 'proj-alpha');
    const pass = !readAllowed && !writeAllowed;
    results.push({
      id: 2,
      code: "SEC-02",
      name: "Akses Pengguna Non-Aktif (isActive: false, termasuk OWNER)",
      description: "Akun dengan status non-aktif tidak diizinkan membaca/menulis data sekalipun memiliki token claim OWNER.",
      roleContext: "Deactivated User with OWNER claim",
      expectedResult: "DENIED",
      actualResult: pass ? "DENIED" : "ALLOWED",
      status: pass ? "PASSED" : "FAILED",
      details: `Evaluasi rules: readAllowed=${readAllowed}, writeAllowed=${writeAllowed}. Hak akses dicabut seketika.`,
      executionTimeMs: Math.round(performance.now() - t0),
    });
  }

  // SEC-03: Self-Elevation Attack (Normal User tries setting role: "OWNER" or "ADMIN")
  {
    const t0 = performance.now();
    const teamAuth = { uid: 'team-proj-a' };
    const selfElevationAllowed = evaluator.evaluateUserDocUpdate(teamAuth, 'team-proj-a', {
      role: 'OWNER',
    });
    const pass = !selfElevationAllowed;
    results.push({
      id: 3,
      code: "SEC-03",
      name: "Serangan Eskalasi Peran Mandiri (Self-Elevation Attack)",
      description: "Pengguna biasa (TEAM/VIEWER) dilarang keras mengubah field 'role' atau 'isAdmin' miliknya sendiri.",
      roleContext: "Role: TEAM updating own user doc with role: OWNER",
      expectedResult: "DENIED",
      actualResult: pass ? "DENIED" : "ALLOWED",
      status: pass ? "PASSED" : "FAILED",
      details: `Evaluasi rules: selfElevationAllowed=${selfElevationAllowed}. Penolakan eskalasi peran mandiri terverifikasi.`,
      executionTimeMs: Math.round(performance.now() - t0),
    });
  }

  // SEC-04: Self-Reactivation Attack (Deactivated user tries setting isActive: true)
  {
    const t0 = performance.now();
    const inactiveAuth = { uid: 'inactive-user' };
    const selfReactivationAllowed = evaluator.evaluateUserDocUpdate(inactiveAuth, 'inactive-user', {
      isActive: true,
    });
    const pass = !selfReactivationAllowed;
    results.push({
      id: 4,
      code: "SEC-04",
      name: "Serangan Re-Aktivasi Akun Mandiri (Self-Reactivation Attack)",
      description: "Pengguna non-aktif tidak boleh mengaktifkan akunnya sendiri.",
      roleContext: "Role: INACTIVE updating own user doc with isActive: true",
      expectedResult: "DENIED",
      actualResult: pass ? "DENIED" : "ALLOWED",
      status: pass ? "PASSED" : "FAILED",
      details: `Evaluasi rules: selfReactivationAllowed=${selfReactivationAllowed}. Penolakan reaktivasi mandiri terverifikasi.`,
      executionTimeMs: Math.round(performance.now() - t0),
    });
  }

  // SEC-05: Non-Owner Deleting Active OWNER
  {
    const t0 = performance.now();
    const adminAuth = { uid: 'admin-1', token: { role: 'ADMIN' } };
    const deleteOwnerAllowed = evaluator.evaluateUserDocDelete(adminAuth, 'owner-active');
    const pass = !deleteOwnerAllowed;
    results.push({
      id: 5,
      code: "SEC-05",
      name: "Perlindungan Akun OWNER dari Penghapusan oleh Non-Owner",
      description: "Administrator maupun peran lainnya DILARANG menghapus akun dengan role OWNER.",
      roleContext: "Role: ADMIN attempting to delete OWNER user doc",
      expectedResult: "DENIED",
      actualResult: pass ? "DENIED" : "ALLOWED",
      status: pass ? "PASSED" : "FAILED",
      details: `Evaluasi rules: deleteOwnerAllowed=${deleteOwnerAllowed}. Penghapusan akun OWNER berhasil dicegah.`,
      executionTimeMs: Math.round(performance.now() - t0),
    });
  }

  // SEC-06: Financial Read Authorization (Unassigned Team User Read Finance)
  {
    const t0 = performance.now();
    const teamAuth = { uid: 'team-proj-a' };
    const financeReadAllowed = evaluator.evaluateFinancialRead(teamAuth, 'proj-alpha');
    const pass = !financeReadAllowed;
    results.push({
      id: 6,
      code: "SEC-06",
      name: "Isolasi Data Finansial dari Anggota Tim Non-Finansial",
      description: "Anggota tim teknis (TEAM/DRAFTER) dilarang mengakses dokumen tagihan, invoice, cashflow, dan quotation.",
      roleContext: "Role: TEAM (canViewFinance=false)",
      expectedResult: "DENIED",
      actualResult: pass ? "DENIED" : "ALLOWED",
      status: pass ? "PASSED" : "FAILED",
      details: `Evaluasi rules: financeReadAllowed=${financeReadAllowed}. Akses finansial hanya dibuka untuk canViewFinance.`,
      executionTimeMs: Math.round(performance.now() - t0),
    });
  }

  // SEC-07: Cross-Project Financial Access Attack (Finance A tries reading Project Beta)
  {
    const t0 = performance.now();
    const financeAuth = { uid: 'finance-proj-a' }; // Assigned to Project Alpha ONLY
    const crossProjAllowed = evaluator.evaluateFinancialRead(financeAuth, 'proj-beta');
    const pass = !crossProjAllowed;
    results.push({
      id: 7,
      code: "SEC-07",
      name: "Pencegahan Akses Finansial Lintas Proyek (Cross-Project Financial Isolation)",
      description: "Staf Finansial yang ditugaskan pada Proyek A DITOLAK membaca data finansial Proyek B.",
      roleContext: "Role: FINANCE (Assigned to Alpha only) accessing Beta",
      expectedResult: "DENIED",
      actualResult: pass ? "DENIED" : "ALLOWED",
      status: pass ? "PASSED" : "FAILED",
      details: `Evaluasi rules: crossProjAllowed=${crossProjAllowed}. Project assignment boundary terverifikasi ketat.`,
      executionTimeMs: Math.round(performance.now() - t0),
    });
  }

  // SEC-08: Cross-Project Drawing Access Attack (Team A tries accessing Project Beta)
  {
    const t0 = performance.now();
    const teamAuth = { uid: 'team-proj-a' }; // Assigned to Alpha ONLY
    const crossProjDrawingAllowed = evaluator.evaluateDrawingRead(teamAuth, 'proj-beta');
    const pass = !crossProjDrawingAllowed;
    results.push({
      id: 8,
      code: "SEC-08",
      name: "Pencegahan Akses Gambar CAD Lintas Proyek (Cross-Project Drawing Isolation)",
      description: "Drafter/Engineer Proyek A dilarang mengakses file teknis/gambar CAD milik Proyek B.",
      roleContext: "Role: TEAM (Assigned to Alpha only) accessing drawings of Beta",
      expectedResult: "DENIED",
      actualResult: pass ? "DENIED" : "ALLOWED",
      status: pass ? "PASSED" : "FAILED",
      details: `Evaluasi rules: crossProjDrawingAllowed=${crossProjDrawingAllowed}. Isolasi gambar CAD lintas proyek berhasil.`,
      executionTimeMs: Math.round(performance.now() - t0),
    });
  }

  // SEC-09: Storage Path Escaping & Impersonation (Upload to Project without Assignment)
  {
    const t0 = performance.now();
    const teamAuth = { uid: 'team-proj-a' };
    const uploadAllowed = evaluator.evaluateStorageUpload(teamAuth, 'projects/proj-beta/drawings/secret.dwg');
    const pass = !uploadAllowed;
    results.push({
      id: 9,
      code: "SEC-09",
      name: "Pencegahan Storage Upload Lintas Proyek (Storage Path Protection)",
      description: "Pengguna dilarang mengunggah file ke path bucket Firebase Storage proyek yang bukan haknya.",
      roleContext: "Role: TEAM (Assigned to Alpha) uploading to /projects/proj-beta/",
      expectedResult: "DENIED",
      actualResult: pass ? "DENIED" : "ALLOWED",
      status: pass ? "PASSED" : "FAILED",
      details: `Evaluasi storage rules: uploadAllowed=${uploadAllowed}. Akses bucket diisolasi ketat berdasarkan keanggotaan proyek.`,
      executionTimeMs: Math.round(performance.now() - t0),
    });
  }

  // SEC-10: Stale Role Claim Privilege Abuse (Token Claim says OWNER, DB says VIEWER)
  {
    const t0 = performance.now();
    const demotedUserAuth = {
      uid: 'viewer-1',
      token: { role: 'OWNER' }, // Forged or stale JWT token claim
    };
    const financeEditAllowed = evaluator.evaluateFinancialWrite(demotedUserAuth, 'proj-alpha');
    const pass = !financeEditAllowed;
    results.push({
      id: 10,
      code: "SEC-10",
      name: "Pencegahan Stale JWT Token Claim (Database-First RBAC Verification)",
      description: "Evaluasi keamanan wajib memverifikasi dokumen Firestore aktual, bukan sekadar token claim JWT yang belum kedaluwarsa.",
      roleContext: "User with Stale OWNER Token Claim, but DB role is VIEWER",
      expectedResult: "DENIED",
      actualResult: pass ? "DENIED" : "ALLOWED",
      status: pass ? "PASSED" : "FAILED",
      details: `Evaluasi rules: financeEditAllowed=${financeEditAllowed}. Aturan Firestore menolak token stale secara konsisten.`,
      executionTimeMs: Math.round(performance.now() - t0),
    });
  }

  // SEC-11: Tampering AI Audit Logs (Direct User Modification)
  {
    const t0 = performance.now();
    const adminAuth = { uid: 'admin-1', token: { role: 'ADMIN' } };
    const logModifyAllowed = evaluator.evaluateAiAuditLogWrite(adminAuth, 'log-123');
    const pass = !logModifyAllowed;
    results.push({
      id: 11,
      code: "SEC-11",
      name: "Perlindungan Audit Trail AI dari Modifikasi Klien (Immutable AI Logs)",
      description: "Dokumen log AI hanya boleh dibuat oleh service backend berotentikasi, tidak boleh ditulis/diubah langsung dari client SDK.",
      roleContext: "Role: ADMIN attempting direct write to ai_audit_logs",
      expectedResult: "DENIED",
      actualResult: pass ? "DENIED" : "ALLOWED",
      status: pass ? "PASSED" : "FAILED",
      details: `Evaluasi rules: logModifyAllowed=${logModifyAllowed}. Audit log AI berstatus immutable (append-only via backend).`,
      executionTimeMs: Math.round(performance.now() - t0),
    });
  }

  // SEC-12: Financial Document Creation without Project ID or Scope
  {
    const t0 = performance.now();
    const financeAuth = { uid: 'finance-proj-a' }; // Finance user assigned ONLY to Project Alpha
    // Attack 1: Create invoice for unassigned Project Beta
    const crossProjInvoiceAllowed = evaluator.evaluateInvoiceCreate(financeAuth, {
      projectId: 'proj-beta',
      grandTotal: 15000000,
    });
    // Attack 2: Create projectless invoice
    const projectlessInvoiceAllowed = evaluator.evaluateInvoiceCreate(financeAuth, {
      projectId: '',
      grandTotal: 15000000,
    });
    const pass = !crossProjInvoiceAllowed && !projectlessInvoiceAllowed;
    results.push({
      id: 12,
      code: "SEC-12",
      name: "Pencegahan Pembuatan Finansial Lintas Proyek / Projectless (Project Scope on Financial Create)",
      description: "Pengguna dengan canEditFinance=true yang ditugaskan pada Proyek A DITOLAK membuat tagihan untuk Proyek B atau tagihan tanpa proyek.",
      roleContext: "Role: FINANCE assigned to Alpha creating invoice for Beta",
      expectedResult: "DENIED",
      actualResult: pass ? "DENIED" : "ALLOWED",
      status: pass ? "PASSED" : "FAILED",
      details: `Evaluasi rules: crossProjInvoiceAllowed=${crossProjInvoiceAllowed}, projectlessInvoiceAllowed=${projectlessInvoiceAllowed}. Ditolak.`,
      executionTimeMs: Math.round(performance.now() - t0),
    });
  }

  // SEC-13: Cross-Project Invoice Create
  {
    const t0 = performance.now();
    const financeAuth = { uid: 'finance-proj-a' };
    const allowed = evaluator.evaluateInvoiceCreate(financeAuth, { projectId: 'proj-beta', grandTotal: 10000000 });
    const pass = !allowed;
    results.push({
      id: 13,
      code: "SEC-13",
      name: "Pencegahan Pembuatan Invoice Lintas Proyek (Cross-Project Invoice Create)",
      description: "Finance Proyek Alpha dilarang membuat invoice pada Proyek Beta.",
      roleContext: "Role: FINANCE (Alpha) creating Invoice for Beta",
      expectedResult: "DENIED",
      actualResult: pass ? "DENIED" : "ALLOWED",
      status: pass ? "PASSED" : "FAILED",
      details: `Evaluasi rules: allowed=${allowed}. Akses lintas proyek ditolak mutlak.`,
      executionTimeMs: Math.round(performance.now() - t0),
    });
  }

  // SEC-14: Cross-Project Client Payment Create
  {
    const t0 = performance.now();
    const financeAuth = { uid: 'finance-proj-a' };
    const allowed = evaluator.evaluateClientPaymentCreate(financeAuth, { projectId: 'proj-beta', amount: 5000000 });
    const pass = !allowed;
    results.push({
      id: 14,
      code: "SEC-14",
      name: "Pencegahan Pencatatan Pembayaran Klien Lintas Proyek (Cross-Project Client Payment Create)",
      description: "Finance Proyek Alpha dilarang mencatat penerimaan pembayaran klien pada Proyek Beta.",
      roleContext: "Role: FINANCE (Alpha) creating Client Payment for Beta",
      expectedResult: "DENIED",
      actualResult: pass ? "DENIED" : "ALLOWED",
      status: pass ? "PASSED" : "FAILED",
      details: `Evaluasi rules: allowed=${allowed}. Mutasi pembayaran lintas proyek ditolak.`,
      executionTimeMs: Math.round(performance.now() - t0),
    });
  }

  // SEC-15: Cross-Project Vendor Bill Create
  {
    const t0 = performance.now();
    const financeAuth = { uid: 'finance-proj-a' };
    const allowed = evaluator.evaluateVendorBillCreate(financeAuth, { projectId: 'proj-beta', amount: 2500000 });
    const pass = !allowed;
    results.push({
      id: 15,
      code: "SEC-15",
      name: "Pencegahan Pembuatan Tagihan Vendor Lintas Proyek (Cross-Project Vendor Bill Create)",
      description: "Finance Proyek Alpha dilarang membuat tagihan vendor (bill) untuk Proyek Beta.",
      roleContext: "Role: FINANCE (Alpha) creating Vendor Bill for Beta",
      expectedResult: "DENIED",
      actualResult: pass ? "DENIED" : "ALLOWED",
      status: pass ? "PASSED" : "FAILED",
      details: `Evaluasi rules: allowed=${allowed}. Tagihan vendor lintas proyek ditolak.`,
      executionTimeMs: Math.round(performance.now() - t0),
    });
  }

  // SEC-16: Cross-Project Vendor Payment Create
  {
    const t0 = performance.now();
    const financeAuth = { uid: 'finance-proj-a' };
    const allowed = evaluator.evaluateVendorPaymentCreate(financeAuth, { projectId: 'proj-beta', amount: 2500000 });
    const pass = !allowed;
    results.push({
      id: 16,
      code: "SEC-16",
      name: "Pencegahan Pembayaran Vendor Lintas Proyek (Cross-Project Vendor Payment Create)",
      description: "Finance Proyek Alpha dilarang membuat pembayaran vendor untuk Proyek Beta.",
      roleContext: "Role: FINANCE (Alpha) creating Vendor Payment for Beta",
      expectedResult: "DENIED",
      actualResult: pass ? "DENIED" : "ALLOWED",
      status: pass ? "PASSED" : "FAILED",
      details: `Evaluasi rules: allowed=${allowed}. Pembayaran vendor lintas proyek ditolak.`,
      executionTimeMs: Math.round(performance.now() - t0),
    });
  }

  // SEC-17: Cross-Project Expense Create
  {
    const t0 = performance.now();
    const financeAuth = { uid: 'finance-proj-a' };
    const allowed = evaluator.evaluateExpenseCreate(financeAuth, { projectId: 'proj-beta', amount: 750000 });
    const pass = !allowed;
    results.push({
      id: 17,
      code: "SEC-17",
      name: "Pencegahan Pencatatan Biaya Proyek Lintas Proyek (Cross-Project Expense Create)",
      description: "Finance Proyek Alpha dilarang mencatat biaya proyek langsung untuk Proyek Beta.",
      roleContext: "Role: FINANCE (Alpha) creating Expense for Beta",
      expectedResult: "DENIED",
      actualResult: pass ? "DENIED" : "ALLOWED",
      status: pass ? "PASSED" : "FAILED",
      details: `Evaluasi rules: allowed=${allowed}. Biaya lintas proyek ditolak.`,
      executionTimeMs: Math.round(performance.now() - t0),
    });
  }

  // SEC-18: Cross-Project Cashflow Create
  {
    const t0 = performance.now();
    const financeAuth = { uid: 'finance-proj-a' };
    const allowed = evaluator.evaluateCashflowCreate(financeAuth, { projectId: 'proj-beta', amount: 1000000 });
    const pass = !allowed;
    results.push({
      id: 18,
      code: "SEC-18",
      name: "Pencegahan Pencatatan Arus Kas Lintas Proyek (Cross-Project Cashflow Create)",
      description: "Finance Proyek Alpha dilarang membuat entri arus kas untuk Proyek Beta.",
      roleContext: "Role: FINANCE (Alpha) creating Cashflow for Beta",
      expectedResult: "DENIED",
      actualResult: pass ? "DENIED" : "ALLOWED",
      status: pass ? "PASSED" : "FAILED",
      details: `Evaluasi rules: allowed=${allowed}. Arus kas lintas proyek ditolak.`,
      executionTimeMs: Math.round(performance.now() - t0),
    });
  }

  // SEC-19: Projectless Financial Create
  {
    const t0 = performance.now();
    const financeAuth = { uid: 'finance-proj-a' };
    const allowedEmpty = evaluator.evaluateInvoiceCreate(financeAuth, { projectId: '', grandTotal: 5000000 });
    const allowedMissing = evaluator.evaluateInvoiceCreate(financeAuth, { grandTotal: 5000000 });
    const pass = !allowedEmpty && !allowedMissing;
    results.push({
      id: 19,
      code: "SEC-19",
      name: "Pencegahan Entri Finansial Tanpa Proyek (Projectless Financial Create)",
      description: "Setiap mutasi finansial wajib memiliki projectId yang valid dan tidak boleh kosong.",
      roleContext: "Role: FINANCE creating invoice with projectId: '' or undefined",
      expectedResult: "DENIED",
      actualResult: pass ? "DENIED" : "ALLOWED",
      status: pass ? "PASSED" : "FAILED",
      details: `Evaluasi rules: allowedEmpty=${allowedEmpty}, allowedMissing=${allowedMissing}. Entri tanpa proyek ditolak mutlak.`,
      executionTimeMs: Math.round(performance.now() - t0),
    });
  }

  // SEC-20: Financial ProjectId Reassignment on Update
  {
    const t0 = performance.now();
    const financeAuth = { uid: 'finance-proj-a' };
    const allowedReassign = evaluator.evaluateFinancialProjectIdUpdate(financeAuth, 'proj-alpha', 'proj-beta');
    const pass = !allowedReassign;
    results.push({
      id: 20,
      code: "SEC-20",
      name: "Pencegahan Pemindahan Proyek pada Finansial (Financial ProjectId Immutability)",
      description: "Field projectId pada seluruh rekaman finansial bersifat immutable dan dilarang diubah ke proyek lain.",
      roleContext: "Role: FINANCE updating quotation projectId from Alpha to Beta",
      expectedResult: "DENIED",
      actualResult: pass ? "DENIED" : "ALLOWED",
      status: pass ? "PASSED" : "FAILED",
      details: `Evaluasi rules: allowedReassign=${allowedReassign}. Mutasi projectId ditolak.`,
      executionTimeMs: Math.round(performance.now() - t0),
    });
  }

  const passedCount = results.filter((r) => r.status === "PASSED").length;

  return {
    totalTests: results.length,
    passedCount,
    failedCount: results.length - passedCount,
    success: passedCount === results.length,
    executedAt: new Date().toISOString(),
    results,
  };
}
