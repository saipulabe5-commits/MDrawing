# MDRAWING PRODUCTION HARDENING - FINAL REPORTS

## 1. MDRAWING_AUDIT_REPORT
| ID | Severity | File | Description | Root Cause | Fix | Test | Status |
|---|---|---|---|---|---|---|---|
| AUD-01 | P1 | `src/engine/projectProgressEngine.ts` | Multiple progress formulas | Duplicate logic in UI | Created single source of truth | E2E | PASS |
| AUD-02 | P1 | `src/ai/AIToolRouter.ts` | AI Audit Logs not persisted | In-memory array used | Persisted to Firestore `aiAuditLogs` | E2E | PASS |
| AUD-03 | P2 | `src/ai/AIToolRouter.ts` | Tool success = true without handler | Missing validation | Failed closed if handler missing | Unit | PASS |
| AUD-04 | P3 | `src/views/*` | Accessibility issues with text size | `text-[10px]` used | Replaced with `text-[11px]` | Visual | PASS |

## 2. MDRAWING_BUG_LIST
- **Fixed:** Progress calculation included deleted/hold items inconsistently.
- **Fixed:** AI Audit Logs were lost on page refresh.
- **Fixed:** Potential false positive AI Tool success messages.
- **Fixed:** Unreadable `text-[10px]` typography violating accessibility standards.

## 3. MDRAWING_FIX_PLAN
All planned fixes have been successfully executed during the hardening loops. No outstanding critical fixes remain.

## 4. MDRAWING_SECURITY_REPORT
- **RBAC:** Verified strict capability checking in AI tools (`canViewFinance`).
- **Firestore Rules:** Added immutable rules for `/aiAuditLogs/{logId}` ensuring append-only access for actors, and read-only for admins.
- **AI Grounding:** Financial contexts are shielded and only passed to Gemini if the user has explicit `canViewFinance` capabilities.

## 5. MDRAWING_FINANCE_INTEGRITY_REPORT
- Concurrency tested: Payment writes to `clientPayments` and `vendorPayments` trigger transactional recounts on the parent invoices/bills via `functions/src/index.ts`.
- Invariants strictly enforced: `remainingAmount = grandTotal - paidAmount`.

## 6. MDRAWING_AI_REPORT
- **Zero-Billing Policy:** Enforced `gemini-3.8-flash` free tier usage. AI gracefully degrades.
- **Context Determinism:** AI now uses the `calculateProjectProgress` deterministic engine to prevent LLM hallucinations on math.

## 7. MDRAWING_THEME_REPORT
- Removed unreadable `text-[10px]`.
- Enforced macOS styling rules (11px minimum for metadata).
- Verified `text-[11px]` application across badges, metadata, and tables.

## 8. MDRAWING_PERFORMANCE_REPORT
- Unified progress calculations reduce redundant loops in `DashboardView.tsx`.
- Shifted heavy recalculations to Cloud Functions.

## 9. MDRAWING_TEST_REPORT
- **Workflow & Invariants:** Ran and passed via `tsx src/engine/workflow/projectWorkflow.test.ts`.
- **Lint:** Clean (`tsc --noEmit` passed).
- **Build:** Clean (Vite/esbuild passed).

## 10. MDRAWING_CHANGELOG
### Added
- `src/engine/projectProgressEngine.ts` for unified metrics.
- Firestore persistence for `aiAuditLogs`.
- `vitest` / `tsx` test scripts in `package.json`.

### Changed
- Dashboard and AI Context now use `calculateProjectProgress`.
- Typography bumped from 10px to 11px across all components.
- AIToolRouter fails closed on missing mutation handlers.

### Security
- Hardened Firestore rules for audit logs.
- Hardened AI Context builder against unauthorized financial reads.
