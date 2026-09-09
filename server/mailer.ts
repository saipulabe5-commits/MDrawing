import nodemailer from "nodemailer";

export interface SendEmailPayload {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  senderName?: string;
}

// In-memory lock for batch check to prevent concurrent abuse
let batchExecutionLock = false;
let lastBatchTimestamp = 0;
const BATCH_COOLDOWN_MS = 10000;

export function acquireBatchLock(): boolean {
  const now = Date.now();
  if (batchExecutionLock) return false;
  if (now - lastBatchTimestamp < BATCH_COOLDOWN_MS) return false;
  batchExecutionLock = true;
  lastBatchTimestamp = now;
  return true;
}

export function releaseBatchLock(): void {
  batchExecutionLock = false;
}

export function sanitizeHeader(val: string | undefined | null): string {
  if (!val || typeof val !== "string") return "";
  return val.replace(/[\r\n\t]/g, " ").trim();
}

export function isValidEmail(email: string | undefined | null): boolean {
  if (!email || typeof email !== "string") return false;
  if (email.length > 254) return false;
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return re.test(email);
}

// Hardened Transporter with fallback
export async function getTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === "production",
      },
    });
  }

  // Safe fallback using test ethereal or jsonTransport
  try {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  } catch {
    return nodemailer.createTransport({
      jsonTransport: true,
    });
  }
}

// Generate styled HTML email for drawing deadline reminders
export function generateDeadlineEmailHtml(params: {
  recipientName: string;
  drawingNumber: string;
  drawingName: string;
  projectName: string;
  deadlineDate: string;
  type: "H-3" | "H-0" | "MANUAL";
  progress?: number;
  status?: string;
  notes?: string;
  customNote?: string;
  senderName?: string;
  senderRole?: string;
  appUrl?: string;
}) {
  const isH3 = params.type === "H-3";
  const isH0 = params.type === "H-0";
  
  const badgeColor = isH0 ? "#dc2626" : isH3 ? "#d97706" : "#2563eb";
  const badgeText = isH0
    ? "PENGINGAT DEADLINE HARI-H (HARI INI)"
    : isH3
    ? "PENGINGAT DEADLINE 3 HARI SEBELUMNYA (H-3)"
    : "PENGINGAT PROGRESS & DEADLINE GAMBAR";

  const headline = isH0
    ? `Gambar "${params.drawingNumber}" JATUH TEMPO HARI INI!`
    : isH3
    ? `Gambar "${params.drawingNumber}" jatuh tempo dalam 3 hari!`
    : `Pengingat pengerjaan gambar "${params.drawingNumber}"`;

  const appLink = params.appUrl || process.env.APP_URL || "https://ai.studio";
  const progressVal = typeof params.progress === "number" ? params.progress : 0;

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pengingat Deadline MDrawing</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f7; margin: 0; padding: 24px; color: #1d1d1f; }
        .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04); border: 1px solid #e5e5ea; }
        .header { background: #1c1c1e; color: #ffffff; padding: 26px 28px; text-align: left; border-bottom: 3px solid ${badgeColor}; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
        .header p { margin: 4px 0 0 0; font-size: 12px; color: #8e8e93; font-weight: 400; }
        .content { padding: 28px; }
        .badge { display: inline-block; background-color: ${badgeColor}; color: #ffffff; font-size: 10px; font-weight: 700; padding: 5px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 18px; }
        .greeting { font-size: 16px; font-weight: 600; color: #1c1c1e; margin-bottom: 10px; }
        .message { font-size: 14px; line-height: 1.6; color: #3a3a3c; margin-bottom: 20px; }
        .card { background-color: #f2f2f7; border: 1px solid #e5e5ea; border-radius: 12px; padding: 18px; margin-bottom: 20px; }
        .card-row { display: flex; margin-bottom: 9px; font-size: 13px; }
        .card-row:last-child { margin-bottom: 0; }
        .card-label { font-weight: 600; color: #8e8e93; width: 120px; flex-shrink: 0; }
        .card-value { color: #1c1c1e; font-weight: 500; }
        .progress-bar-bg { background-color: #e5e5ea; border-radius: 6px; height: 8px; width: 100%; overflow: hidden; margin-top: 6px; }
        .progress-bar-fill { background-color: #0071e3; height: 100%; width: ${progressVal}%; border-radius: 6px; }
        .note-box { background-color: #fff8e6; border-left: 4px solid #f59e0b; padding: 12px 14px; border-radius: 8px; font-size: 13px; color: #92400e; margin-bottom: 20px; }
        .btn { display: inline-block; background-color: #0071e3; color: #ffffff !important; font-weight: 600; font-size: 13px; padding: 12px 26px; border-radius: 980px; text-decoration: none; text-align: center; margin-top: 8px; box-shadow: 0 4px 12px rgba(0, 113, 227, 0.25); }
        .footer { background-color: #fbfbfd; padding: 18px 28px; text-align: center; font-size: 11px; color: #8e8e93; border-top: 1px solid #e5e5ea; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>MDrawing</h1>
          <p>Sistem Manajemen Gambar & Keuangan Proyek</p>
        </div>
        <div class="content">
          <div class="badge">${badgeText}</div>
          <div class="greeting">Halo ${params.recipientName},</div>
          <div class="message">
            ${params.senderName ? `<strong>${params.senderName}</strong> (${params.senderRole || "Manager"}) mengirimkan pengingat untuk Anda.` : "Ini adalah notifikasi otomatis mengenai item gambar proyek yang ditugaskan kepada Anda sebagai <strong>PIC</strong>."} 
            ${headline}
          </div>

          ${params.customNote ? `
            <div class="note-box">
              <strong>Pesan Tambahan:</strong><br>
              "${params.customNote}"
            </div>
          ` : ""}

          <div class="card">
            <div class="card-row">
              <div class="card-label">Proyek:</div>
              <div class="card-value"><strong>${params.projectName}</strong></div>
            </div>
            <div class="card-row">
              <div class="card-label">No. Gambar:</div>
              <div class="card-value font-mono"><strong>${params.drawingNumber}</strong></div>
            </div>
            <div class="card-row">
              <div class="card-label">Nama Gambar:</div>
              <div class="card-value">${params.drawingName}</div>
            </div>
            <div class="card-row">
              <div class="card-label">Deadline:</div>
              <div class="card-value" style="color: ${badgeColor}; font-weight: 700;">${params.deadlineDate}</div>
            </div>
            <div class="card-row">
              <div class="card-label">Status Saat Ini:</div>
              <div class="card-value">${params.status || "Proses"}</div>
            </div>
            <div class="card-row">
              <div class="card-label">Progress:</div>
              <div class="card-value" style="flex: 1;">
                <strong>${progressVal}%</strong>
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill"></div>
                </div>
              </div>
            </div>
            ${params.notes ? `
            <div class="card-row" style="margin-top: 8px;">
              <div class="card-label">Catatan Revisi:</div>
              <div class="card-value" style="font-style: italic;">${params.notes}</div>
            </div>
            ` : ""}
          </div>

          <p style="font-size: 13px; color: #6e6e73; line-height: 1.5;">
            Mohon lakukan pembaruan progres gambar atau koordinasikan jika terdapat kendala dalam pengerjaan.
          </p>

          <a href="${appLink}" class="btn">Buka Aplikasi MDrawing</a>
        </div>
        <div class="footer">
          Email dikirim secara otomatis oleh Sistem MDrawing (PT. Asa Perdana Mandiri).<br>
          Harap tidak membalas email otomatis ini.
        </div>
      </div>
    </body>
    </html>
  `;
}
