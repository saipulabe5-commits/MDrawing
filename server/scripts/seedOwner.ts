/**
 * MDrawing - Script Seed Manual Owner
 * Digunakan untuk provisioning akun Owner pertama jika dilakukan secara manual di server/CI.
 * 
 * Penggunaan:
 *   npx tsx server/scripts/seedOwner.ts <UID> [EMAIL]
 * atau
 *   npm run seed:owner -- <UID> [EMAIL]
 */
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

async function runSeed() {
  const targetUid = process.argv[2] || process.env.OWNER_UID;
  const targetEmail = process.argv[3] || process.env.OWNER_EMAIL || "saipulabe@gmail.com";

  if (!targetUid) {
    console.error("❌ ERROR: Parameter UID wajib disertakan!");
    console.error("Contoh: npx tsx server/scripts/seedOwner.ts <FIREBASE_AUTH_UID> [EMAIL]");
    process.exit(1);
  }

  let projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "";
  let firestoreDatabaseId = "(default)";

  const rawWebConfig = process.env.MDRAWING_FIREBASE_CONFIG || process.env.FIREBASE_CONFIG;
  if (rawWebConfig && rawWebConfig.trim().startsWith("{")) {
    try {
      const cfg = JSON.parse(rawWebConfig.trim());
      if (cfg.projectId) projectId = cfg.projectId;
      if (cfg.firestoreDatabaseId && cfg.firestoreDatabaseId !== "(default)") {
        firestoreDatabaseId = cfg.firestoreDatabaseId;
      }
    } catch (e: any) {
      console.warn("Peringatan: Gagal membaca config dari env:", e.message);
    }
  }

  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (cfg.projectId) projectId = cfg.projectId;
      if (cfg.firestoreDatabaseId && cfg.firestoreDatabaseId !== "(default)") {
        firestoreDatabaseId = cfg.firestoreDatabaseId;
      }
    } catch (e: any) {
      console.warn("Peringatan: Gagal membaca firebase-applet-config.json:", e.message);
    }
  }

  let adminApp: App;
  if (!getApps().length) {
    const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (rawKey && rawKey.trim()) {
      try {
        const parsed = JSON.parse(rawKey.trim());
        adminApp = initializeApp({ credential: cert(parsed), ...(projectId ? { projectId } : {}) });
      } catch {
        adminApp = initializeApp({ ...(projectId ? { projectId } : {}) });
      }
    } else {
      adminApp = initializeApp({ ...(projectId ? { projectId } : {}) });
    }
  } else {
    adminApp = getApps()[0];
  }

  const auth = getAuth(adminApp);
  let db;
  try {
    db = firestoreDatabaseId && firestoreDatabaseId !== "(default)"
      ? getFirestore(adminApp, firestoreDatabaseId)
      : getFirestore(adminApp);
  } catch (err) {
    db = getFirestore(adminApp);
  }

  console.log(`\n🚀 [SEED OWNER] Memulai proses provisioning Owner...`);
  console.log(`   UID    : ${targetUid}`);
  console.log(`   Email  : ${targetEmail}`);
  console.log(`   Project: ${projectId}`);

  // 1. Set Custom Claims di Firebase Auth
  const ownerClaims = {
    role: "OWNER",
    canViewFinance: true,
    canEditFinance: true,
    canApproveFinance: true,
    canExportFinanceReport: true,
    canVoidFinanceTransaction: true,
    canEditPaidTransaction: true,
    canViewVendorCost: true,
    canViewVendorPayment: true,
  };

  await auth.setCustomUserClaims(targetUid, ownerClaims);
  console.log(`✅ 1. Custom Claims Firebase Auth berhasil diset ({ role: "OWNER", ... }).`);

  // 2. Ambil display name jika ada
  let displayName = "Saipul (Owner)";
  let email = targetEmail;
  try {
    const userRecord = await auth.getUser(targetUid);
    if (userRecord.displayName) displayName = userRecord.displayName;
    if (userRecord.email) email = userRecord.email;
  } catch (err: any) {
    console.log(`ℹ️ Info: User record Auth: ${err.message}`);
  }

  // 3. Tulis dokumen users/{uid} langsung via Admin SDK (bypasses security rules)
  const nowIso = new Date().toISOString();
  const userRef = db.collection("users").doc(targetUid);
  const userSnap = await userRef.get();
  const existing = userSnap.exists ? userSnap.data() : {};

  const ownerDoc = {
    uid: targetUid,
    email,
    name: displayName,
    role: "OWNER",
    isActive: true,
    canViewFinance: true,
    canEditFinance: true,
    canApproveFinance: true,
    canExportFinanceReport: true,
    canVoidFinanceTransaction: true,
    canEditPaidTransaction: true,
    canViewVendorCost: true,
    canViewVendorPayment: true,
    assignedProjectIds: existing?.assignedProjectIds || [],
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
  };

  await userRef.set(ownerDoc, { merge: true });
  console.log(`✅ 2. Dokumen Firestore users/${targetUid} berhasil disimpan dengan role: "OWNER", isActive: true.`);

  // 4. Catat ke Activity Log
  try {
    await db.collection("activityLogs").add({
      entityType: "USER",
      entityId: targetUid,
      action: "CREATE",
      userId: targetUid,
      userName: email,
      userRole: "OWNER",
      details: `Seed Script Manual: Akun ${email} diprovisi sebagai OWNER dengan Custom Claim dan dokumen profil aktif.`,
      createdAt: nowIso,
    });
    console.log(`✅ 3. Activity Log audit tersimpan.`);
  } catch (e) {
    // ignore
  }

  console.log(`\n🎉 PROVISIONING SELESAI!`);
  console.log(`Langkah selanjutnya untuk user:`);
  console.log(`1. Buka aplikasi web MDrawing.`);
  console.log(`2. Jika sedang login, klik Logout lalu Login kembali agar ID Token diperbarui dengan Custom Claim baru.`);
  console.log(`3. Seluruh menu Dashboard, Projects, Templates, dan Company Settings akan terbuka normal.\n`);
}

runSeed().catch((err) => {
  console.error("❌ Gagal menjalankan seed script:", err);
  process.exit(1);
});
