import * as functions from 'firebase-functions';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp();
}
const db = getFirestore();

/**
 * Authoritative recalculation of an invoice's paid amount, remaining amount, and status.
 */
async function syncInvoiceAuthoritative(invoiceId: string) {
  if (!invoiceId) return;
  const invoiceRef = db.collection('invoices').doc(invoiceId);

  // Recalculate total confirmed payments for this invoice
  const paymentsSnapshot = await db.collection('clientPayments')
    .where('invoiceId', '==', invoiceId)
    .where('status', '==', 'Confirmed')
    .get();

  let totalPaid = 0;
  paymentsSnapshot.forEach((docSnap: any) => {
    const data = docSnap.data();
    totalPaid += Number(data.amount) || 0;
  });

  await db.runTransaction(async (transaction: any) => {
    const invoiceDoc = await transaction.get(invoiceRef);
    if (!invoiceDoc.exists) {
      console.log(`[TRIGGER] Invoice ${invoiceId} not found, skipping sync.`);
      return;
    }

    const invoiceData = invoiceDoc.data()!;
    const grandTotal = Number(invoiceData.grandTotal) || 0;
    const remainingAmount = Math.max(0, grandTotal - totalPaid);

    let newStatus = invoiceData.status;
    // Don't auto-update if it's Void or Cancelled
    if (!['Void', 'Cancelled'].includes(newStatus)) {
      if (totalPaid >= grandTotal && grandTotal > 0) {
        newStatus = 'Paid';
      } else if (totalPaid > 0) {
        newStatus = 'Partial Paid';
      } else {
        // If no payments are confirmed anymore, fall back to Sent if it was Paid/Partial Paid
        if (['Paid', 'Partial Paid', 'Partially Paid'].includes(newStatus)) {
          newStatus = 'Sent';
        }
      }
    }

    console.log(`[TRIGGER] Authoritative update Invoice ${invoiceId}: totalPaid=${totalPaid}, remaining=${remainingAmount}, status=${newStatus}`);
    transaction.update(invoiceRef, {
      paidAmount: totalPaid,
      amountPaid: totalPaid,
      remainingAmount: remainingAmount,
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
  });
}

/**
 * Authoritative recalculation of a vendor bill's paid amount, remaining amount, and status.
 */
async function syncVendorBillAuthoritative(billId: string) {
  if (!billId) return;
  const billRef = db.collection('vendorBills').doc(billId);

  // Recalculate total confirmed payments for this bill (supporting canonical billId)
  const paymentsSnapshot = await db.collection('vendorPayments')
    .where('billId', '==', billId)
    .where('status', '==', 'Confirmed')
    .get();

  let totalPaid = 0;
  paymentsSnapshot.forEach((docSnap: any) => {
    const data = docSnap.data();
    totalPaid += Number(data.amount) || 0;
  });

  await db.runTransaction(async (transaction: any) => {
    const billDoc = await transaction.get(billRef);
    if (!billDoc.exists) {
      console.log(`[TRIGGER] Vendor bill ${billId} not found, skipping sync.`);
      return;
    }

    const billData = billDoc.data()!;
    const billAmount = Number(billData.amount ?? billData.grandTotal) || 0;
    const remainingAmount = Math.max(0, billAmount - totalPaid);

    let newStatus = billData.status;
    // Don't auto-update if it's Void or Cancelled
    if (!['Void', 'Cancelled'].includes(newStatus)) {
      if (totalPaid >= billAmount && billAmount > 0) {
        newStatus = 'Paid';
      } else if (totalPaid > 0) {
        newStatus = 'Partial Paid';
      } else {
        if (['Paid', 'Partial Paid', 'Partially Paid'].includes(newStatus)) {
          newStatus = 'Received';
        }
      }
    }

    console.log(`[TRIGGER] Authoritative update VendorBill ${billId}: totalPaid=${totalPaid}, remaining=${remainingAmount}, status=${newStatus}`);
    transaction.update(billRef, {
      paidAmount: totalPaid,
      remainingAmount: remainingAmount,
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
  });
}

// Business Rule #11: Sync invoice amountPaid, paidAmount, remainingAmount, and status when clientPayments is written.
export const onClientPaymentWrite = functions.firestore
  .document('clientPayments/{paymentId}')
  .onWrite(async (change: functions.Change<functions.firestore.DocumentSnapshot>) => {
    const paymentId = change.after.id || change.before.id;
    console.log(`[TRIGGER] Processing client payment write for ${paymentId}`);

    const beforeData = change.before.exists ? change.before.data() : null;
    const afterData = change.after.exists ? change.after.data() : null;

    const oldInvoiceId = beforeData?.invoiceId;
    const newInvoiceId = afterData?.invoiceId;

    const invoicesToSync = new Set<string>();
    if (oldInvoiceId) invoicesToSync.add(oldInvoiceId);
    if (newInvoiceId) invoicesToSync.add(newInvoiceId);

    if (invoicesToSync.size === 0) {
      console.log(`[TRIGGER] No invoiceId associated with payment ${paymentId}`);
      return null;
    }

    for (const invoiceId of invoicesToSync) {
      await syncInvoiceAuthoritative(invoiceId);
    }
    return null;
  });

// Business Rule #11 & #19: Sync vendorBill paidAmount, remainingAmount, and status when vendorPayments is written.
export const onVendorPaymentWrite = functions.firestore
  .document('vendorPayments/{paymentId}')
  .onWrite(async (change: functions.Change<functions.firestore.DocumentSnapshot>) => {
    const paymentId = change.after.id || change.before.id;
    console.log(`[TRIGGER] Processing vendor payment write for ${paymentId}`);

    const beforeData = change.before.exists ? change.before.data() : null;
    const afterData = change.after.exists ? change.after.data() : null;

    const oldBillId = beforeData?.billId || beforeData?.vendorBillId;
    const newBillId = afterData?.billId || afterData?.vendorBillId;

    const billsToSync = new Set<string>();
    if (oldBillId) billsToSync.add(oldBillId);
    if (newBillId) billsToSync.add(newBillId);

    if (billsToSync.size === 0) {
      console.log(`[TRIGGER] No billId associated with vendor payment ${paymentId}`);
      return null;
    }

    for (const billId of billsToSync) {
      await syncVendorBillAuthoritative(billId);
    }
    return null;
  });

// Business Rule: Sync client name and email to projects when client profile is updated
export const onClientWrite = functions.firestore
  .document('clients/{clientId}')
  .onWrite(async (change: functions.Change<functions.firestore.DocumentSnapshot>) => {
    const clientId = change.after.id || change.before.id;
    console.log(`[TRIGGER] Processing client write for ${clientId}`);

    // If client is deleted, we might want to do something, but for now we just care about updates
    if (!change.after.exists) {
       console.log(`[TRIGGER] Client ${clientId} was deleted, skipping sync.`);
       return null;
    }

    const beforeData = change.before.exists ? change.before.data() : null;
    const afterData = change.after.exists ? change.after.data() : null;

    // Check if relevant fields changed
    const oldName = beforeData?.clientName;
    const newName = afterData?.clientName;
    const oldEmail = beforeData?.email;
    const newEmail = afterData?.email;

    if (oldName === newName && oldEmail === newEmail) {
      console.log(`[TRIGGER] Client ${clientId} name and email unchanged, skipping project sync.`);
      return null;
    }

    console.log(`[TRIGGER] Syncing client ${clientId} details to associated projects...`);
    
    // Find all projects with this clientId
    const projectsSnapshot = await db.collection('projects')
      .where('clientId', '==', clientId)
      .get();

    if (projectsSnapshot.empty) {
      console.log(`[TRIGGER] No projects found for client ${clientId}`);
      return null;
    }

    const batch = db.batch();
    let count = 0;

    projectsSnapshot.forEach((docSnap: any) => {
      const projectRef = db.collection('projects').doc(docSnap.id);
      batch.update(projectRef, {
        clientName: newName || '',
        clientEmail: newEmail || '',
        updatedAt: new Date().toISOString()
      });
      count++;
    });

    await batch.commit();
    console.log(`[TRIGGER] Successfully synced client details to ${count} project(s).`);

    return null;
  });

