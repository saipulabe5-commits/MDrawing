import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import {
  authenticateRequest,
  type AuthDependencies,
} from "./auth";

/**
 * Redacts sensitive patterns (Firebase keys, env passwords, private keys, secrets).
 */
export function redactSensitiveData(content: string): { sanitized: string; count: number } {
  let count = 0;
  let sanitized = content;

  // 1. Google / Firebase API Key pattern: AIza...
  const aizaRegex = /AIza[0-9A-Za-z-_]{35}/g;
  sanitized = sanitized.replace(aizaRegex, () => {
    count++;
    return "***REDACTED_API_KEY***";
  });

  // 2. Google OAuth Client ID pattern
  const oauthClientIdRegex = /[0-9]{10,}-[a-z0-9_]{20,}\.apps\.googleusercontent\.com/gi;
  sanitized = sanitized.replace(oauthClientIdRegex, () => {
    count++;
    return "***REDACTED_OAUTH_CLIENT_ID***";
  });

  // 3. Firebase Web App ID (1:1234567890:web:abcdef...)
  const appIdRegex = /1:[0-9]+:web:[a-f0-9]+/gi;
  sanitized = sanitized.replace(appIdRegex, () => {
    count++;
    return "***REDACTED_APP_ID***";
  });

  // 4. Specific Firebase Config fields in JSON / TS objects
  const firebaseConfigFields = [
    /(["']?apiKey["']?\s*:\s*["'])[^"']+["']/gi,
    /(["']?appId["']?\s*:\s*["'])[^"']+["']/gi,
    /(["']?messagingSenderId["']?\s*:\s*["'])[^"']+["']/gi,
    /(["']?oAuthClientId["']?\s*:\s*["'])[^"']+["']/gi,
    /(["']?storageBucket["']?\s*:\s*["'])[^"']+["']/gi,
    /(["']?authDomain["']?\s*:\s*["'])[^"']+["']/gi,
  ];
  for (const pattern of firebaseConfigFields) {
    sanitized = sanitized.replace(pattern, (match, prefix) => {
      count++;
      return `${prefix}***REDACTED***"`;
    });
  }

  // 5. Private Keys
  const privateKeyRegex = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi;
  sanitized = sanitized.replace(privateKeyRegex, () => {
    count++;
    return '"***REDACTED_PRIVATE_KEY***"';
  });

  // 6. Env variables with *_SECRET, *_KEY, *_TOKEN, *_PASSWORD
  const envSecretRegex = /([A-Za-z0-9_]*(?:SECRET|KEY|TOKEN|PASSWORD|CREDENTIAL)[A-Za-z0-9_]*\s*=\s*)([^\r\n]+)/gi;
  sanitized = sanitized.replace(envSecretRegex, (match, prefix, val) => {
    const trimmed = val.trim();
    if (trimmed === '""' || trimmed === "''" || trimmed === "" || trimmed.includes("***REDACTED")) {
      return match;
    }
    count++;
    return `${prefix}***REDACTED***`;
  });

  // 7. Connection strings (postgres, mysql, mongodb)
  const connStringRegex = /(postgres(?:ql)?|mongodb(?:\+srv)?|mysql):\/\/[^\s"'`]+/gi;
  sanitized = sanitized.replace(connStringRegex, (match, protocol) => {
    count++;
    return `${protocol}://***REDACTED***`;
  });

  // 8. JWT tokens
  const jwtRegex = /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/gi;
  sanitized = sanitized.replace(jwtRegex, () => {
    count++;
    return "***REDACTED_JWT***";
  });

  return { sanitized, count };
}

/**
 * Recursively collects project files excluding sensitive and build directories.
 */
export async function collectProjectFiles(
  dir: string,
  baseDir: string = dir
): Promise<{ relativePath: string; absolutePath: string }[]> {
  const ignoreDirs = new Set([
    "node_modules",
    "dist",
    ".git",
    ".vscode",
    "coverage",
    ".cache",
    "build",
    ".next",
    ".gradle",
  ]);
  const ignoreFiles = new Set([
    "package-lock.json",
    ".DS_Store",
    "Thumbs.db",
    "dist.zip",
  ]);

  const results: { relativePath: string; absolutePath: string }[] = [];

  let items: fs.Dirent[];
  try {
    items = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (err: any) {
    console.warn(`[SERVER] Cannot readdir ${dir}:`, err.message);
    return results;
  }

  for (const item of items) {
    if (item.name.startsWith(".git") || ignoreDirs.has(item.name)) continue;
    if (ignoreFiles.has(item.name)) continue;

    const fullPath = path.join(dir, item.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");

    if (item.isDirectory()) {
      const subFiles = await collectProjectFiles(fullPath, baseDir);
      results.push(...subFiles);
    } else {
      const ext = path.extname(item.name).toLowerCase();
      const textExtensions = new Set([
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".json",
        ".css",
        ".html",
        ".md",
        ".env",
        ".example",
        ".rules",
        ".txt",
        ".svg",
        ".xml",
      ]);
      const binaryExtensions = new Set([
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".ico",
        ".webp",
        ".pdf",
        ".woff",
        ".woff2",
        ".ttf",
        ".eot",
        ".mp4",
        ".mp3",
        ".zip",
        ".tar",
        ".gz",
      ]);

      if (textExtensions.has(ext) || (!binaryExtensions.has(ext) && !ext)) {
        results.push({ relativePath: relPath, absolutePath: fullPath });
      }
    }
  }
  return results;
}

export interface ExportHandlerOptions {
  authDeps?: AuthDependencies;
  fileCollector?: (dir: string) => Promise<{ relativePath: string; absolutePath: string }[]>;
  rootDir?: string;
}

/**
 * Core Export Handler implementing AUD-06:
 * - Requires strict token revocation check (checkRevoked = true).
 * - Requires active account status verified against canonical Firestore profile.
 * - Strictly enforces OWNER role from canonical profile.
 * - CRITICAL: Fails and terminates BEFORE collecting or reading any project files.
 */
export async function handleExportSourceCode(
  req: Request,
  res: Response,
  options: ExportHandlerOptions = {}
) {
  const reqStart = Date.now();
  const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "127.0.0.1";

  // 1. Strict Authentication & Canonical Authorization Check BEFORE reading any files
  const authResult = await authenticateRequest(
    req,
    {
      checkRevoked: true,
      requireActive: true,
      requireOwner: true,
    },
    options.authDeps
  );

  if (!authResult.ok) {
    // Audit log failed attempt without leaking token content
    console.warn(`[EXPORT AUTH FAILED] Status: ${authResult.status}, Code: ${authResult.code}, IP: ${clientIp}`);
    return res.status(authResult.status).json({
      error: authResult.message,
      code: authResult.code,
    });
  }

  const user = authResult.user;
  console.log(`[EXPORT AUTH SUCCESS] Verified OWNER access for: ${user.email} (UID: ${user.uid})`);

  // 2. Collect project files and redact sensitive information ONLY after auth succeeds
  try {
    const rootDir = options.rootDir || process.cwd();
    const collector = options.fileCollector || collectProjectFiles;
    const filesList = await collector(rootDir);

    let totalLines = 0;
    let totalBytes = 0;
    let totalRedacted = 0;
    const directorySet = new Set<string>();

    const processedFiles = await Promise.all(
      filesList.map(async (f) => {
        const dirName = path.dirname(f.relativePath);
        if (dirName && dirName !== ".") {
          directorySet.add(dirName);
        }

        try {
          const rawContent = await fs.promises.readFile(f.absolutePath, "utf-8");
          const { sanitized, count } = redactSensitiveData(rawContent);

          const lines = sanitized.split(/\r\n|\r|\n/).length;
          const sizeBytes = Buffer.byteLength(sanitized, "utf8");

          return {
            path: f.relativePath,
            name: path.basename(f.relativePath),
            directory: dirName === "." ? "" : dirName,
            extension: path.extname(f.relativePath).replace(".", "") || "txt",
            sizeBytes,
            linesCount: lines,
            content: sanitized,
            redactedCount: count,
          };
        } catch (fileErr: any) {
          console.warn(`[EXPORT WARN] Could not read/redact file ${f.relativePath}: ${fileErr.message}`);
          return {
            path: f.relativePath,
            name: path.basename(f.relativePath),
            directory: dirName === "." ? "" : dirName,
            extension: path.extname(f.relativePath).replace(".", "") || "txt",
            sizeBytes: 0,
            linesCount: 0,
            content: "[UNREADABLE]",
            redactedCount: 0,
          };
        }
      })
    );

    for (const pf of processedFiles) {
      totalLines += pf.linesCount;
      totalBytes += pf.sizeBytes;
      totalRedacted += pf.redactedCount;
    }

    const durationMs = Date.now() - reqStart;
    console.log(`[EXPORT COMPLETED] ${processedFiles.length} files processed in ${durationMs}ms for ${user.email}. Redacted items: ${totalRedacted}`);

    const exportPayload = {
      project: {
        name: "MDrawing",
        company: "PT. Asa Perdana Mandiri",
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        exportedBy: user.email,
        author: "PT. Asa Perdana Mandiri",
        license: "Proprietary",
      },
      securityAudit: {
        status: "NOT_TESTED",
        apiKeysMasked: true,
        credentialsProtected: true,
        redactedOccurrences: totalRedacted,
        notice:
          "Seluruh API key, Firebase configuration, credentials, private key, dan variabel sensitif telah otomatis diredaksikan dengan '***REDACTED***'.",
      },
      summary: {
        totalFiles: processedFiles.length,
        totalLines,
        totalBytes,
        totalFormattedSize: `${(totalBytes / 1024).toFixed(1)} KB`,
        directories: Array.from(directorySet).sort(),
        processingTimeMs: durationMs,
      },
      files: processedFiles,
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="mdrawing-source-export.json"'
    );
    return res.status(200).send(JSON.stringify(exportPayload, null, 2));
  } catch (err: any) {
    console.error("[EXPORT 500 ERROR] Failed to generate source code export:", err);
    return res.status(500).json({
      error: "Gagal membuat berkas export source code: " + err.message,
      code: "EXPORT_PROCESSING_ERROR",
    });
  }
}
