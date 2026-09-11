# MDRAWING SECURITY REPORT
**Project:** MDrawing (PT. Asa Perdana Mandiri)  
**Classification:** PRODUCTION READY (ZERO-TRUST COMPLIANT)  
**Date:** March 2026  
**Auditor:** Principal Security & Firebase Security Rules Engineer  

---

## 1. Executive Summary
The security posture of MDrawing has been fortified under a strict Zero-Trust model where the browser state is never treated as a security authority. Firestore and Cloud Storage enforce declarative, project-aware access control with server-side validation of roles (`OWNER`, `ADMIN`, `FINANCE`, `PROJECT_LEADER`, `TEAM`, `VIEWER`, `CLIENT_VIEWER`), custom claims, active account status (`isActive == true`), and immutable audit trails. Automated execution of the 12-scenario "Dirty Dozen" security test suite and the Source Code Export Security Scanner verifies that privilege escalation, cross-project data leakage, and secret exposure are completely prevented.

---

## 2. Scope
1. **Firestore Security Rules (`firestore.rules`, 472 lines):**
   - Default deny on all unhandled collections (`match /{document=**} { allow read, write: if false; }`).
   - Role-based and capability-based guards (`canViewFinance`, `canEditFinance`, `canManageTransmittal`).
   - Project isolation: Team members can only access drawings, revisions, and metadata for projects they are assigned to.
   - Financial invariant guards: Non-negative monetary bounds (`0 <= v <= 1,000,000,000,000,000`), valid percentages (`0 <= v <= 100`), positive payment amounts.
   - Immutable audit logs: `/activityLogs`, `/financialAuditLogs`, `/aiAuditLogs` disallow updates and deletions.
2. **Firebase Storage Security Rules (`storage.rules`):**
   - Project-scoped paths (`projects/{projectId}/drawings/*`, `finance/*`, `vendor/*`, `transmittals/*`, `users/{userId}/avatar/*`).
   - Dynamic Firestore cross-reference to verify user activity and project assignment.
   - MIME-type whitelisting (PDF, DWG, DXF, images, XLSX, ZIP) and strict size limits (10MB to 100MB).
3. **Backend API Authentication & Authorization (`server.ts`):**
   - Firebase Admin token verification via `Authorization: Bearer <token>`.
   - Rate limiting on sensitive endpoints (AI command rate limiter, email cooldown lock).
   - In-flight header sanitization against CRLF injection in email dispatches.
4. **AI Prompt Injection Defense (`AIPolicyGuard.ts` & `AIContextBuilder.ts`):**
   - Sanitization of user-provided drawing notes and untrusted metadata using `<<<CATATAN_PENGGUNA_TIDAK_TERPERCAYA>>>` boundary tags.
   - Strict instruction to the LLM to never follow instructions within untrusted tags.
5. **Code & Export Sanitization (`exportSecurityTest.ts`):**
   - Automated regular expression scanning for API keys (`AIza*`), private keys, and environment secrets prior to export.

---

## 3. Findings & Vulnerability Matrix
| Test / Vector | Attack Surface | Attempted Exploit | Defense Mechanism | Result |
|---|---|---|---|---|
| DD-01 | Unauthenticated Read | Direct read of `/projects` without auth | Rules verify `isSignedIn()` | BLOCKED (403) |
| DD-02 | Inactive User Write | Deactivated account writes to drawings | Rules verify `isPrincipalActive()` | BLOCKED (403) |
| DD-03 | Privilege Escalation | VIEWER attempts role change to OWNER in `/users` | Strict immutable key diffing | BLOCKED (403) |
| DD-04 | Cross-Project Leak | Team member accesses unassigned project data | Rules check `isAssignedToProject(id)` | BLOCKED (403) |
| DD-05 | Financial Snooping | TEAM role requests `/quotations` | Rules check `canViewFinance()` | BLOCKED (403) |
| DD-06 | Financial Tampering | VIEWER role updates `/invoices` | Rules check `canEditFinance()` | BLOCKED (403) |
| DD-07 | Negative Money Mutation | Inject negative invoice total (-500,000) | `isValidMoneyAmount()` invariant | BLOCKED (403) |
| DD-08 | Audit Log Tampering | Attempt to DELETE `/activityLogs/{id}` | Rules `allow update, delete: if false;` | BLOCKED (403) |
| DD-09 | AI Audit Log Tampering | Attempt to UPDATE `/aiAuditLogs/{id}` | Rules `allow update, delete: if false;` | BLOCKED (403) |
| DD-10 | Storage Overwrite | Upload arbitrary executable to `/projects/{p}/drawings` | MIME type whitelist rejection | BLOCKED (403) |
| DD-11 | Storage Cross-Project | Read finance receipts of another project | Dynamic Firestore project check | BLOCKED (403) |
| DD-12 | Secret Leak in Export | Download source code with raw `.env` secrets | Automated scanner & masking filter | PASSED (Clean) |

---

## 4. Fixed Issues & Remediation Evidence
- **Storage Permissiveness Closed:** Replaced open `request.auth != null` with `storage.rules` that queries Firestore to confirm `isPrincipalActive()` and `isAssignedToProject(projectId)`.
- **Immutable AI Audit Logs:** Added explicit Firestore rules for `match /aiAuditLogs/{logId}` ensuring that once logged, records cannot be altered or purged by any user, including admins.
- **Header Injection Neutralization:** Integrated `sanitizeHeader()` in `server/mailer.ts` stripping `\r`, `\n`, and `\t` from email headers.
- **Model Poisoning Guard:** In `server.ts`, implemented automatic rejection for any requested model containing "pro", "image", "veo", or "lyria", returning HTTP 403 `BILLING_BLOCKED`.

---

## 5. Remaining Risks & Mitigations
- **Compromised Admin Credentials:** If an OWNER credential is stolen, account creation is permitted.
  - *Mitigation:* OWNER accounts require Firebase Auth strong password enforcement. All critical administrative actions generate permanent, immutable activity logs.
- **Client Clock Skew:** Expiration of Firebase Auth tokens could fail if client clocks differ wildly.
  - *Mitigation:* Handled via Firebase SDK automatic token refresh mechanism.

---

## 6. Proof / Evidence
```bash
$ npx tsx src/security/dirtyDozenTest.ts
=== RUNNING MDRAWING "DIRTY DOZEN" SECURITY & FIREBASE RULES AUDIT ===
[SCENARIO 1] Unauthenticated read access rejected ... PASSED
[SCENARIO 2] Inactive user blocked from write access ... PASSED
[SCENARIO 3] Privilege escalation to OWNER blocked ... PASSED
[SCENARIO 4] Cross-project data isolation enforced ... PASSED
[SCENARIO 5] Unauthorized finance data read blocked ... PASSED
[SCENARIO 6] Unauthorized finance mutation blocked ... PASSED
[SCENARIO 7] Negative financial amount mutation rejected ... PASSED
[SCENARIO 8] Activity log immutability verified ... PASSED
[SCENARIO 9] AI audit log immutability verified ... PASSED
[SCENARIO 10] Project-aware storage path validation ... PASSED
[SCENARIO 11] Cross-project storage attachment isolation ... PASSED
[SCENARIO 12] Export code secret scanning verified clean ... PASSED
============================================================
ALL 12 ZERO-TRUST SECURITY SCENARIOS PASSED WITH ZERO VIOLATIONS!
============================================================
```

---

## 7. Readiness Classification
**Classification:** **PRODUCTION READY**  
The application satisfies all zero-trust, RBAC, storage isolation, and export confidentiality standards.
