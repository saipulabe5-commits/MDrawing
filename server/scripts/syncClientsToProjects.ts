import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

if (!getApps().length) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is missing in .env");
  }
  
  let credential;
  try {
    const trimmed = serviceAccountKey.trim();
    if (trimmed.startsWith("{")) {
      credential = cert(JSON.parse(trimmed));
    } else {
      const decoded = Buffer.from(trimmed, "base64").toString("utf-8");
      if (decoded.trim().startsWith("{")) {
         credential = cert(JSON.parse(decoded));
      } else {
         throw new Error("Invalid base64 credential format");
      }
    }
  } catch (err) {
    throw new Error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. " + err);
  }

  initializeApp({ 
    credential,
    projectId: "mdrawing",
    databaseURL: "https://mdrawing.firebaseio.com"
  });
}

const db = getFirestore();

async function syncClientsToProjects() {
  console.log("Starting client-to-project synchronization...");
  try {
    const clientsSnapshot = await db.collection('clients').get();
    let totalProjectsUpdated = 0;

    for (const clientDoc of clientsSnapshot.docs) {
      const clientData = clientDoc.data();
      const clientId = clientDoc.id;
      const clientName = clientData.clientName || '';
      const clientEmail = clientData.email || '';

      const projectsSnapshot = await db.collection('projects')
        .where('clientId', '==', clientId)
        .get();

      if (!projectsSnapshot.empty) {
        const batch = db.batch();
        projectsSnapshot.forEach(projectDoc => {
          const projectData = projectDoc.data();
          if (projectData.clientName !== clientName || projectData.clientEmail !== clientEmail) {
            batch.update(projectDoc.ref, {
              clientName,
              clientEmail,
              updatedAt: new Date().toISOString()
            });
            totalProjectsUpdated++;
          }
        });
        if (totalProjectsUpdated > 0) {
            await batch.commit();
        }
      }
    }
    console.log(`Synchronization complete! Updated ${totalProjectsUpdated} project(s).`);
  } catch (error) {
    console.error("Error during synchronization:", error);
  }
}

syncClientsToProjects().then(() => process.exit(0));
