/**
 * MDrawing Real Firebase Rules Integration Test Suite (SEC-01 through SEC-20)
 * Evaluates ACTUAL firestore.rules and storage.rules against the Firebase Emulator.
 *
 * Command: npx firebase emulators:exec --only firestore,storage "tsx scripts/real-emulator-security.ts"
 */
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

interface TestResult {
  code: string;
  name: string;
  expected: "DENIED" | "ALLOWED";
  actual: "DENIED" | "ALLOWED";
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordResult(code: string, name: string, expected: "DENIED" | "ALLOWED", actual: "DENIED" | "ALLOWED", details: string) {
  const passed = expected === actual;
  results.push({ code, name, expected, actual, passed, details });
  const symbol = passed ? "✅" : "❌";
  console.log(`${symbol} [${code}] ${name}`);
  console.log(`   Expected: ${expected} | Actual: ${actual} | Status: ${passed ? "PASS" : "FAIL"}`);
  console.log(`   Details: ${details}\n`);
}

async function runSecuritySuite() {
  console.log("================================================================================");
  console.log("🛡️ RUNNING REAL FIREBASE SECURITY EMULATOR TEST SUITE (SEC-01 - SEC-20)");
  console.log("================================================================================\n");

  const firestoreRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
  let storageRules: string | undefined;
  try {
    storageRules = fs.readFileSync(path.resolve(process.cwd(), 'storage.rules'), 'utf8');
  } catch {}

  const projectId = `mdrawing-sec-test-${Date.now()}`;
  const testEnv: RulesTestEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: firestoreRules,
      host: '127.0.0.1',
      port: 8888,
    },
    storage: storageRules ? {
      rules: storageRules,
      host: '127.0.0.1',
      port: 8999,
    } : undefined,
  });

  try {
    // -------------------------------------------------------------
    // SEED DATABASE STATE WITH ROOT PRIVILEGES (ADMIN CONTEXT)
    // -------------------------------------------------------------
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const now = new Date().toISOString();

      // Seed Users
      await setDoc(doc(db, 'users', 'owner-active'), {
        uid: 'owner-active',
        role: 'OWNER',
        isActive: true,
        canViewFinance: true,
        canEditFinance: true,
        canApproveFinance: true,
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'users', 'owner-deactivated'), {
        uid: 'owner-deactivated',
        role: 'OWNER',
        isActive: false, // DEACTIVATED IN DATABASE
        canViewFinance: true,
        canEditFinance: true,
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'users', 'admin-1'), {
        uid: 'admin-1',
        role: 'ADMIN',
        isActive: true,
        canViewFinance: true,
        canEditFinance: true,
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'users', 'finance-proj-a'), {
        uid: 'finance-proj-a',
        role: 'FINANCE',
        isActive: true,
        canViewFinance: true,
        canEditFinance: true,
        assignedProjectIds: ['proj-alpha'],
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'users', 'pl-proj-a'), {
        uid: 'pl-proj-a',
        role: 'PROJECT_LEADER',
        isActive: true,
        assignedProjectIds: ['proj-alpha'],
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'users', 'team-proj-a'), {
        uid: 'team-proj-a',
        role: 'TEAM',
        isActive: true,
        assignedProjectIds: ['proj-alpha'],
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'users', 'viewer-1'), {
        uid: 'viewer-1',
        role: 'VIEWER',
        isActive: true,
        assignedProjectIds: ['proj-alpha'],
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'users', 'inactive-user'), {
        uid: 'inactive-user',
        role: 'TEAM',
        isActive: false,
        createdAt: now,
        updatedAt: now,
      });

      // Seed Projects
      await setDoc(doc(db, 'projects', 'proj-alpha'), {
        id: 'proj-alpha',
        code: 'PRJ-ALPHA',
        name: 'Project Alpha',
        projectLeaderId: 'pl-proj-a',
        members: ['team-proj-a', 'finance-proj-a', 'viewer-1'],
        contractValue: 100000000,
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'projects', 'proj-beta'), {
        id: 'proj-beta',
        code: 'PRJ-BETA',
        name: 'Project Beta',
        projectLeaderId: 'pl-other',
        members: ['other-user'],
        contractValue: 200000000,
        createdAt: now,
        updatedAt: now,
      });

      // Seed Existing Documents
      await setDoc(doc(db, 'quotations', 'q-alpha-1'), {
        id: 'q-alpha-1',
        projectId: 'proj-alpha',
        quotationNumber: 'Q-001',
        grandTotal: 50000000,
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'quotations', 'q-beta-1'), {
        id: 'q-beta-1',
        projectId: 'proj-beta',
        quotationNumber: 'Q-B-001',
        grandTotal: 30000000,
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'invoices', 'inv-alpha-1'), {
        id: 'inv-alpha-1',
        projectId: 'proj-alpha',
        invoiceNumber: 'INV-A-001',
        grandTotal: 10000000,
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'invoices', 'inv-beta-1'), {
        id: 'inv-beta-1',
        projectId: 'proj-beta',
        invoiceNumber: 'INV-B-001',
        grandTotal: 20000000,
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'projectVendors', 'pv-alpha-1'), {
        id: 'pv-alpha-1',
        projectId: 'proj-alpha',
        vendorName: 'Vendor Alpha',
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'drawingItems', 'item-beta-1'), {
        id: 'item-beta-1',
        projectId: 'proj-beta',
        drawingNumber: 'DWG-B-001',
        title: 'Drawing Beta 1',
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'clientPayments', 'cp-beta-1'), {
        id: 'cp-beta-1',
        projectId: 'proj-beta',
        invoiceId: 'inv-beta-1',
        amount: 5000000,
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'vendorBills', 'vb-beta-1'), {
        id: 'vb-beta-1',
        projectId: 'proj-beta',
        billNumber: 'VB-B-001',
        amount: 8000000,
        createdAt: now,
        updatedAt: now,
      });

      if (storageRules) {
        const dummyPdf = new Uint8Array([37, 80, 68, 70]);
        await uploadBytes(ref(context.storage(), 'projects/proj-alpha/drawings/test.pdf'), dummyPdf, { contentType: 'application/pdf' });
      }
    });

    // -------------------------------------------------------------
    // CLIENT TEST CONTEXTS
    // -------------------------------------------------------------
    const anonContext = testEnv.unauthenticatedContext();
    const inactiveContext = testEnv.authenticatedContext('inactive-user', { email: 'inactive@example.com' });
    const inactiveOwnerContext = testEnv.authenticatedContext('owner-deactivated', { email: 'owner.deact@example.com', role: 'OWNER' });
    const viewerContext = testEnv.authenticatedContext('viewer-1', { email: 'viewer@example.com' });
    const teamContext = testEnv.authenticatedContext('team-proj-a', { email: 'team@example.com' });
    const plContext = testEnv.authenticatedContext('pl-proj-a', { email: 'pl@example.com' });
    const financeContext = testEnv.authenticatedContext('finance-proj-a', { email: 'finance@example.com' });
    const adminContext = testEnv.authenticatedContext('admin-1', { email: 'admin@example.com', role: 'ADMIN' });
    const staleOwnerContext = testEnv.authenticatedContext('owner-deactivated', { email: 'stale-owner@example.com', role: 'OWNER' });
    const activeOwnerContext = testEnv.authenticatedContext('owner-active', { email: 'active-owner@example.com', role: 'OWNER' });

    // -------------------------------------------------------------
    // SEC-01: Anonymous Read
    // -------------------------------------------------------------
    try {
      await assertFails(getDoc(doc(anonContext.firestore(), 'projects', 'proj-alpha')));
      recordResult("SEC-01", "Anonymous Read Prohibited", "DENIED", "DENIED", "Akses baca anonymous ke projects/proj-alpha berhasil ditolak oleh firestore.rules");
    } catch (e: any) {
      recordResult("SEC-01", "Anonymous Read Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-02: Inactive User Read
    // -------------------------------------------------------------
    try {
      await assertFails(getDoc(doc(inactiveContext.firestore(), 'projects', 'proj-alpha')));
      recordResult("SEC-02", "Inactive User Read Prohibited", "DENIED", "DENIED", "Pengguna isActive: false ditolak membaca projects/proj-alpha");
    } catch (e: any) {
      recordResult("SEC-02", "Inactive User Read Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-03: Inactive User Write
    // -------------------------------------------------------------
    try {
      await assertFails(setDoc(doc(inactiveContext.firestore(), 'drawingItems', 'item-attack'), {
        projectId: 'proj-alpha',
        drawingNumber: 'DWG-001',
      }));
      recordResult("SEC-03", "Inactive User Write Prohibited", "DENIED", "DENIED", "Pengguna isActive: false ditolak menulis drawingItems");
    } catch (e: any) {
      recordResult("SEC-03", "Inactive User Write Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-04: Viewer Write Prohibited
    // -------------------------------------------------------------
    try {
      await assertFails(setDoc(doc(viewerContext.firestore(), 'drawingItems', 'item-viewer-attack'), {
        projectId: 'proj-alpha',
        drawingNumber: 'DWG-002',
      }));
      recordResult("SEC-04", "Viewer Write Prohibited", "DENIED", "DENIED", "Role VIEWER ditolak menulis drawingItems");
    } catch (e: any) {
      recordResult("SEC-04", "Viewer Write Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-05: Self Role Escalation
    // -------------------------------------------------------------
    try {
      await assertFails(updateDoc(doc(teamContext.firestore(), 'users', 'team-proj-a'), {
        role: 'OWNER',
        updatedAt: new Date().toISOString(),
      }));
      recordResult("SEC-05", "Self Role Escalation Prohibited", "DENIED", "DENIED", "Role TEAM ditolak mengubah rolenya sendiri menjadi OWNER");
    } catch (e: any) {
      recordResult("SEC-05", "Self Role Escalation Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-06: Self Activation
    // -------------------------------------------------------------
    try {
      await assertFails(updateDoc(doc(inactiveContext.firestore(), 'users', 'inactive-user'), {
        isActive: true,
        updatedAt: new Date().toISOString(),
      }));
      recordResult("SEC-06", "Self Activation Prohibited", "DENIED", "DENIED", "Pengguna non-aktif ditolak mengaktifkan akunnya sendiri");
    } catch (e: any) {
      recordResult("SEC-06", "Self Activation Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-07: Admin Appoint Owner Prohibited
    // -------------------------------------------------------------
    try {
      await assertFails(updateDoc(doc(adminContext.firestore(), 'users', 'team-proj-a'), {
        role: 'OWNER',
        updatedAt: new Date().toISOString(),
      }));
      recordResult("SEC-07", "Admin Appoint Owner Prohibited", "DENIED", "DENIED", "Admin biasa ditolak mengangkat user lain menjadi OWNER");
    } catch (e: any) {
      recordResult("SEC-07", "Admin Appoint Owner Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-08: Cross-Project Read Prohibited
    // -------------------------------------------------------------
    try {
      await assertFails(getDoc(doc(teamContext.firestore(), 'projects', 'proj-beta')));
      recordResult("SEC-08", "Cross-Project Read Prohibited", "DENIED", "DENIED", "Anggota Project Alpha ditolak membaca data Project Beta");
    } catch (e: any) {
      recordResult("SEC-08", "Cross-Project Read Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-09: Cross-Project Write Prohibited
    // -------------------------------------------------------------
    try {
      await assertFails(setDoc(doc(plContext.firestore(), 'drawingItems', 'item-cross-write'), {
        projectId: 'proj-beta',
        drawingNumber: 'DWG-003',
      }));
      recordResult("SEC-09", "Cross-Project Write Prohibited", "DENIED", "DENIED", "Project Leader Alpha ditolak membuat drawing pada Project Beta");
    } catch (e: any) {
      recordResult("SEC-09", "Cross-Project Write Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-10: Stale OWNER Token After DB Deactivation
    // -------------------------------------------------------------
    try {
      await assertFails(getDoc(doc(staleOwnerContext.firestore(), 'projects', 'proj-alpha')));
      recordResult("SEC-10", "Stale OWNER Token Blocked by Database-First RBAC", "DENIED", "DENIED", "Token custom claim OWNER ditolak karena isActive==false pada dokumen Firestore");
    } catch (e: any) {
      recordResult("SEC-10", "Stale OWNER Token Blocked by Database-First RBAC", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-11: AI Audit Log Tampering (Update / Delete)
    // -------------------------------------------------------------
    try {
      // First create valid audit log as active owner
      await assertSucceeds(setDoc(doc(activeOwnerContext.firestore(), 'aiAuditLogs', 'log-1'), {
        actorUid: 'owner-active',
        action: 'INSPECT',
        timestamp: new Date().toISOString(),
      }));
      // Attempt update
      await assertFails(updateDoc(doc(activeOwnerContext.firestore(), 'aiAuditLogs', 'log-1'), {
        action: 'TAMPERED',
      }));
      // Attempt delete
      await assertFails(deleteDoc(doc(activeOwnerContext.firestore(), 'aiAuditLogs', 'log-1')));
      recordResult("SEC-11", "AI Audit Log Tampering Prohibited (Immutable)", "DENIED", "DENIED", "Update dan delete pada aiAuditLogs berhasil ditolak secara mutlak");
    } catch (e: any) {
      recordResult("SEC-11", "AI Audit Log Tampering Prohibited (Immutable)", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-12: Financial Create Without Project Scope
    // -------------------------------------------------------------
    try {
      await assertFails(setDoc(doc(financeContext.firestore(), 'quotations', 'q-no-proj'), {
        quotationNumber: 'Q-999',
        grandTotal: 1000000,
      }));
      recordResult("SEC-12", "Financial Create Without Project Scope Prohibited", "DENIED", "DENIED", "Pembuatan quotation tanpa projectId ditolak");
    } catch (e: any) {
      recordResult("SEC-12", "Financial Create Without Project Scope Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-13: Cross-Project Invoice Create
    // -------------------------------------------------------------
    try {
      await assertFails(setDoc(doc(financeContext.firestore(), 'invoices', 'inv-cross'), {
        projectId: 'proj-beta', // Finance Alpha trying to create invoice on Project Beta
        invoiceNumber: 'INV-001',
        grandTotal: 10000000,
      }));
      recordResult("SEC-13", "Cross-Project Invoice Create Prohibited", "DENIED", "DENIED", "Finance Alpha ditolak membuat invoice pada Project Beta");
    } catch (e: any) {
      recordResult("SEC-13", "Cross-Project Invoice Create Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-14: Cross-Project Client Payment Create
    // -------------------------------------------------------------
    try {
      await assertFails(setDoc(doc(financeContext.firestore(), 'clientPayments', 'pay-cross'), {
        projectId: 'proj-beta',
        amount: 5000000,
        paymentDate: '2026-09-11',
      }));
      recordResult("SEC-14", "Cross-Project Client Payment Create Prohibited", "DENIED", "DENIED", "Finance Alpha ditolak mencatat client payment pada Project Beta");
    } catch (e: any) {
      recordResult("SEC-14", "Cross-Project Client Payment Create Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-15: Cross-Project Vendor Bill Create
    // -------------------------------------------------------------
    try {
      await assertFails(setDoc(doc(financeContext.firestore(), 'vendorBills', 'bill-cross'), {
        projectId: 'proj-beta',
        billNumber: 'VB-001',
        amount: 2500000,
      }));
      recordResult("SEC-15", "Cross-Project Vendor Bill Create Prohibited", "DENIED", "DENIED", "Finance Alpha ditolak membuat vendor bill pada Project Beta");
    } catch (e: any) {
      recordResult("SEC-15", "Cross-Project Vendor Bill Create Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-16: Cross-Project Vendor Payment Create
    // -------------------------------------------------------------
    try {
      await assertFails(setDoc(doc(financeContext.firestore(), 'vendorPayments', 'vpay-cross'), {
        projectId: 'proj-beta',
        amount: 2500000,
        paymentDate: '2026-09-11',
      }));
      recordResult("SEC-16", "Cross-Project Vendor Payment Create Prohibited", "DENIED", "DENIED", "Finance Alpha ditolak membuat vendor payment pada Project Beta");
    } catch (e: any) {
      recordResult("SEC-16", "Cross-Project Vendor Payment Create Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-17: Cross-Project Expense Create
    // -------------------------------------------------------------
    try {
      await assertFails(setDoc(doc(financeContext.firestore(), 'projectExpenses', 'exp-cross'), {
        projectId: 'proj-beta',
        amount: 750000,
        category: 'Printing',
      }));
      recordResult("SEC-17", "Cross-Project Expense Create Prohibited", "DENIED", "DENIED", "Finance Alpha ditolak mencatat pengeluaran pada Project Beta");
    } catch (e: any) {
      recordResult("SEC-17", "Cross-Project Expense Create Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-18: Cross-Project Cashflow Create
    // -------------------------------------------------------------
    try {
      await assertFails(setDoc(doc(financeContext.firestore(), 'cashflowEntries', 'cf-cross'), {
        projectId: 'proj-beta',
        amount: 1000000,
        type: 'IN',
      }));
      recordResult("SEC-18", "Cross-Project Cashflow Create Prohibited", "DENIED", "DENIED", "Finance Alpha ditolak mencatat arus kas pada Project Beta");
    } catch (e: any) {
      recordResult("SEC-18", "Cross-Project Cashflow Create Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-19: Projectless Financial Create
    // -------------------------------------------------------------
    try {
      await assertFails(setDoc(doc(financeContext.firestore(), 'invoices', 'inv-empty-proj'), {
        projectId: '', // Empty string projectId
        invoiceNumber: 'INV-ERR',
        grandTotal: 5000000,
      }));
      recordResult("SEC-19", "Projectless Financial Create Prohibited", "DENIED", "DENIED", "Pembuatan invoice dengan projectId kosong ditolak");
    } catch (e: any) {
      recordResult("SEC-19", "Projectless Financial Create Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-20: Financial ProjectId Reassignment on Update
    // -------------------------------------------------------------
    try {
      await assertFails(updateDoc(doc(financeContext.firestore(), 'quotations', 'q-alpha-1'), {
        projectId: 'proj-beta', // Attempting to reassign projectId to Beta
      }));
      recordResult("SEC-20", "Financial ProjectId Reassignment Prohibited (Immutable)", "DENIED", "DENIED", "Upaya memindahkan quotation ke project lain ditolak");
    } catch (e: any) {
      recordResult("SEC-20", "Financial ProjectId Reassignment Prohibited (Immutable)", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-21: Storage Delete Scope (Team Cannot Delete Drawings)
    // -------------------------------------------------------------
    try {
      await assertFails(deleteObject(ref(teamContext.storage(), 'projects/proj-alpha/drawings/test.pdf')));
      recordResult("SEC-21", "Storage Delete Scope Enforcement", "DENIED", "DENIED", "Anggota Team tidak dapat menghapus berkas drawing (khusus PL/Owner/Admin)");
    } catch (e: any) {
      recordResult("SEC-21", "Storage Delete Scope Enforcement", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-22: Storage Overwrite Scope (Viewer Cannot Write/Overwrite)
    // -------------------------------------------------------------
    try {
      const dummyPdf = new Uint8Array([37, 80, 68, 70]);
      await assertFails(uploadBytes(ref(viewerContext.storage(), 'projects/proj-alpha/drawings/test.pdf'), dummyPdf, { contentType: 'application/pdf' }));
      recordResult("SEC-22", "Storage Overwrite Scope Enforcement", "DENIED", "DENIED", "Viewer ditolak mengunggah atau menimpa berkas proyek");
    } catch (e: any) {
      recordResult("SEC-22", "Storage Overwrite Scope Enforcement", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-23: Cross-Project Document Update Prohibited
    // -------------------------------------------------------------
    try {
      await assertFails(updateDoc(doc(teamContext.firestore(), 'drawingItems', 'item-beta-1'), {
        title: 'Hacked Drawing Item',
      }));
      recordResult("SEC-23", "Cross-Project Document Update Prohibited", "DENIED", "DENIED", "Anggota Project Alpha ditolak mengubah dokumen drawing Project Beta");
    } catch (e: any) {
      recordResult("SEC-23", "Cross-Project Document Update Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-24: Cross-Project Document Delete Prohibited
    // -------------------------------------------------------------
    try {
      await assertFails(deleteDoc(doc(teamContext.firestore(), 'drawingItems', 'item-beta-1')));
      recordResult("SEC-24", "Cross-Project Document Delete Prohibited", "DENIED", "DENIED", "Anggota Project Alpha ditolak menghapus dokumen drawing Project Beta");
    } catch (e: any) {
      recordResult("SEC-24", "Cross-Project Document Delete Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-25: Vendor Bill Cross-Project Update Prohibited
    // -------------------------------------------------------------
    try {
      await assertFails(updateDoc(doc(financeContext.firestore(), 'vendorBills', 'vb-beta-1'), {
        amount: 99999999,
      }));
      recordResult("SEC-25", "Vendor Bill Cross-Project Update Prohibited", "DENIED", "DENIED", "Finance Alpha ditolak mengubah vendor bill pada Project Beta");
    } catch (e: any) {
      recordResult("SEC-25", "Vendor Bill Cross-Project Update Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-26: Client Payment Cross-Project Delete Prohibited
    // -------------------------------------------------------------
    try {
      await assertFails(deleteDoc(doc(financeContext.firestore(), 'clientPayments', 'cp-beta-1')));
      recordResult("SEC-26", "Client Payment Cross-Project Delete Prohibited", "DENIED", "DENIED", "Finance Alpha ditolak menghapus client payment pada Project Beta");
    } catch (e: any) {
      recordResult("SEC-26", "Client Payment Cross-Project Delete Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-27: Vendor Reassignment Prohibited (Immutable ProjectId)
    // -------------------------------------------------------------
    try {
      await assertFails(updateDoc(doc(financeContext.firestore(), 'projectVendors', 'pv-alpha-1'), {
        projectId: 'proj-beta',
      }));
      recordResult("SEC-27", "Vendor Project Reassignment Prohibited", "DENIED", "DENIED", "Upaya memindahkan vendor assignment ke project lain ditolak");
    } catch (e: any) {
      recordResult("SEC-27", "Vendor Project Reassignment Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-28: Invoice Reassignment Prohibited (Immutable ProjectId)
    // -------------------------------------------------------------
    try {
      await assertFails(updateDoc(doc(financeContext.firestore(), 'invoices', 'inv-alpha-1'), {
        projectId: 'proj-beta',
      }));
      recordResult("SEC-28", "Invoice Project Reassignment Prohibited", "DENIED", "DENIED", "Upaya memindahkan invoice ke project lain ditolak");
    } catch (e: any) {
      recordResult("SEC-28", "Invoice Project Reassignment Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-29: Drawing Item ProjectId Reassignment Prohibited
    // -------------------------------------------------------------
    try {
      await assertFails(updateDoc(doc(teamContext.firestore(), 'drawingItems', 'item-beta-1'), {
        projectId: 'proj-alpha',
      }));
      recordResult("SEC-29", "Drawing Item Project Reassignment Prohibited", "DENIED", "DENIED", "Upaya memindahkan drawing item ke project lain ditolak");
    } catch (e: any) {
      recordResult("SEC-29", "Drawing Item Project Reassignment Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-30: Inactive User Firestore Write Prohibited
    // -------------------------------------------------------------
    try {
      await assertFails(setDoc(doc(inactiveContext.firestore(), 'invoices', 'inv-inact-1'), {
        projectId: 'proj-alpha',
        invoiceNumber: 'INV-INACT',
        grandTotal: 1000000,
      }));
      recordResult("SEC-30", "Inactive User Firestore Write Prohibited", "DENIED", "DENIED", "User non-aktif ditolak membuat dokumen finansial");
    } catch (e: any) {
      recordResult("SEC-30", "Inactive User Firestore Write Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-31: Finance User Update Invoice in Another Project Prohibited
    // -------------------------------------------------------------
    try {
      await assertFails(updateDoc(doc(financeContext.firestore(), 'invoices', 'inv-beta-1'), {
        grandTotal: 99999999,
      }));
      recordResult("SEC-31", "Finance Cross-Project Invoice Update Prohibited", "DENIED", "DENIED", "Finance user ditolak mengubah invoice proyek lain");
    } catch (e: any) {
      recordResult("SEC-31", "Finance Cross-Project Invoice Update Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-32: Finance User Delete Invoice in Another Project Prohibited
    // -------------------------------------------------------------
    try {
      await assertFails(deleteDoc(doc(financeContext.firestore(), 'invoices', 'inv-beta-1')));
      recordResult("SEC-32", "Finance Cross-Project Invoice Delete Prohibited", "DENIED", "DENIED", "Finance user ditolak menghapus invoice proyek lain");
    } catch (e: any) {
      recordResult("SEC-32", "Finance Cross-Project Invoice Delete Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-33: Finance User Update Client Payment in Another Project Prohibited
    // -------------------------------------------------------------
    try {
      await assertFails(updateDoc(doc(financeContext.firestore(), 'clientPayments', 'cp-beta-1'), {
        amount: 88888888,
      }));
      recordResult("SEC-33", "Finance Cross-Project Client Payment Update Prohibited", "DENIED", "DENIED", "Finance user ditolak mengubah payment proyek lain");
    } catch (e: any) {
      recordResult("SEC-33", "Finance Cross-Project Client Payment Update Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-34: Finance User Delete Vendor Bill in Another Project Prohibited
    // -------------------------------------------------------------
    try {
      await assertFails(deleteDoc(doc(financeContext.firestore(), 'vendorBills', 'vb-beta-1')));
      recordResult("SEC-34", "Finance Cross-Project Vendor Bill Delete Prohibited", "DENIED", "DENIED", "Finance user ditolak menghapus vendor bill proyek lain");
    } catch (e: any) {
      recordResult("SEC-34", "Finance Cross-Project Vendor Bill Delete Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-35: Project Leader Update Drawing in Another Project Prohibited
    // -------------------------------------------------------------
    try {
      await assertFails(updateDoc(doc(plContext.firestore(), 'drawingItems', 'item-beta-1'), {
        title: 'PL Hacker Edit',
      }));
      recordResult("SEC-35", "Project Leader Cross-Project Drawing Update Prohibited", "DENIED", "DENIED", "Project Leader Alpha ditolak mengubah drawing Project Beta");
    } catch (e: any) {
      recordResult("SEC-35", "Project Leader Cross-Project Drawing Update Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-36: TEAM Delete Drawing in Another Project Prohibited
    // -------------------------------------------------------------
    try {
      await assertFails(deleteDoc(doc(teamContext.firestore(), 'drawingItems', 'item-beta-1')));
      recordResult("SEC-36", "Team Cross-Project Drawing Delete Prohibited", "DENIED", "DENIED", "Team Alpha ditolak menghapus drawing Project Beta");
    } catch (e: any) {
      recordResult("SEC-36", "Team Cross-Project Drawing Delete Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-37: Inactive OWNER Read Finance Prohibited
    // -------------------------------------------------------------
    try {
      await assertFails(getDoc(doc(inactiveOwnerContext.firestore(), 'invoices', 'inv-alpha-1')));
      recordResult("SEC-37", "Inactive OWNER Read Finance Prohibited", "DENIED", "DENIED", "Owner non-aktif ditolak membaca data keuangan");
    } catch (e: any) {
      recordResult("SEC-37", "Inactive OWNER Read Finance Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-38: Inactive OWNER Write Finance Prohibited
    // -------------------------------------------------------------
    try {
      await assertFails(setDoc(doc(inactiveOwnerContext.firestore(), 'invoices', 'inv-inact-owner'), {
        projectId: 'proj-alpha',
        invoiceNumber: 'INV-INACT-OWNER',
        grandTotal: 5000000,
      }));
      recordResult("SEC-38", "Inactive OWNER Write Finance Prohibited", "DENIED", "DENIED", "Owner non-aktif ditolak menulis data keuangan");
    } catch (e: any) {
      recordResult("SEC-38", "Inactive OWNER Write Finance Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-39: Inactive OWNER Read Storage Prohibited
    // -------------------------------------------------------------
    try {
      await assertFails(getBytes(ref(inactiveOwnerContext.storage(), 'projects/proj-alpha/drawings/test.pdf')));
      recordResult("SEC-39", "Inactive OWNER Read Storage Prohibited", "DENIED", "DENIED", "Owner non-aktif ditolak membaca Cloud Storage");
    } catch (e: any) {
      recordResult("SEC-39", "Inactive OWNER Read Storage Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-40: Inactive OWNER Write Storage Prohibited
    // -------------------------------------------------------------
    try {
      const dummyPdf = new Uint8Array([37, 80, 68, 70]);
      await assertFails(uploadBytes(ref(inactiveOwnerContext.storage(), 'projects/proj-alpha/drawings/inact-owner.pdf'), dummyPdf, { contentType: 'application/pdf' }));
      recordResult("SEC-40", "Inactive OWNER Write Storage Prohibited", "DENIED", "DENIED", "Owner non-aktif ditolak mengunggah berkas ke Cloud Storage");
    } catch (e: any) {
      recordResult("SEC-40", "Inactive OWNER Write Storage Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-STORAGE-01: Cross-Project Storage Read Prohibited
    // -------------------------------------------------------------
    try {
      await assertFails(getBytes(ref(teamContext.storage(), 'projects/proj-beta/drawings/secret.pdf')));
      recordResult("SEC-STORAGE-01", "Cross-Project Storage Read Prohibited", "DENIED", "DENIED", "Membaca file dari project yang tidak diizinkan berhasil ditolak");
    } catch (e: any) {
      recordResult("SEC-STORAGE-01", "Cross-Project Storage Read Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-STORAGE-02: Cross-Project Storage Write Prohibited
    // -------------------------------------------------------------
    try {
      const dummyPdf = new Uint8Array([37, 80, 68, 70]); // %PDF
      await assertFails(uploadBytes(ref(teamContext.storage(), 'projects/proj-beta/drawings/hack.pdf'), dummyPdf, { contentType: 'application/pdf' }));
      recordResult("SEC-STORAGE-02", "Cross-Project Storage Write Prohibited", "DENIED", "DENIED", "Mengunggah file ke project Beta oleh user Alpha ditolak");
    } catch (e: any) {
      recordResult("SEC-STORAGE-02", "Cross-Project Storage Write Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-STORAGE-03: Invalid MIME Type Prohibited
    // -------------------------------------------------------------
    try {
      const dummyExe = new Uint8Array([77, 90]); // MZ
      await assertFails(uploadBytes(ref(teamContext.storage(), 'projects/proj-alpha/drawings/malware.exe'), dummyExe, { contentType: 'application/x-msdownload' }));
      recordResult("SEC-STORAGE-03", "Invalid MIME Type Prohibited", "DENIED", "DENIED", "Mengunggah file dengan tipe MIME terlarang (exe/bin) ditolak");
    } catch (e: any) {
      recordResult("SEC-STORAGE-03", "Invalid MIME Type Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-STORAGE-04: Oversized Upload Prohibited
    // -------------------------------------------------------------
    try {
      const oversizedBuffer = new Uint8Array(11 * 1024 * 1024); // 11MB (> 10MB limit for avatar)
      await assertFails(uploadBytes(ref(teamContext.storage(), 'users/user-team/avatar/big.png'), oversizedBuffer, { contentType: 'image/png' }));
      recordResult("SEC-STORAGE-04", "Oversized File Upload Prohibited", "DENIED", "DENIED", "Mengunggah file melebihi batas ukuran (10MB avatar) ditolak");
    } catch (e: any) {
      recordResult("SEC-STORAGE-04", "Oversized File Upload Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-STORAGE-05: Inactive User Storage Prohibited
    // -------------------------------------------------------------
    try {
      const dummyPdf = new Uint8Array([37, 80, 68, 70]);
      await assertFails(uploadBytes(ref(inactiveContext.storage(), 'projects/proj-alpha/drawings/doc.pdf'), dummyPdf, { contentType: 'application/pdf' }));
      recordResult("SEC-STORAGE-05", "Inactive User Storage Access Prohibited", "DENIED", "DENIED", "Pengguna non-aktif ditolak mengakses Cloud Storage");
    } catch (e: any) {
      recordResult("SEC-STORAGE-05", "Inactive User Storage Access Prohibited", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

    // -------------------------------------------------------------
    // SEC-STORAGE-06: Unknown / Arbitrary Path Upload Prohibited
    // -------------------------------------------------------------
    try {
      const dummyTxt = new Uint8Array([1, 2, 3]);
      await assertFails(uploadBytes(ref(teamContext.storage(), 'unauthorized/random/test.txt'), dummyTxt, { contentType: 'text/plain' }));
      recordResult("SEC-STORAGE-06", "Unknown Root Path Storage Prohibited (Default Deny)", "DENIED", "DENIED", "Mengunggah ke path sembarang di luar whitelist ditolak");
    } catch (e: any) {
      recordResult("SEC-STORAGE-06", "Unknown Root Path Storage Prohibited (Default Deny)", "DENIED", "ALLOWED", `Gagal: ${e.message}`);
    }

  } finally {
    await testEnv.cleanup();
  }

  // Summary
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  console.log("--------------------------------------------------------------------------------");
  console.log(`TOTAL REAL EMULATOR TESTS: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log("--------------------------------------------------------------------------------");

  if (failedCount > 0) {
    console.error("❌ REAL FIREBASE SECURITY SUITE FAILED!");
    process.exit(1);
  } else {
    console.log("🎉 ALL REAL FIREBASE SECURITY RULES ATTACK TESTS PASSED (100% BLOCKED)!");
  }
}

runSecuritySuite().catch(err => {
  console.error("Fatal error in real emulator security suite:", err);
  process.exit(1);
});
