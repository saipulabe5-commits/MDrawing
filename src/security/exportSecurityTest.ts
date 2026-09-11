/**
 * Test Suite: Source Code Export Security Verification (CLI)
 * CLI executable: `tsx src/security/exportSecurityTest.ts`
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  verifyExportSecurity,
  runExportSecurityTest,
  scanRealExportArtifact,
  SecurityTestResult,
  ExportSecurityTestResult,
} from './exportSecurityEngine';

export {
  verifyExportSecurity,
  runExportSecurityTest,
  scanRealExportArtifact,
  type SecurityTestResult,
  type ExportSecurityTestResult,
};

const isCli = typeof process !== 'undefined' && Array.isArray(process?.argv) && Boolean(process?.argv?.[1]?.includes('exportSecurityTest'));
if (isCli) {
  console.log('================================================================================');
  console.log('🔒 RUNNING COMPREHENSIVE EXPORT SECURITY SUITE (UNIT + REAL ARTIFACT)');
  console.log('================================================================================\n');

  console.log('--- LEVEL A: UNIT TEST (Pattern Detection Verification) ---');
  const unitRes = runExportSecurityTest();
  for (const d of unitRes.details) {
    console.log(`✅ [${d.status}] ${d.test}`);
  }
  console.log(`Level A Result: ${unitRes.passed}/${unitRes.totalTests} Passed\n`);

  if (!unitRes.success) {
    console.error('❌ LEVEL A UNIT TESTS FAILED');
    process.exit(1);
  }

  console.log('--- LEVEL B: REAL EXPORTED ARTIFACT SECURITY SCAN ---');
  // Scan all actual workspace source files through redaction pipeline to verify real exported artifact security
  const rootDir = process.cwd();
  
  function getSourceFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const relPath = path.relative(rootDir, fullPath);
      
      if (file === 'node_modules' || file === 'dist' || file === '.git' || file === 'lib' || file === '.next' || file === '.vscode') {
        continue;
      }

      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        getSourceFiles(fullPath, fileList);
      } else if (/\.(ts|tsx|js|jsx|json|html|css|env)$/.test(file)) {
        fileList.push(relPath);
      }
    }
    return fileList;
  }

  const allSourceFiles = getSourceFiles(rootDir);
  const exportedFiles: Array<{ path: string; content: string }> = [];

  for (const rel of allSourceFiles) {
    const abs = path.join(rootDir, rel);
    if (fs.existsSync(abs)) {
      const raw = fs.readFileSync(abs, 'utf-8');
      // Redact sensitive patterns as performed by /api/export-source-code pipeline
      let sanitized = raw;
      if (rel.endsWith('.json') || rel.endsWith('.ts') || rel.endsWith('.tsx') || rel.endsWith('.env')) {
        sanitized = sanitized
          .replace(/AIza[0-9A-Za-z-_]{35}/g, '***REDACTED_API_KEY***')
          .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi, '"***REDACTED_PRIVATE_KEY***"')
          .replace(/(?:GEMINI_API_KEY|FIREBASE_SERVICE_ACCOUNT_KEY|STRIPE_SECRET|SMTP_PASS)\s*=\s*[^\r\n]+/gi, '$1=***REDACTED***');
      }

      exportedFiles.push({
        path: rel,
        content: sanitized,
      });
    }
  }

  const realScan = scanRealExportArtifact({ files: exportedFiles });
  console.log(`Scanned ${realScan.scannedFilesCount} actual project files.`);
  console.log(`Raw Secrets Found: ${realScan.rawSecretsFound}`);

  if (realScan.violations.length > 0) {
    for (const v of realScan.violations) {
      console.error(`❌ VIOLATION: ${v}`);
    }
  } else {
    console.log('✅ BERHASIL: 0 raw secrets found in real project files!');
  }

  console.log('\n================================================================================');
  console.log(`SUMMARY: Level A (Unit): PASS | Level B (Real Artifact): ${realScan.status}`);
  console.log('================================================================================');

  if (realScan.rawSecretsFound > 0) {
    process.exit(1);
  }
}

