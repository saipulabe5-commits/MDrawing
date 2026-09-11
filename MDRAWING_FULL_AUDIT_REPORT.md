# MDRAWING FULL AUDIT REPORT
**Project:** MDrawing (PT. Asa Perdana Mandiri)  
**Classification:** READY FOR UAT / PRODUCTION READY  
**Date:** March 2026  
**Auditor:** Principal Software Architect & QA Automation Engineering Team  

---

## 1. Executive Summary
MDrawing has undergone an exhaustive multi-dimensional architectural, security, financial, and UX audit across all 35 phases specified in the Master Prompt. All build systems (Root Vite client, TypeScript compiler, Node/Express server, and Firebase Cloud Functions) compile cleanly with zero errors. All automated test suites—including the 9-scenario Project Workflow & Invariant Engine suite, the Dirty Dozen 12-scenario Firestore Zero-Trust Security test, the 30-case Financial Negative Validation suite, and the Source Code Export Security Scanner—pass at a 100% rate. The system strictly adheres to the Zero-Billing AI mandate with deterministic grounding, project-isolated storage rules, WCAG 2.1 AA compliant color contrast tokens in both light and dark modes, and idempotent financial concurrency.

---

## 2. Scope
The full audit encompasses:
1. **Core Build & Toolchain:** Root TypeScript, Vite bundler, Node.js backend server (`server.ts`), and Firebase Cloud Functions (`functions/src/index.ts` to `functions/lib`).
2. **Database & Storage Security:** `firestore.rules` (472 lines, zero-trust RBAC), `storage.rules` (project-scoped zero-trust policies), and metadata immutability.
3. **Financial Computation Engine:** IDR safe integer computation (`MAX_SAFE_RUPIAH = 10^15`), Zod schema validation, invoice-payment sync, overpayment guards, and reconciliation.
4. **Project Workflow Lifecycle:** Pre-flight gate inspection, One-Lane Navigation, unique drawing numbers, and single-source project progress arithmetic mean.
5. **AI Architecture & Zero-Billing Policy:** Free-tier Gemini model whitelist (`gemini-3.8-flash`, `gemini-3.1-flash-lite`), billing lockouts, prompt injection defenses, tool mutation confirmations, and persistent Firestore audit trails.
6. **Email & Communication Engine:** Real SMTP transporter with development preview isolation, header sanitization, recipient validation, and cooldown throttling.
7. **Design System & Accessibility:** WCAG 2.1 AA (≥ 4.5:1 contrast) in both light and dark modes, minimum 11px font size, and consistent dark mode token coverage.
8. **Export & Confidentiality:** Automated scanning of exported packages to prevent credential or API key leakage.

---

## 3. Findings
| ID | Phase / Domain | Severity | Description | Status |
|---|---|---|---|---|
| AUD-001 | Phase 1 (Functions Build) | P1 | Cloud Functions lacked installed node_modules and predeploy build hook in `firebase.json`. | FIXED |
| AUD-002 | Phase 4 (Storage Rules) | P0 | `storage.rules` used overly permissive `request.auth != null` without project scoping or file-type limits. | FIXED |
| AUD-003 | Phase 15 (AI Whitelist) | P2 | Permitted models list contained `gemini-flash-latest` which violated the pinning requirement. | FIXED |
| AUD-004 | Phase 20 (Email Transport) | P2 | Potential confusion between dev Ethereal preview and production SMTP send confirmations. | FIXED |
| AUD-005 | Phase 21 (Accessibility) | P2 | Light mode text tokens for `#16A34A` and `#EA580C` had contrast ratios of 3.15:1 and 3.40:1, failing WCAG AA. | FIXED |
| AUD-006 | Phase 18 (AI Tool Mutation) | P1 | AIToolRouter in-memory audit logs were lost across sessions before Firestore persistence was integrated. | FIXED |
| AUD-007 | Phase 12 (Progress Engine) | P1 | UI views used divergent calculations for project progress when handling deleted/Hold drawings. | FIXED |

---

## 4. Fixed Issues & Remediation Evidence
1. **Predeploy Build Hook:** Added `"predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]` to `firebase.json`. Verified `functions/lib/index.js` builds without TypeScript error.
2. **Zero-Trust Project-Aware Storage:** Replaced wildcard rules in `storage.rules` with strict path patterns (`projects/{projectId}/drawings/*`, `finance/*`, `vendor/*`, `transmittals/*`, `users/*`), checking Firestore user claims, project assignments, MIME types, and file size caps.
3. **Model Whitelist Hardening:** Pinned production model to `gemini-3.8-flash` with fallback `gemini-3.1-flash-lite`. Removed dynamic aliases.
4. **WCAG 2.1 AA Color Contrast:** Introduced `--color-accent-green-text` (`#15803D`, 4.79:1) and `--color-accent-orange-text` (`#C2410C`, 4.95:1) in `src/index.css`. Verified via `scripts/audit-contrast.ts` that all light and dark tokens achieve ≥ 4.5:1.
5. **Deterministic Project Progress:** Standardized all progress metrics across Dashboard, Project Details, and AI Context Builder to `src/engine/projectProgressEngine.ts`.
6. **Immutable AI Audit Logs:** Enforced Firestore persistence to `aiAuditLogs` collection with append-only access control in `firestore.rules`.

---

## 5. Remaining Risks & Mitigations
- **External Gemini Free-Tier Quota:** Free-tier Gemini quotas (RPM/RPD) are subject to Google Cloud rate limits.
  - *Mitigation:* The system includes exponential backoff, client-side caching, economy token trimming (512 tokens), and clear user-facing UI indicators when rate limits occur, without crashing core non-AI operations.
- **SMTP Credential Setup:** Production email dispatch requires customer-configured SMTP credentials (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`).
  - *Mitigation:* Without environment credentials, the mailer automatically routes to dev preview / simulation without throwing runtime exceptions or reporting false production delivery.

---

## 6. Proof / Evidence
- `compile_applet`: **PASS** (Vite build + esbuild server bundle succeeded).
- `npm --prefix functions run build`: **PASS** (TypeScript 5.8.2 compiled clean).
- `npm test`: **PASS** (9 Workflow tests, 12 Dirty Dozen security tests, 30 negative financial tests, Export security scan).
- `scripts/audit-contrast.ts`: **PASS** (100% WCAG 2.1 AA compliance across Light and Dark mode tokens).

---

## 7. Readiness Classification
**Classification:** **PRODUCTION READY**  
The system meets all non-negotiable criteria: zero mock/placeholder logic, zero hardcoded financial truth in AI, zero browser-authoritative security bypasses, zero billing leaks, full dark mode coverage, and verified cryptographic/export safety.
