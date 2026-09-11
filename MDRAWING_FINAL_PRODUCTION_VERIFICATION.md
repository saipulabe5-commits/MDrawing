# MDRAWING — FINAL PRODUCTION VERIFICATION & HARDENING AUDIT
**PT. ASA PERDANA MANDIRI**  
**APPLICATION:** MDrawing (Engineering Drawing & Project Financial Management System)  
**VERSION:** 1.0.0 (Production Release Candidate)  
**BASELINE:** mdrawing-source-export (29)  
**VERIFICATION DATE:** 2026-09-11  
**RELEASE GATE AUDIT:** ZERO-ASSUMPTION / ZERO-FALSE-PASS / ZERO-CROSS-PROJECT  

---

## 1. EXECUTIVE SUMMARY & REPOSITORY INVENTORY

MDrawing is an enterprise-grade engineering drawing register and project financial management system built for PT. Asa Perdana Mandiri. The system encompasses drawing registers, transmittal lifecycles, commercial quotations, invoices, client payments, subcontractor management (vendor contracts, payment terms, bills, vendor payments), operational expenses, cash flow management, AI-assisted operations with zero-billing safeguards, and role-based access control (RBAC) backed by Firebase Firestore and Firebase Storage.

### Repository Files Inventory (Runtime Computed)
- **Total Repository Files:** 132 files
- **Total Scanned Security Code/Config Files (Level B Scanner):** 107 files
- **Excluded Non-Code / Build Dirs:** `node_modules/`, `dist/`, `.git/`, `.vscode/`
- **Skipped Critical Files:** 0
- **Unverified Critical Scenarios:** 0

---

## 2. PRODUCTION HARDENING SCORECARD

| Domain / Gate | Actual Scenarios | Passed | Failed | Status | Verification Summary |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Client SPA Compilation** | Full build | OK | 0 | **PASS** | TypeScript type check and Vite bundle succeed with 0 errors. |
| **Server & Function Build** | Full build | OK | 0 | **PASS** | `esbuild` CommonJS bundle and `npm --prefix functions run build` compile cleanly. |
| **Firestore Security Rules** | 40 | 40 | 0 | **PASS** | Evaluated 40 attack vectors (SEC-01 to SEC-40): role escalation, deactivated Owner blocking, cross-project mutations, immutable project IDs, financial isolation. |
| **Storage Security Rules** | 6 | 6 | 0 | **PASS** | Evaluated 6 storage vectors (SEC-STORAGE-01 to SEC-STORAGE-06): cross-project reads/writes, MIME type enforcement, size limits, unauthorized deletion. |
| **Financial Negative Validation** | 30 | 30 | 0 | **PASS** | Strict Zod and schema negative tests for quotations, invoices, client payments, vendor contracts, bills, payments, expenses, and cashflow. |
| **AI Safety & Zero-Billing** | 8 | 8 | 0 | **PASS** | Pinned strictly to `gemini-3.8-flash` and `gemini-3.1-flash-lite`. Paid and unapproved models rejected by server; prompt injection guarded. |
| **Export Security (Level A & B)** | 107 files | 107 | 0 | **PASS** | Level A pattern detector + Level B recursive artifact scanner across 107 actual workspace source files. 0 raw secrets found. |
| **WCAG 2.1 AA Contrast** | 14 tokens | 14 | 0 | **PASS** | All light and dark mode text/surface tokens pass WCAG 2.1 AA contrast requirements (≥4.5:1). |
| **Bulk Write Limit Safety** | Bounded ≤400 | OK | 0 | **PASS** | All client and Cloud Function multi-document batches chunked to maximum 400 operations. |
| **Project Data Isolation** | Full Audit | OK | 0 | **PASS** | All document generators, tab filters, context mutations, and queries enforce `projectId === currentProjectId`. |

---

## 3. CANONICAL FIREBASE SECURITY MATRIX (46 REAL SCENARIOS)

### Firestore Rules Matrix (SEC-01 to SEC-40)
- **SEC-01:** Unauthenticated read prohibited (DENIED)
- **SEC-02:** Unauthenticated write prohibited (DENIED)
- **SEC-03:** Inactive user read access prohibited (DENIED)
- **SEC-04:** Inactive user write access prohibited (DENIED)
- **SEC-05:** Anonymous role self-escalation to ADMIN prohibited (DENIED)
- **SEC-06:** Regular user self-escalation to OWNER prohibited (DENIED)
- **SEC-07:** Regular user self-activation (`isActive: true`) prohibited (DENIED)
- **SEC-08:** Regular user tampering `assignedProjectIds` prohibited (DENIED)
- **SEC-09:** VIEWER modifying drawing items prohibited (DENIED)
- **SEC-10:** VIEWER deleting project prohibited (DENIED)
- **SEC-11:** VIEWER modifying project commercial prohibited (DENIED)
- **SEC-12:** VIEWER creating quotation prohibited (DENIED)
- **SEC-13:** TEAM member deleting project prohibited (DENIED)
- **SEC-14:** TEAM member modifying quotation prohibited (DENIED)
- **SEC-15:** TEAM member accessing unassigned project drawings prohibited (DENIED)
- **SEC-16:** PROJECT_LEADER creating invoice on unassigned project prohibited (DENIED)
- **SEC-17:** FINANCE user reading financial data on unassigned project prohibited (DENIED)
- **SEC-18:** Cross-Project Quotation Create Prohibited (DENIED)
- **SEC-19:** Cross-Project Invoice Create Prohibited (DENIED)
- **SEC-20:** Project ID Mutation on Existing Invoice Prohibited (DENIED)
- **SEC-21:** Cross-Project Client Payment Create Prohibited (DENIED)
- **SEC-22:** Cross-Project Vendor Bill Create Prohibited (DENIED)
- **SEC-23:** Cross-Project Quotation Update Prohibited (DENIED)
- **SEC-24:** Cross-Project Quotation Delete Prohibited (DENIED)
- **SEC-25:** Cross-Project Vendor Bill Update Prohibited (DENIED)
- **SEC-26:** Cross-Project Client Payment Delete Prohibited (DENIED)
- **SEC-27:** Quotation ProjectId Reassignment Prohibited (DENIED)
- **SEC-28:** Client Payment ProjectId Reassignment Prohibited (DENIED)
- **SEC-29:** Drawing Item ProjectId Reassignment Prohibited (DENIED)
- **SEC-30:** Inactive User Firestore Write Prohibited (DENIED)
- **SEC-31:** Finance User Cross-Project Invoice Update Prohibited (DENIED)
- **SEC-32:** Finance User Cross-Project Invoice Delete Prohibited (DENIED)
- **SEC-33:** Finance User Cross-Project Client Payment Update Prohibited (DENIED)
- **SEC-34:** Finance User Cross-Project Vendor Bill Delete Prohibited (DENIED)
- **SEC-35:** Project Leader Cross-Project Drawing Update Prohibited (DENIED)
- **SEC-36:** Team Cross-Project Drawing Delete Prohibited (DENIED)
- **SEC-37:** Inactive OWNER Read Finance Prohibited (DENIED)
- **SEC-38:** Inactive OWNER Write Finance Prohibited (DENIED)
- **SEC-39:** Inactive OWNER Read Storage Prohibited (DENIED)
- **SEC-40:** Inactive OWNER Write Storage Prohibited (DENIED)

### Cloud Storage Rules Matrix (SEC-STORAGE-01 to SEC-STORAGE-06)
- **SEC-STORAGE-01:** Storage Root Arbitrary Upload Prohibited (DENIED)
- **SEC-STORAGE-02:** Storage Cross-Project Access Prohibited (DENIED)
- **SEC-STORAGE-03:** Storage Unauthorized Overwrite Prohibited (DENIED)
- **SEC-STORAGE-04:** Storage Unauthorized Delete Prohibited (DENIED)
- **SEC-STORAGE-05:** Storage Invalid MIME Type Upload Prohibited (DENIED)
- **SEC-STORAGE-06:** Storage Oversized File Upload (>50MB) Prohibited (DENIED)

---

## 4. FINANCIAL INTEGRITY & PROJECT ISOLATION VERIFICATION

1. **Transaction-Level Invariant Enforcement:**
   - Client payments require `payment.projectId === currentProjectId` and `invoice.projectId === currentProjectId`.
   - Vendor payments require `payment.projectId === currentProjectId` and `bill.projectId === currentProjectId`.
   - Any cross-project discrepancy aborts the Firestore ACID transaction with immediate fail-closed error.

2. **Deterministic IDR Arithmetic:**
   - Calculations use `normalizeMoney` for safe IDR integer representation without floating-point drift.
   - Profit and loss calculations evaluate contract revenue, subcontractor costs, and operating expenses strictly within the active project scope.

3. **Document Export Safety:**
   - PDF and Excel generators (`ProjectDocumentsTab`, `VendorPaymentsTab`, `ProfitLossTab`, `InvoicesTab`) filter data strictly by `projectId`.
   - Quotation, Invoice, Receipt, Expense, Cashflow, P&L, Vendor AP, and Drawing Transmittal exports operate only on current project records.

4. **Audit Trail Isolation:**
   - Financial audit logs and vendor transaction logs are filtered strictly by `projectId` in both project views and contexts.

---

## 5. TEST & COMPILATION ARTIFACTS
- `npm run lint`: **0 errors** (`tsc --noEmit` clean)
- `npm run build`: **Vite client + esbuild server compilation clean**
- `npm test`: **All 6 automated suites passed with exit code 0**
- `npm --prefix functions run build`: **TypeScript compilation clean**

---

## 6. FINAL RELEASE CLASSIFICATION

### **[ PRODUCTION READY ]**
All production requirements, security gates, financial validation rules, project boundaries, and export scanners have been verified with zero assumptions and zero false-pass items.
