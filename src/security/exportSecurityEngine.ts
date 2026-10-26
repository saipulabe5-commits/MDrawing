/**
 * Source Code Export Security Engine
 * Memastikan hasil export JSON TIDAK PERNAH membocorkan API key, Firebase config asli,
 * private key, credential, atau token rahasia.
 */

export interface SecurityTestResult {
  passed: boolean;
  testName: string;
  details: string;
}

export function verifyExportSecurity(exportJson: any): SecurityTestResult[] {
  const results: SecurityTestResult[] = [];

  if (!exportJson || !Array.isArray(exportJson.files)) {
    results.push({
      testName: "Struktur Berkas JSON",
      passed: false,
      details: "Format JSON tidak valid atau properti files tidak ditemukan.",
    });
    return results;
  }

  // Test 1: Header metadata project & security audit
  const hasAudit = exportJson.securityAudit && exportJson.securityAudit.status === "PASSED";
  results.push({
    testName: "Security Audit Header Status",
    passed: !!hasAudit,
    details: hasAudit ? "Header securityAudit.status terverifikasi PASSED" : "Header security audit gagal",
  });

  // Test 2: Scan for unmasked Firebase API keys (AIza...)
  let foundRawApiKey = false;
  let unmaskedSample = "";
  const apiKeyRegex = /AIza[0-9A-Za-z-_]{35}/;

  // Test 3: Scan for Private Key blocks
  let foundRawPrivateKey = false;
  const privateKeyRegex = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;

  // Test 4: Scan for raw env secrets (e.g. GEMINI_API_KEY=..., STRIPE_SECRET=...)
  let foundRawEnvSecret = false;
  const rawSecretRegex = /(?:GEMINI_API_KEY|FIREBASE_ADMIN_KEY|STRIPE_SECRET|SECRET_KEY)\s*=\s*["']?[A-Za-z0-9_\-]{8,}/;

  for (const file of exportJson.files) {
    const content = file.content || "";
    
    if (apiKeyRegex.test(content)) {
      foundRawApiKey = true;
      unmaskedSample = `Ditemukan di ${file.path}`;
    }
    if (privateKeyRegex.test(content)) {
      foundRawPrivateKey = true;
      unmaskedSample = `Private key ditemukan di ${file.path}`;
    }
    if (rawSecretRegex.test(content)) {
      foundRawEnvSecret = true;
      unmaskedSample = `Raw secret env ditemukan di ${file.path}`;
    }
  }

  results.push({
    testName: "Pencegahan Kebocoran Firebase API Key",
    passed: !foundRawApiKey,
    details: foundRawApiKey 
      ? `GAGAL: Ditemukan API key mentah! (${unmaskedSample})` 
      : "BERHASIL: Tidak ada Google/Firebase API Key mentah yang lolos.",
  });

  results.push({
    testName: "Pencegahan Kebocoran Private Key",
    passed: !foundRawPrivateKey,
    details: foundRawPrivateKey
      ? `GAGAL: Ditemukan blok Private Key! (${unmaskedSample})`
      : "BERHASIL: Blok Private Key aman dan diredaksikan.",
  });

  results.push({
    testName: "Pencegahan Kebocoran Variable Secret/Env",
    passed: !foundRawEnvSecret,
    details: foundRawEnvSecret
      ? `GAGAL: Variabel secret mentah ditemukan! (${unmaskedSample})`
      : "BERHASIL: Seluruh variabel secret/token diredaksikan dengan '***REDACTED***'.",
  });

  return results;
}

export interface ExportSecurityTestResult {
  success: boolean;
  totalTests: number;
  passed: number;
  details: { test: string; pattern: string; status: 'PASSED' | 'FAILED' }[];
  realArtifactScan?: {
    scannedFilesCount: number;
    rawSecretsFound: number;
    violations: string[];
    status: 'PASSED' | 'FAILED';
  };
}

/**
 * Level B: Real Export Security Scanner
 * Scans an actual export JSON artifact or real files for raw secrets.
 */
export function scanRealExportArtifact(exportJson: { files: Array<{ path?: string; relativePath?: string; content?: string }> }): {
  scannedFilesCount: number;
  rawSecretsFound: number;
  violations: string[];
  status: 'PASSED' | 'FAILED';
} {
  const files = exportJson?.files || [];
  const violations: string[] = [];
  let rawSecretsFound = 0;

  const secretPatterns = [
    { name: "Unmasked Google/Firebase API Key", regex: /AIza[0-9A-Za-z-_]{35}/ },
    { name: "Unmasked Private Key Block", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
    { name: "Unmasked JWT Token", regex: /eyJ[a-zA-Z0-9_-]{15,}\.eyJ[a-zA-Z0-9_-]{15,}\.[a-zA-Z0-9_-]{15,}/ },
    { name: "Raw Database Connection Credentials", regex: /(?:postgres(?:ql)?|mongodb(?:\+srv)?|mysql):\/\/[^:\s'"`]+:[^@\s'"`]+@/ },
    { name: "Raw Environment Secret Assignment", regex: /(?:GEMINI_API_KEY|FIREBASE_SERVICE_ACCOUNT_KEY|STRIPE_SECRET|SMTP_PASS)\s*=\s*["']?(?!(\*\*\*REDACTED|undefined|""))[A-Za-z0-9_\-\.\/]{10,}/ },
  ];

  for (const file of files) {
    const filePath = file.path || file.relativePath || 'unknown';
    const content = file.content || '';
    
    // Skip test fixtures or security scanner definition files that intentionally define regexes
    if (filePath.includes('.example') || filePath.includes('exportSecurityTest') || filePath.includes('exportSecurityEngine')) {
      continue;
    }

    for (const pat of secretPatterns) {
      if (pat.regex.test(content)) {
        rawSecretsFound++;
        violations.push(`${pat.name} found in ${filePath}`);
      }
    }
  }

  return {
    scannedFilesCount: files.length,
    rawSecretsFound,
    violations,
    status: rawSecretsFound === 0 ? 'PASSED' : 'FAILED',
  };
}

export function runExportSecurityTest(realArtifact?: { files: Array<{ path?: string; relativePath?: string; content?: string }> }): ExportSecurityTestResult {
  // Level A: Unit test suite running live pattern validation against test cases
  const testCases = [
    {
      name: "Deteksi API Key Google/Firebase (AIza...)",
      regex: /AIza[0-9A-Za-z-_]{35}/,
      syntheticInput: 'apiKey: "AIzaSyDummySecretKeyForTestingPurpose123"',
      shouldRedact: true,
    },
    {
      name: "Deteksi Private Key RSA/PKCS8 Header",
      regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
      syntheticInput: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgk...',
      shouldRedact: true,
    },
    {
      name: "Deteksi Environment Variables Secret",
      regex: /(GEMINI_API_KEY|FIREBASE_ADMIN_KEY|STRIPE_SECRET|SECRET_KEY)\s*=\s*["']?[A-Za-z0-9_\-]{8,}/,
      syntheticInput: 'GEMINI_API_KEY=AIzaSyBSecretToken1234567890',
      shouldRedact: true,
    },
    {
      name: "Pengecualian File Non-Sensitif (Public Assets/CSS)",
      regex: /AIza[0-9A-Za-z-_]{35}/,
      syntheticInput: 'color: #007AFF; font-family: -apple-system;',
      shouldRedact: false,
    },
  ];

  const details = testCases.map((tc) => {
    const matched = tc.regex.test(tc.syntheticInput);
    const passed = tc.shouldRedact ? matched : !matched;
    return {
      test: tc.name,
      pattern: tc.regex.toString(),
      status: (passed ? 'PASSED' : 'FAILED') as 'PASSED' | 'FAILED',
    };
  });

  const passedCount = details.filter((d) => d.status === 'PASSED').length;
  let realScanResult = undefined;

  if (realArtifact && Array.isArray(realArtifact.files)) {
    realScanResult = scanRealExportArtifact(realArtifact);
  }

  const isAllSuccess = passedCount === testCases.length && (!realScanResult || realScanResult.status === 'PASSED');

  return {
    success: isAllSuccess,
    totalTests: testCases.length,
    passed: passedCount,
    details,
    realArtifactScan: realScanResult,
  };
}
