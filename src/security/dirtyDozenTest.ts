/**
 * Test Runner: The Dirty Dozen Security Test Suite (CLI)
 * CLI executable: `tsx src/security/dirtyDozenTest.ts`
 */
import {
  runDirtyDozenTestSuite,
  DirtyDozenScenarioResult,
  DirtyDozenSuiteSummary,
} from './dirtyDozenEngine';

export {
  runDirtyDozenTestSuite,
  type DirtyDozenScenarioResult,
  type DirtyDozenSuiteSummary,
};

async function main() {
  console.log('====================================================');
  console.log('🛡️ RUNNING DIRTY DOZEN SECURITY EMULATOR TEST SUITE');
  console.log('====================================================\n');

  const suite = await runDirtyDozenTestSuite();

  for (const r of suite.results) {
    const symbol = r.status === "PASSED" ? "✅" : "❌";
    console.log(`${symbol} [${r.code}] ${r.name}`);
    console.log(`   Role Context: ${r.roleContext}`);
    console.log(`   Expected: ${r.expectedResult} | Actual: ${r.actualResult} | Status: ${r.status}`);
    console.log(`   Details: ${r.details} (${r.executionTimeMs}ms)\n`);
  }

  console.log('----------------------------------------------------');
  console.log(`TOTAL SECURITY TESTS: ${suite.totalTests} | PASSED: ${suite.passedCount} | FAILED: ${suite.failedCount}`);
  console.log('----------------------------------------------------');

  if (!suite.success) {
    console.error('❌ DIRTY DOZEN SECURITY TEST SUITE FAILED!');
    process.exit(1);
  } else {
    console.log('✅ ALL DIRTY DOZEN SECURITY ATTACK TESTS PASSED (100% BLOCKED)!');
  }
}

const isCli = typeof process !== 'undefined' && Array.isArray(process?.argv) && Boolean(process?.argv?.[1]?.includes('dirtyDozenTest'));
if (isCli) {
  main().catch((err) => {
    console.error('Fatal error in Dirty Dozen test execution:', err);
    process.exit(1);
  });
}
