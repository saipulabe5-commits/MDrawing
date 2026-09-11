# MDRAWING AI ACCURACY & ZERO-BILLING REPORT
**Project:** MDrawing (PT. Asa Perdana Mandiri)  
**Classification:** PRODUCTION READY (ZERO-BILLING COMPLIANT & FACTUALLY GROUNDED)  
**Date:** March 2026  
**Auditor:** AI Systems Architect & Security Engineer  

---

## 1. Executive Summary
The MDrawing AI subsystem operates under an uncompromising Zero-Billing mandate. AI is strictly deployed as an assistive analysis and drafting tool—never as a source of financial truth or an autonomous authority. Gemini API calls are mediated server-side (`server.ts`) using pinned free-tier models (`gemini-3.8-flash` primary, `gemini-3.1-flash-lite` fallback). All financial metrics, project progress percentages, and drawing status counts are computed by deterministic TypeScript engines before being injected into the AI context. When the external Gemini API quota is exhausted, the application gracefully reports a temporary rate limit without impairing any core operational workflows.

---

## 2. Scope
1. **Zero-Billing Policy Enforcement:**
   - Centralized configuration in `src/ai/AIConfig.ts` with `ALLOW_PAID_AI: false`, `MAX_AI_COST: 0`, and `MAX_AI_BUDGET: 0`.
   - Rejection in `server.ts` of any model containing prohibited strings ("pro", "image", "veo", "lyria"), returning HTTP 403 `BILLING_BLOCKED`.
2. **Deterministic Context Grounding (`AIContextBuilder.ts`):**
   - Project progress is calculated using `calculateProjectProgress()` (`src/engine/projectProgressEngine.ts`), not by LLM arithmetic.
   - Financial summaries are calculated using `calculateComprehensiveFinancialReport()` (`src/engine/financial/financialEngine.ts`).
   - If a user lacks `canViewFinance`, financial context is completely omitted from the prompt.
3. **Prompt Injection & Adversarial Defense (`AIPolicyGuard.ts`):**
   - Untrusted user input (such as drawing revision notes or client messages) is sanitized and enclosed in delimiter tags:
     `<<<CATATAN_PENGGUNA_TIDAK_TERPERCAYA>>>`
   - System instructions explicitly direct the model to ignore instructions enclosed within these tags.
4. **Tool Mutation Safety & Fail-Closed Logic (`AIToolRouter.ts`):**
   - AI cannot execute state mutations silently. Every suggested action requires explicit user confirmation in the UI.
   - If a mutation handler is missing, `AIToolRouter` returns `success: false` (fail-closed), never false positive `success: true`.
   - Every execution is recorded in the Firestore `aiAuditLogs` collection.
5. **Quota & Rate Limit Management (`AIQuotaManager.ts`):**
   - Daily request caps (200 requests/day client-side tracking, session limit 40 requests).
   - Dynamic token trimming in Economy Mode (512 tokens max output vs 1024 standard).

---

## 3. Findings
| ID | Area | Finding | Resolution | Status |
|---|---|---|---|---|
| AI-001 | Billing Policy | Dynamic model alias `gemini-flash-latest` present in config | Removed alias; strictly pinned to `gemini-3.8-flash` | RESOLVED |
| AI-002 | Mutation | Potential for `success: true` if mutation handler was undefined | Refactored `AIToolRouter` to fail closed (`success: false`) | RESOLVED |
| AI-003 | Persistence | Audit records were stored in memory and lost on refresh | Added Firestore collection `/aiAuditLogs` persistence | RESOLVED |
| AI-004 | Security | Financial metrics could leak to team members via AI prompt | Filtered context builder by user role and `canViewFinance` capability | RESOLVED |
| AI-005 | Quota Handling | Upstream 429 quota exhaustion threw generic 500 error | Implemented explicit 429 `RESOURCE_EXHAUSTED` handler with friendly Indonesian UI feedback | RESOLVED |

---

## 4. Fixed Issues & Remediation Evidence
- **Strict Server Whitelist:** In `server.ts`, `permittedModels` is locked to `["gemini-3.8-flash", "gemini-3.1-flash-lite"]`.
- **Delimited Untrusted Context:** `AIContextBuilder.ts` now wraps notes with `<<<CATATAN_PENGGUNA_TIDAK_TERPERCAYA>>>` and appends strict policy guards.
- **Fail-Closed Tool Execution:**
  ```typescript
  // AIToolRouter.ts
  if (!handler) {
    return {
      success: false,
      message: "Permintaan perubahan gagal: Fungsi handler tidak tersedia di context saat ini."
    };
  }
  ```
- **Firestore Audit Rule:** Added `allow create: if isSignedIn() && isPrincipalActive() && incoming().actorUid == request.auth.uid; allow update, delete: if false;` to `firestore.rules`.

---

## 5. Remaining Risks & Mitigations
- **Upstream Gemini Free-Tier Rate Limits:** Google limits free-tier calls per minute and per day.
  - *Mitigation:* The system notifies the user when quota is exhausted. MDrawing functions 100% autonomously without AI; no drawing registration, transmittal generation, quotation drafting, or invoice payment depends on AI availability.

---

## 6. Proof / Evidence
- Tested model rejection: Requesting `gemini-1.5-pro` returns status 403 `BILLING_BLOCKED`.
- Tested capability filtering: Users with `role: "TEAM"` receive AI context containing 0 financial figures.
- Tested tool mutation: Invariant tests confirm no state changes occur in Firestore until the user confirms the modal dialogue.
- Build verification: `src/ai/*` compiles with 0 TypeScript errors.

---

## 7. Readiness Classification
**Classification:** **PRODUCTION READY**  
AI architecture is completely zero-billing compliant, factually grounded in deterministic engines, and secure against prompt injection.
