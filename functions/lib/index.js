"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onClientWrite = exports.onVendorPaymentWrite = exports.onClientPaymentWrite = void 0;
const functions = require("firebase-functions");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
if (!(0, app_1.getApps)().length) {
    (0, app_1.initializeApp)();
}
const db = (0, firestore_1.getFirestore)();
/**
 * Authoritative recalculation of an invoice's paid amount, remaining amount, and status.
 */
async function syncInvoiceAuthoritative(invoiceId) {
    if (!invoiceId)
        return;
    const invoiceRef = db.collection('invoices').doc(invoiceId);
    // Recalculate total confirmed payments for this invoice
    const paymentsSnapshot = await db.collection('clientPayments')
        .where('invoiceId', '==', invoiceId)
        .where('status', '==', 'Confirmed')
        .get();
    let totalPaid = 0;
    paymentsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        totalPaid += Number(data.amount) || 0;
    });
    await db.runTransaction(async (transaction) => {
        const invoiceDoc = await transaction.get(invoiceRef);
        if (!invoiceDoc.exists) {
            console.log(`[TRIGGER] Invoice ${invoiceId} not found, skipping sync.`);
            return;
        }
        const invoiceData = invoiceDoc.data();
        const grandTotal = Number(invoiceData.grandTotal) || 0;
        const remainingAmount = Math.max(0, grandTotal - totalPaid);
        let newStatus = invoiceData.status;
        // Don't auto-update if it's Void or Cancelled
        if (!['Void', 'Cancelled'].includes(newStatus)) {
            if (totalPaid >= grandTotal && grandTotal > 0) {
                newStatus = 'Paid';
            }
            else if (totalPaid > 0) {
                newStatus = 'Partial Paid';
            }
            else {
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
async function syncVendorBillAuthoritative(billId) {
    if (!billId)
        return;
    const billRef = db.collection('vendorBills').doc(billId);
    // Recalculate total confirmed payments for this bill (supporting canonical billId)
    const paymentsSnapshot = await db.collection('vendorPayments')
        .where('billId', '==', billId)
        .where('status', '==', 'Confirmed')
        .get();
    let totalPaid = 0;
    paymentsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        totalPaid += Number(data.amount) || 0;
    });
    await db.runTransaction(async (transaction) => {
        var _a;
        const billDoc = await transaction.get(billRef);
        if (!billDoc.exists) {
            console.log(`[TRIGGER] Vendor bill ${billId} not found, skipping sync.`);
            return;
        }
        const billData = billDoc.data();
        const billAmount = Number((_a = billData.amount) !== null && _a !== void 0 ? _a : billData.grandTotal) || 0;
        const remainingAmount = Math.max(0, billAmount - totalPaid);
        let newStatus = billData.status;
        // Don't auto-update if it's Void or Cancelled
        if (!['Void', 'Cancelled'].includes(newStatus)) {
            if (totalPaid >= billAmount && billAmount > 0) {
                newStatus = 'Paid';
            }
            else if (totalPaid > 0) {
                newStatus = 'Partial Paid';
            }
            else {
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
exports.onClientPaymentWrite = functions.firestore
    .document('clientPayments/{paymentId}')
    .onWrite(async (change) => {
    const paymentId = change.after.id || change.before.id;
    console.log(`[TRIGGER] Processing client payment write for ${paymentId}`);
    const beforeData = change.before.exists ? change.before.data() : null;
    const afterData = change.after.exists ? change.after.data() : null;
    const oldInvoiceId = beforeData === null || beforeData === void 0 ? void 0 : beforeData.invoiceId;
    const newInvoiceId = afterData === null || afterData === void 0 ? void 0 : afterData.invoiceId;
    const invoicesToSync = new Set();
    if (oldInvoiceId)
        invoicesToSync.add(oldInvoiceId);
    if (newInvoiceId)
        invoicesToSync.add(newInvoiceId);
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
exports.onVendorPaymentWrite = functions.firestore
    .document('vendorPayments/{paymentId}')
    .onWrite(async (change) => {
    const paymentId = change.after.id || change.before.id;
    console.log(`[TRIGGER] Processing vendor payment write for ${paymentId}`);
    const beforeData = change.before.exists ? change.before.data() : null;
    const afterData = change.after.exists ? change.after.data() : null;
    const oldBillId = (beforeData === null || beforeData === void 0 ? void 0 : beforeData.billId) || (beforeData === null || beforeData === void 0 ? void 0 : beforeData.vendorBillId);
    const newBillId = (afterData === null || afterData === void 0 ? void 0 : afterData.billId) || (afterData === null || afterData === void 0 ? void 0 : afterData.vendorBillId);
    const billsToSync = new Set();
    if (oldBillId)
        billsToSync.add(oldBillId);
    if (newBillId)
        billsToSync.add(newBillId);
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
exports.onClientWrite = functions.firestore
    .document('clients/{clientId}')
    .onWrite(async (change) => {
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
    const oldName = beforeData === null || beforeData === void 0 ? void 0 : beforeData.clientName;
    const newName = afterData === null || afterData === void 0 ? void 0 : afterData.clientName;
    const oldEmail = beforeData === null || beforeData === void 0 ? void 0 : beforeData.email;
    const newEmail = afterData === null || afterData === void 0 ? void 0 : afterData.email;
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
    const docs = projectsSnapshot.docs;
    const CHUNK_SIZE = 400;
    let syncedCount = 0;
    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        const batch = db.batch();
        chunk.forEach((docSnap) => {
            const projectRef = db.collection('projects').doc(docSnap.id);
            batch.update(projectRef, {
                clientName: newName || '',
                clientEmail: newEmail || '',
                updatedAt: new Date().toISOString()
            });
        });
        await batch.commit();
        syncedCount += chunk.length;
    }
    console.log(`[TRIGGER] Successfully synced client details to ${syncedCount} of ${docs.length} project(s) in chunks of ${CHUNK_SIZE}.`);
    return null;
});
//# sourceMappingURL=index.js.map