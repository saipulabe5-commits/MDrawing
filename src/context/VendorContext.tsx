import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, doc, getDoc, getDocs, onSnapshot, query, where, 
  runTransaction, setDoc, updateDoc, deleteDoc, orderBy 
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { 
  Vendor, ProjectVendor, VendorPaymentTerm, VendorBill, VendorPayment, 
  FinancialAuditLog, VendorWorkStatus, VendorBillStatus, VendorPaymentStatus 
} from '../types';
import { hasCapability, canAccessProject } from '../security/authorization';
import { 
  normalizeMoney, 
  validateVendorPaymentMutation, 
  calculateVendorBillPaymentSync 
} from '../engine/financial/financialEngine';

interface VendorContextType {
  vendors: Vendor[];
  projectVendors: ProjectVendor[];
  vendorPaymentTerms: VendorPaymentTerm[];
  vendorBills: VendorBill[];
  vendorPayments: VendorPayment[];
  vendorLogs: FinancialAuditLog[];
  loadingVendor: boolean;

  // Global Vendors
  createVendor: (data: Partial<Vendor>) => Promise<string>;
  updateVendor: (id: string, data: Partial<Vendor>) => Promise<void>;
  deleteVendor: (id: string) => Promise<void>;

  // Project Vendor Contracts
  createProjectVendor: (data: Partial<ProjectVendor>) => Promise<string>;
  updateProjectVendor: (id: string, data: Partial<ProjectVendor>, logReason?: string) => Promise<void>;
  deleteProjectVendor: (id: string) => Promise<void>;
  updateProjectVendorWorkStatus: (id: string, status: VendorWorkStatus, logReason?: string) => Promise<void>;

  // Vendor Payment Terms
  createVendorPaymentTerm: (data: Partial<VendorPaymentTerm>) => Promise<string>;
  updateVendorPaymentTerm: (id: string, data: Partial<VendorPaymentTerm>) => Promise<void>;
  deleteVendorPaymentTerm: (id: string) => Promise<void>;
  reorderVendorPaymentTerms: (terms: VendorPaymentTerm[]) => Promise<void>;

  // Vendor Bills
  createVendorBill: (data: Partial<VendorBill>) => Promise<string>;
  updateVendorBillStatus: (id: string, status: VendorBillStatus, logReason?: string) => Promise<void>;
  voidVendorBill: (id: string, reason?: string) => Promise<void>;

  // Vendor Payments
  createVendorPayment: (data: Partial<VendorPayment>) => Promise<string>;
  updateVendorPaymentStatus: (id: string, status: VendorPaymentStatus, logReason?: string) => Promise<void>;
}

const VendorContext = createContext<VendorContextType | null>(null);

export const useVendor = () => {
  const context = useContext(VendorContext);
  if (!context) throw new Error("useVendor must be used within VendorProvider");
  return context;
};

export const VendorProvider: React.FC<{ projectId?: string; children: React.ReactNode }> = ({ projectId, children }) => {
  const { user, appUser } = useAuth();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [projectVendors, setProjectVendors] = useState<ProjectVendor[]>([]);
  const [vendorPaymentTerms, setVendorPaymentTerms] = useState<VendorPaymentTerm[]>([]);
  const [vendorBills, setVendorBills] = useState<VendorBill[]>([]);
  const [vendorPayments, setVendorPayments] = useState<VendorPayment[]>([]);
  const [vendorLogs, setVendorLogs] = useState<FinancialAuditLog[]>([]);
  const [loadingVendor, setLoadingVendor] = useState(true);

  const canViewFinance = hasCapability(appUser, 'canViewFinance');
  const canEditFinance = hasCapability(appUser, 'canEditFinance');
  const canViewVendorCost = hasCapability(appUser, 'canViewVendorCost');
  const canViewVendorPayment = hasCapability(appUser, 'canViewVendorPayment');
  const hasProjectAccess = projectId ? canAccessProject(appUser, projectId) : true;

  useEffect(() => {
    if (!user) {
      setVendors([]);
      setProjectVendors([]);
      setVendorPaymentTerms([]);
      setVendorBills([]);
      setVendorPayments([]);
      setVendorLogs([]);
      setLoadingVendor(false);
      return;
    }

    setLoadingVendor(true);

    // 1. Fetch Global Vendors
    const qVendors = query(collection(db, 'vendors'));
    const unsubVendors = onSnapshot(qVendors, (snapshot) => {
      setVendors(snapshot.docs.map(doc => doc.data() as Vendor));
      if (!projectId) {
        setLoadingVendor(false);
      }
    }, (error) => {
      console.error("Error fetching vendors:", error);
      setLoadingVendor(false);
    });

    if (!projectId || !hasProjectAccess) {
      setProjectVendors([]);
      setVendorPaymentTerms([]);
      setVendorBills([]);
      setVendorPayments([]);
      setVendorLogs([]);
      return () => unsubVendors();
    }

    // 2. Fetch Project Vendors
    const qProjectVendors = query(
      collection(db, 'projectVendors'),
      where('projectId', '==', projectId)
    );
    const unsubProjectVendors = onSnapshot(qProjectVendors, (snapshot) => {
      setProjectVendors(snapshot.docs.map(doc => doc.data() as ProjectVendor));
    }, (error) => {
      console.error("Error fetching project vendors:", error);
      setLoadingVendor(false);
    });

    // 3. Fetch Vendor Payment Terms
    const qTerms = query(
      collection(db, 'vendorPaymentTerms'),
      where('projectId', '==', projectId),
      orderBy('sortOrder', 'asc')
    );
    const unsubTerms = onSnapshot(qTerms, (snapshot) => {
      setVendorPaymentTerms(snapshot.docs.map(doc => doc.data() as VendorPaymentTerm));
    }, (error) => {
      console.error("Error fetching vendor terms:", error);
      setLoadingVendor(false);
    });

    // 4. Fetch Vendor Bills (Scoped by canViewVendorCost)
    let unsubBills = () => {};
    if (canViewVendorCost) {
      const qBills = query(
        collection(db, 'vendorBills'),
        where('projectId', '==', projectId)
      );
      unsubBills = onSnapshot(qBills, (snapshot) => {
        setVendorBills(snapshot.docs.map(doc => doc.data() as VendorBill));
      }, (error) => {
        console.error("Error fetching vendor bills:", error);
        setLoadingVendor(false);
      });
    } else {
      setVendorBills([]);
    }

    // 5. Fetch Vendor Payments (Scoped by canViewVendorPayment)
    let unsubPayments = () => {};
    if (canViewVendorPayment) {
      const qPayments = query(
        collection(db, 'vendorPayments'),
        where('projectId', '==', projectId)
      );
      unsubPayments = onSnapshot(qPayments, (snapshot) => {
        setVendorPayments(snapshot.docs.map(doc => doc.data() as VendorPayment));
      }, (error) => {
        console.error("Error fetching vendor payments:", error);
        setLoadingVendor(false);
      });
    } else {
      setVendorPayments([]);
    }

    // 6. Fetch Vendor Audit Logs
    const qLogs = query(
      collection(db, 'financialAuditLogs'),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc')
    );
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const allLogs = snapshot.docs.map(doc => doc.data() as FinancialAuditLog);
      setVendorLogs(allLogs.filter(l => ['ProjectVendor', 'VendorBill', 'VendorPayment'].includes(l.transactionType)));
      setLoadingVendor(false);
    }, (error) => {
      console.error("Error fetching vendor audit logs:", error);
      setLoadingVendor(false);
    });

    return () => {
      unsubVendors();
      unsubProjectVendors();
      unsubTerms();
      unsubBills();
      unsubPayments();
      unsubLogs();
    };
  }, [user, projectId, canViewFinance, canViewVendorCost, canViewVendorPayment, hasProjectAccess]);

  const logAudit = async (
    type: FinancialAuditLog['transactionType'],
    id: string,
    action: FinancialAuditLog['action'],
    oldVal: any,
    newVal: any,
    reason?: string
  ) => {
    if (!projectId || !appUser) return;
    const logRef = doc(collection(db, 'financialAuditLogs'));
    await setDoc(logRef, {
      id: logRef.id,
      projectId: projectId,
      transactionType: type,
      transactionId: id,
      action,
      userId: appUser.uid,
      userName: appUser.name || 'Unknown User',
      oldValue: oldVal,
      newValue: newVal,
      reason: reason || '',
      createdAt: new Date().toISOString()
    });
  };

  const generateDocumentNumber = async (type: 'vendorBill' | 'vendorPayment'): Promise<string> => {
    const counterRef = doc(db, 'documentCounters', type);
    return await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      let sequence = 1;
      let prefix = type === 'vendorBill' ? 'VBILL' : 'VPAY';

      if (counterDoc.exists()) {
        const data = counterDoc.data();
        prefix = data.prefix || prefix;
        if (data.year === currentYear && data.month === currentMonth) {
          sequence = (data.sequence || 0) + 1;
        }
      }

      transaction.set(counterRef, {
        id: type,
        prefix,
        year: currentYear,
        month: currentMonth,
        sequence,
        updatedAt: new Date().toISOString()
      });

      const monthStr = currentMonth.toString().padStart(2, '0');
      const seqStr = sequence.toString().padStart(4, '0');
      return `${prefix}-${currentYear}${monthStr}-${seqStr}`;
    });
  };

  // --- CRUD Global Vendors ---
  const createVendor = async (data: Partial<Vendor>) => {
    if (!canEditFinance) throw new Error("Permission denied");
    const docRef = doc(collection(db, 'vendors'));
    const vendor: Vendor = {
      id: docRef.id,
      vendorName: data.vendorName || '',
      vendorType: data.vendorType || 'Lain-lain',
      contactPerson: data.contactPerson || '',
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      bankName: data.bankName || '',
      bankAccountNumber: data.bankAccountNumber || '',
      bankAccountHolder: data.bankAccountHolder || '',
      npwp: data.npwp || '',
      notes: data.notes || '',
      rating: data.rating || 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, vendor);
    return docRef.id;
  };

  const updateVendor = async (id: string, data: Partial<Vendor>) => {
    if (!canEditFinance) throw new Error("Permission denied");
    await updateDoc(doc(db, 'vendors', id), {
      ...data,
      updatedAt: new Date().toISOString()
    });
  };

  const deleteVendor = async (id: string) => {
    if (!canEditFinance) throw new Error("Permission denied");
    await deleteDoc(doc(db, 'vendors', id));
  };

  // --- CRUD Project Vendor Contracts ---
  const createProjectVendor = async (data: Partial<ProjectVendor>) => {
    if (!canEditFinance || !projectId || !appUser) throw new Error("Permission denied");
    const docRef = doc(collection(db, 'projectVendors'));
    const contractVal = normalizeMoney(data.contractValue);

    let vName = data.vendorName || '';
    let vType: any = data.vendorType || 'Lain-lain';

    if (!vName && data.vendorId) {
      const vFound = vendors.find(v => v.id === data.vendorId);
      if (vFound) {
        vName = vFound.vendorName;
        vType = vFound.vendorType;
      }
    }

    const pv: ProjectVendor = {
      id: docRef.id,
      projectId: projectId,
      vendorId: data.vendorId || '',
      vendorName: vName,
      vendorType: vType,
      scopeOfWork: data.scopeOfWork || '',
      contractValue: contractVal,
      workStatus: data.workStatus || 'Belum Mulai',
      startDate: data.startDate || new Date().toISOString().split('T')[0],
      targetDate: data.targetDate || '',
      completionDate: data.completionDate || '',
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, pv);
    await logAudit('ProjectVendor', docRef.id, 'CREATE', null, pv, 'Assigned Vendor to Project');
    return docRef.id;
  };

  const updateProjectVendor = async (id: string, data: Partial<ProjectVendor>, logReason?: string) => {
    if (!canEditFinance) throw new Error("Permission denied");
    const pRef = doc(db, 'projectVendors', id);
    const pDoc = await getDoc(pRef);
    if (!pDoc.exists()) return;
    const oldData = pDoc.data() as ProjectVendor;
    const updates = { 
      ...data, 
      contractValue: data.contractValue !== undefined ? normalizeMoney(data.contractValue) : oldData.contractValue,
      updatedAt: new Date().toISOString() 
    };
    await updateDoc(pRef, updates);
    await logAudit('ProjectVendor', id, 'UPDATE', oldData, { ...oldData, ...updates }, logReason || 'Updated Vendor Contract');
  };

  const deleteProjectVendor = async (id: string) => {
    if (!canEditFinance) throw new Error("Permission denied");
    const pRef = doc(db, 'projectVendors', id);
    const pDoc = await getDoc(pRef);
    if (!pDoc.exists()) return;
    const oldData = pDoc.data() as ProjectVendor;
    await deleteDoc(pRef);
    await logAudit('ProjectVendor', id, 'CANCEL', oldData, null, 'Deleted Vendor Contract from Project');
  };

  const updateProjectVendorWorkStatus = async (id: string, status: VendorWorkStatus, logReason?: string) => {
    if (!canEditFinance) throw new Error("Permission denied");
    const pRef = doc(db, 'projectVendors', id);
    const pDoc = await getDoc(pRef);
    if (!pDoc.exists()) return;
    const oldData = pDoc.data() as ProjectVendor;
    const updates: Partial<ProjectVendor> = {
      workStatus: status,
      updatedAt: new Date().toISOString()
    };
    if (status === 'Selesai') {
      updates.completionDate = new Date().toISOString().split('T')[0];
    }
    await updateDoc(pRef, updates);
    await logAudit('ProjectVendor', id, 'UPDATE', oldData, { ...oldData, ...updates }, logReason || `Work status changed to ${status}`);
  };

  // --- CRUD Vendor Payment Terms ---
  const createVendorPaymentTerm = async (data: Partial<VendorPaymentTerm>) => {
    if (!canEditFinance || !projectId) throw new Error("Permission denied");
    const docRef = doc(collection(db, 'vendorPaymentTerms'));
    const term: VendorPaymentTerm = {
      id: docRef.id,
      projectVendorId: data.projectVendorId || '',
      projectId: projectId,
      termName: data.termName || '',
      triggerType: data.triggerType || 'Manual',
      triggerCondition: data.triggerCondition || '',
      amountType: data.amountType || 'Percentage',
      percentageValue: data.percentageValue,
      nominalValue: data.nominalValue ? normalizeMoney(data.nominalValue) : undefined,
      sortOrder: data.sortOrder || 0,
      invoicedAmount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, term);
    await logAudit('ProjectVendor', docRef.id, 'CREATE', null, term, 'Created Vendor Payment Term');
    return docRef.id;
  };

  const updateVendorPaymentTerm = async (id: string, data: Partial<VendorPaymentTerm>) => {
    if (!canEditFinance) throw new Error("Permission denied");
    const termRef = doc(db, 'vendorPaymentTerms', id);
    const termDoc = await getDoc(termRef);
    if (!termDoc.exists()) return;
    const oldData = termDoc.data() as VendorPaymentTerm;
    const updates = { 
      ...data, 
      nominalValue: data.nominalValue !== undefined ? normalizeMoney(data.nominalValue) : oldData.nominalValue,
      updatedAt: new Date().toISOString() 
    };
    await updateDoc(termRef, updates);
    await logAudit('ProjectVendor', id, 'UPDATE', oldData, { ...oldData, ...updates }, 'Updated Vendor Term');
  };

  const deleteVendorPaymentTerm = async (id: string) => {
    if (!canEditFinance) throw new Error("Permission denied");
    const termRef = doc(db, 'vendorPaymentTerms', id);
    const termDoc = await getDoc(termRef);
    if (!termDoc.exists()) return;
    const oldData = termDoc.data() as VendorPaymentTerm;
    await deleteDoc(termRef);
    await logAudit('ProjectVendor', id, 'CANCEL', oldData, null, 'Deleted Vendor Term');
  };

  const reorderVendorPaymentTerms = async (terms: VendorPaymentTerm[]) => {
    if (!canEditFinance) throw new Error("Permission denied");
    const batch = [];
    for (let i = 0; i < terms.length; i++) {
      const termRef = doc(db, 'vendorPaymentTerms', terms[i].id);
      batch.push(updateDoc(termRef, { sortOrder: i }));
    }
    await Promise.all(batch);
  };

  // --- CRUD Vendor Bills ---
  const createVendorBill = async (data: Partial<VendorBill>) => {
    if (!canEditFinance || !projectId || !appUser) throw new Error("Permission denied");
    const billNumber = await generateDocumentNumber('vendorBill');
    const docRef = doc(collection(db, 'vendorBills'));

    const billAmount = normalizeMoney(data.amount);
    const bill: VendorBill = {
      id: docRef.id,
      projectId: projectId,
      projectVendorId: data.projectVendorId || '',
      vendorId: data.vendorId || '',
      termId: data.termId || '',
      billNumber: billNumber,
      billDate: data.billDate || new Date().toISOString().split('T')[0],
      dueDate: data.dueDate || '',
      amount: billAmount,
      paidAmount: 0,
      remainingAmount: billAmount,
      status: 'Draft',
      notes: data.notes || '',
      attachmentUrl: data.attachmentUrl || '',
      createdBy: appUser.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(docRef, bill);
    await logAudit('VendorBill', docRef.id, 'CREATE', null, bill, 'Generated Vendor Bill');

    if (bill.termId) {
      try {
        const termRef = doc(db, 'vendorPaymentTerms', bill.termId);
        const termDoc = await getDoc(termRef);
        if (termDoc.exists()) {
          const currentInvoiced = normalizeMoney(termDoc.data().invoicedAmount);
          await updateDoc(termRef, { invoicedAmount: currentInvoiced + bill.amount });
        }
      } catch (e) {
        console.warn("Vendor term invoiced amount update note:", e);
      }
    }

    return docRef.id;
  };

  const updateVendorBillStatus = async (id: string, status: VendorBillStatus, logReason?: string) => {
    if (!canEditFinance) throw new Error("Permission denied");
    const billRef = doc(db, 'vendorBills', id);
    const billDoc = await getDoc(billRef);
    if (!billDoc.exists()) return;
    const oldData = billDoc.data() as VendorBill;
    await updateDoc(billRef, { status, updatedAt: new Date().toISOString() });

    let action: FinancialAuditLog['action'] = 'UPDATE';
    if (status === 'Void') action = 'VOID';
    else if (status === 'Cancelled') action = 'CANCEL';

    await logAudit('VendorBill', id, action, oldData, { ...oldData, status }, logReason || `Changed status to ${status}`);
  };

  const voidVendorBill = async (id: string, reason?: string) => {
    return updateVendorBillStatus(id, 'Void', reason || 'Voided by user');
  };

  // --- CRUD Vendor Payments (Atomic Transaction) ---
  const createVendorPayment = async (data: Partial<VendorPayment>) => {
    if (!canEditFinance || !projectId || !appUser) throw new Error("Permission denied");

    return await runTransaction(db, async (transaction) => {
      const paymentNumber = await generateDocumentNumber('vendorPayment');
      const docRef = doc(collection(db, 'vendorPayments'));
      const paymentAmount = normalizeMoney(data.amount);

      let billData: VendorBill | null = null;
      let billRef = null;
      if (data.billId) {
        billRef = doc(db, 'vendorBills', data.billId);
        const billSnap = await transaction.get(billRef);
        if (billSnap.exists()) {
          billData = billSnap.data() as VendorBill;
          const currentPaid = normalizeMoney(billData.paidAmount);
          const valResult = validateVendorPaymentMutation(
            paymentAmount,
            billData.amount,
            currentPaid
          );
          if (!valResult.isValid) {
            throw new Error(valResult.error || "Validasi pembayaran vendor gagal.");
          }
        }
      }

      const payment: VendorPayment = {
        id: docRef.id,
        projectId: projectId,
        projectVendorId: data.projectVendorId || '',
        vendorId: data.vendorId || '',
        billId: data.billId || '',
        paymentNumber: paymentNumber,
        paymentDate: data.paymentDate || new Date().toISOString().split('T')[0],
        amount: paymentAmount,
        paymentMethod: data.paymentMethod || 'Transfer Bank',
        referenceNumber: data.referenceNumber || '',
        bankSource: data.bankSource || '',
        attachmentUrl: data.attachmentUrl || '',
        status: data.status || 'Confirmed',
        notes: data.notes || '',
        createdBy: appUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      transaction.set(docRef, payment);

      if (payment.status === 'Confirmed' && billData && billRef) {
        const currentPaid = normalizeMoney(billData.paidAmount);
        const newPaid = currentPaid + paymentAmount;
        const newRemaining = Math.max(0, billData.amount - newPaid);
        const newStatus = newPaid >= billData.amount ? 'Paid' : newPaid > 0 ? 'Partial Paid' : billData.status;

        transaction.update(billRef, {
          paidAmount: newPaid,
          remainingAmount: newRemaining,
          status: newStatus,
          updatedAt: new Date().toISOString()
        });
      }

      const logRef = doc(collection(db, 'financialAuditLogs'));
      transaction.set(logRef, {
        id: logRef.id,
        projectId: projectId,
        transactionType: 'VendorPayment',
        transactionId: docRef.id,
        action: 'CREATE',
        userId: appUser.uid,
        userName: appUser.name || 'Unknown User',
        oldValue: null,
        newValue: payment,
        reason: 'Recorded Vendor Payment',
        createdAt: new Date().toISOString()
      });

      return docRef.id;
    });
  };

  const updateVendorPaymentStatus = async (id: string, status: VendorPaymentStatus, logReason?: string) => {
    if (!canEditFinance) throw new Error("Permission denied");
    const payRef = doc(db, 'vendorPayments', id);
    const payDoc = await getDoc(payRef);
    if (!payDoc.exists()) return;
    const oldData = payDoc.data() as VendorPayment;
    await updateDoc(payRef, { status, updatedAt: new Date().toISOString() });

    let action: FinancialAuditLog['action'] = 'UPDATE';
    if (status === 'Cancelled') action = 'CANCEL';

    await logAudit('VendorPayment', id, action, oldData, { ...oldData, status }, logReason || `Payment status changed to ${status}`);
  };

  return (
    <VendorContext.Provider value={{
      vendors,
      projectVendors,
      vendorPaymentTerms,
      vendorBills,
      vendorPayments,
      vendorLogs,
      loadingVendor,

      createVendor,
      updateVendor,
      deleteVendor,

      createProjectVendor,
      updateProjectVendor,
      deleteProjectVendor,
      updateProjectVendorWorkStatus,

      createVendorPaymentTerm,
      updateVendorPaymentTerm,
      deleteVendorPaymentTerm,
      reorderVendorPaymentTerms,

      createVendorBill,
      updateVendorBillStatus,
      voidVendorBill,

      createVendorPayment,
      updateVendorPaymentStatus
    }}>
      {children}
    </VendorContext.Provider>
  );
};
