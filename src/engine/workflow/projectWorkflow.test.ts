/**
 * Test Suite for MDrawing Project Workflow Engine & Invariants
 * Run directly via `npx tsx src/engine/workflow/projectWorkflow.test.ts`
 */

import { 
  validateWorkflowStage, 
  evaluatePreFlightInspection, 
  canNavigateToStage,
  isValidProjectCodeFormat,
  CANONICAL_WORKFLOW_STAGES,
  WIZARD_ORDERED_STAGES
} from "./projectWorkflow";
import { 
  calculateQuotationTotals, 
  assertSafeMoney, 
  normalizeMoney,
  addMoney,
  subtractMoney
} from "../financial/financialEngine";
import { Project, DrawingItem, FinanceTerm } from "../../types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${message}`);
  }
}

console.log("=== RUNNING MDRAWING PROJECT WORKFLOW & INVARIANT TESTS ===");

// TEST 1: Project Code Validation
console.log("\n[TEST 1] Project Code Validation...");
assert(isValidProjectCodeFormat("PRJ-2026-001"), "PRJ-2026-001 should be valid");
assert(isValidProjectCodeFormat("APM-ARC-01"), "APM-ARC-01 should be valid");
assert(!isValidProjectCodeFormat("invalid"), "invalid (no delimiter) should be invalid");
assert(!isValidProjectCodeFormat(""), "empty string should be invalid");
assert(!isValidProjectCodeFormat("A"), "single char should be invalid");
console.log("✓ Project Code Validation PASSED");

// TEST 2: Stage 1 Project Setup Validation
console.log("\n[TEST 2] Project Setup Stage Validation...");
{
  const invalidContext = {
    project: {
      projectName: "",
      projectCode: "bad",
      projectType: "",
      location: ""
    }
  };
  const res = validateWorkflowStage("PROJECT_SETUP", invalidContext);
  assert(!res.valid, "Stage 1 must fail on empty inputs");
  assert(res.errors.length >= 4, "Must catch missing name, code format, type, location");

  const duplicateContext = {
    project: {
      projectName: "Gedung Kantor APM",
      projectCode: "PRJ-2026-001",
      projectType: "Arsitektur",
      location: "Jakarta Selatan"
    },
    allProjectCodes: ["PRJ-2026-001", "PRJ-2026-002"]
  };
  const dupRes = validateWorkflowStage("PROJECT_SETUP", duplicateContext);
  assert(!dupRes.valid, "Stage 1 must catch duplicate project code");
  assert(dupRes.errors.some(e => e.includes("sudah terdaftar")), "Error message mentions duplicate code");

  const validContext = {
    project: {
      projectName: "Gedung Kantor APM",
      projectCode: "PRJ-2026-003",
      projectType: "Arsitektur",
      location: "Jakarta Selatan"
    },
    allProjectCodes: ["PRJ-2026-001", "PRJ-2026-002"]
  };
  const validRes = validateWorkflowStage("PROJECT_SETUP", validContext);
  assert(validRes.valid, "Valid inputs must pass Stage 1");
}
console.log("✓ Project Setup Stage Validation PASSED");

// TEST 3: Timeline & Commercial Baseline Validation
console.log("\n[TEST 3] Timeline & Commercial Baseline Validation...");
{
  const invalidDateContext = {
    project: {
      startDate: "2026-10-01",
      targetDate: "2026-09-01", // earlier than start date
      contractValue: -50000,
      budgetOtherExpenses: -10000
    }
  };
  const res = validateWorkflowStage("TIMELINE_COMMERCIAL", invalidDateContext);
  assert(!res.valid, "Target date < start date must be rejected");
  assert(res.errors.some(e => e.includes("mendahului")), "Must catch date order");
  assert(res.errors.some(e => e.includes("positif")), "Must catch negative contract value");

  const validDateContext = {
    project: {
      startDate: "2026-09-01",
      targetDate: "2026-12-31",
      contractValue: 500_000_000,
      budgetOtherExpenses: 50_000_000 // exactly 10%
    }
  };
  const validRes = validateWorkflowStage("TIMELINE_COMMERCIAL", validDateContext);
  assert(validRes.valid, "Valid timeline & baseline with 10% budget must pass");

  const exceededBudgetContext = {
    project: {
      startDate: "2026-09-01",
      targetDate: "2026-12-31",
      contractValue: 500_000_000,
      budgetOtherExpenses: 60_000_000 // 12% (> 10%)
    }
  };
  const exceededRes = validateWorkflowStage("TIMELINE_COMMERCIAL", exceededBudgetContext);
  assert(!exceededRes.valid, "Budget exceeding 10% must be rejected");
  assert(exceededRes.errors.some(e => e.includes("maksimal 10%")), "Error mentions max 10%");
}
console.log("✓ Timeline & Commercial Baseline Validation PASSED");

// TEST 4: Team Setup Mandatory Project Leader Validation
console.log("\n[TEST 4] Team Setup Mandatory Project Leader Validation...");
{
  const noLeaderContext = {
    project: {
      members: ["user-1", "user-2"]
    }
  };
  const res = validateWorkflowStage("TEAM_SETUP", noLeaderContext);
  assert(!res.valid, "Team setup without project leader must fail");
  assert(res.errors.some(e => e.includes("Project Leader wajib")), "Must catch missing project leader");

  const withLeaderContext = {
    project: {
      members: ["user-1", "user-2"],
      projectLeaderId: "user-1",
      projectLeaderName: "Budi Santoso"
    } as any
  };
  const validRes = validateWorkflowStage("TEAM_SETUP", withLeaderContext);
  assert(validRes.valid, "Team setup with project leader must pass");
}
console.log("✓ Team Setup Mandatory Project Leader Validation PASSED");

// TEST 5: Drawing Register Duplicate Number Prevention
console.log("\n[TEST 5] Drawing Register Duplicate Number Prevention...");
{
  const duplicateDrawingsContext = {
    project: {},
    drawingItems: [
      { id: "1", drawingNumber: "AR-001", drawingName: "Denah Lantai 1" } as DrawingItem,
      { id: "2", drawingNumber: "ar-001", drawingName: "Denah Lantai 2" } as DrawingItem, // duplicate case-insensitive
    ]
  };
  const res = validateWorkflowStage("DRAWING_REGISTER", duplicateDrawingsContext);
  assert(!res.valid, "Duplicate drawing number must be rejected");
  assert(res.errors.some(e => e.includes("Nomor gambar ganda")), "Error message mentions duplicate");

  const uniqueDrawingsContext = {
    project: {},
    drawingItems: [
      { id: "1", drawingNumber: "AR-001", drawingName: "Denah Lantai 1" } as DrawingItem,
      { id: "2", drawingNumber: "AR-002", drawingName: "Denah Lantai 2" } as DrawingItem,
    ]
  };
  const validRes = validateWorkflowStage("DRAWING_REGISTER", uniqueDrawingsContext);
  assert(validRes.valid, "Unique drawing numbers must pass");
}
console.log("✓ Drawing Register Duplicate Number Prevention PASSED");

// TEST 6: Payment Terms 100% Invariant
console.log("\n[TEST 6] Payment Terms 100% Coherence...");
{
  const invalidTermsContext = {
    project: {},
    financeTerms: [
      { id: "t1", termName: "DP", amountType: "Percentage", percentageValue: 30 } as FinanceTerm,
      { id: "t2", termName: "Pelunasan", amountType: "Percentage", percentageValue: 50 } as FinanceTerm, // total 80% != 100%
    ]
  };
  const res = validateWorkflowStage("FINANCIAL_SETUP", invalidTermsContext);
  assert(!res.valid, "Terms not summing to 100% must fail");
  assert(res.errors.some(e => e.includes("tepat 100%")), "Error mentions 100%");

  const validTermsContext = {
    project: {},
    financeTerms: [
      { id: "t1", termName: "DP", amountType: "Percentage", percentageValue: 30 } as FinanceTerm,
      { id: "t2", termName: "Termin 1", amountType: "Percentage", percentageValue: 40 } as FinanceTerm,
      { id: "t3", termName: "Pelunasan", amountType: "Percentage", percentageValue: 30 } as FinanceTerm,
    ]
  };
  const validRes = validateWorkflowStage("FINANCIAL_SETUP", validTermsContext);
  assert(validRes.valid, "Terms summing to 100% must pass");
}
console.log("✓ Payment Terms 100% Coherence PASSED");

// TEST 7: Pre-Flight Readiness Inspection & Gating
console.log("\n[TEST 7] Pre-Flight Inspection & Activation Gating...");
{
  const incompleteContext = {
    project: {
      projectName: "Hotel Bintang 4",
      projectCode: "PRJ-2026-088",
      // missing client, missing timeline, missing leader
    }
  };
  const preflightIncomplete = evaluatePreFlightInspection(incompleteContext);
  assert(!preflightIncomplete.isReady, "Incomplete project cannot be ready for activation");
  assert(preflightIncomplete.blockingReasons.length > 0, "Must list blocking reasons");

  const completeContext = {
    project: {
      projectName: "Hotel Bintang 4",
      projectCode: "PRJ-2026-088",
      clientName: "PT. Graha Mandiri",
      startDate: "2026-09-01",
      targetDate: "2026-12-31",
      contractValue: 1_200_000_000,
      projectLeaderId: "lead-01",
      projectLeaderName: "Agus Pratama"
    } as any,
    drawingItems: [
      { id: "d1", drawingNumber: "AR-101", drawingName: "Ground Floor" } as DrawingItem
    ],
    financeTerms: [
      { id: "t1", amountType: "Percentage", percentageValue: 50 } as FinanceTerm,
      { id: "t2", amountType: "Percentage", percentageValue: 50 } as FinanceTerm,
    ]
  };
  const preflightComplete = evaluatePreFlightInspection(completeContext);
  assert(preflightComplete.isReady, "Fully configured project must be ready for activation");
  assert(preflightComplete.blockingReasons.length === 0, "No blocking reasons for complete project");
}
console.log("✓ Pre-Flight Inspection & Activation Gating PASSED");

// TEST 8: One-Lane Navigation Gating
console.log("\n[TEST 8] One-Lane Navigation Gate Enforcement...");
{
  const draftContext = {
    project: {
      status: "Planning" as any,
      projectName: "", // invalid step 1
    }
  };
  // Attempt to skip from STEP 1 to STEP 5
  const navSkip = canNavigateToStage("TEAM_SETUP", "PROJECT_SETUP", [], draftContext);
  assert(!navSkip.allowed, "Jumping ahead more than 1 step must be locked");

  // Attempt to go to STEP 2 while STEP 1 is invalid
  const navNextBlocked = canNavigateToStage("CLIENT_SETUP", "PROJECT_SETUP", [], draftContext);
  assert(!navNextBlocked.allowed, "Advancing to next step while current is invalid must be blocked");

  // Complete step 1
  const validDraftContext = {
    project: {
      status: "Planning" as any,
      projectName: "Proyek Valid",
      projectCode: "PRJ-2026-099",
      projectType: "Arsitektur",
      location: "Jakarta"
    }
  };
  const navNextAllowed = canNavigateToStage("CLIENT_SETUP", "PROJECT_SETUP", ["PROJECT_SETUP"], validDraftContext);
  assert(navNextAllowed.allowed, "Advancing to next step when current is valid must be allowed");
}
console.log("✓ One-Lane Navigation Gate Enforcement PASSED");

// TEST 9: Financial Engine Quotation Calculation Integrity
console.log("\n[TEST 9] Financial Engine Invariants...");
{
  const quotationItems = [
    { description: "Desain Arsitektur", quantity: 1, unitPrice: 100_000_000 },
    { description: "Supervisi Lapangan", quantity: 3, unitPrice: 10_000_000 },
  ];
  const calc = calculateQuotationTotals(quotationItems, 10_000_000, 11);
  assert(calc.subTotal === 130_000_000, "Subtotal must be 130,000,000");
  assert(calc.discount === 10_000_000, "Discount must be 10,000,000");
  assert(calc.taxBase === 120_000_000, "Tax base must be 120,000,000");
  assert(calc.tax === 13_200_000, "Tax (11%) must be 13,200,000");
  assert(calc.grandTotal === 133_200_000, "Grand total must be 133,200,000");

  let threwOnNegative = false;
  try {
    assertSafeMoney(-1000, "Uji Negatif");
  } catch (e) {
    threwOnNegative = true;
  }
  assert(threwOnNegative, "assertSafeMoney must throw on negative values");
}
console.log("✓ Financial Engine Invariants PASSED");

console.log("\n============================================================");
console.log("ALL MDRAWING WORKFLOW & INVARIANT TESTS PASSED SUCCESSFULLY!");
console.log("============================================================\n");
