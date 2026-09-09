/**
 * Test Suite: Source Code Export Security Verification
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
}

export function runExportSecurityTest(): ExportSecurityTestResult {
  // Test suite running live validation against synthetic test cases
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

  return {
    success: passedCount === testCases.length,
    totalTests: testCases.length,
    passed: passedCount,
    details,
  };
}
