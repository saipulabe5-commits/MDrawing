import { useProjects } from './ProjectContext';
import { financeCommand, apiRequest } from '../lib/commandClient';
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
  const hasProjectAccess = useProjects().projects.some(p=>p.id===projectId);

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

    setProjectVendors([]);setVendorPaymentTerms([]);setVendorBills([]);setVendorPayments([]);setVendorLogs([]);
    setLoadingVendor(true);

    // 1. Fetch Global Vendors
    const qVendors = query(collection(db, 'vendors'));
    const unsubVendors = onSnapshot(qVendors, (snapshot) => {
      setVendors(snapshot.docs.map(doc => doc.data() as Vendor).filter((d:any)=>!d.isArchived && d.status!=="Cancelled"));
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
      setProjectVendors(snapshot.docs.map(doc => doc.data() as ProjectVendor).filter((d:any)=>!d.isArchived && d.status!=="Cancelled"));
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
      setVendorPaymentTerms(snapshot.docs.map(doc => doc.data() as VendorPaymentTerm).filter((d:any)=>!d.isArchived && d.status!=="Cancelled"));
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

  const deleteVendor = async (id: string) => { await apiRequest('/api/master/archive',{collection:'vendors',id}); };

  // --- CRUD Project Vendor Contracts ---
  const createProjectVendor = async (data: any) => { const result = await financeCommand('projectVendors','create',{...data,projectId:data.projectId || projectId},undefined,''); return result.id; };

  const updateProjectVendor = async (id: string, data: any, logReason?: string) => { const result = await financeCommand('projectVendors','update',{...data,projectId:projectId},id,logReason || ''); return result.id; };

  const deleteProjectVendor = async (id: string) => { const result = await financeCommand('projectVendors','delete',{...{},projectId:projectId},id,''); return result.id; };

  const updateProjectVendorWorkStatus = async (id: string, status: any, logReason?: string) => { const result = await financeCommand('projectVendors','update',{...{workStatus:status},projectId:projectId},id,logReason || ''); return result.id; };

  // --- CRUD Vendor Payment Terms ---
  const createVendorPaymentTerm = async (data: any) => { const result = await financeCommand('vendorPaymentTerms','create',{...data,projectId:data.projectId || projectId},undefined,''); return result.id; };

  const updateVendorPaymentTerm = async (id: string, data: any, logReason?: string) => { const result = await financeCommand('vendorPaymentTerms','update',{...data,projectId:projectId},id,logReason || ''); return result.id; };

  const deleteVendorPaymentTerm = async (id: string) => { const result = await financeCommand('vendorPaymentTerms','delete',{...{},projectId:projectId},id,''); return result.id; };

  const reorderVendorPaymentTerms = async (terms: VendorPaymentTerm[]) => { for(let i=0;i<terms.length;i++) await updateVendorPaymentTerm(terms[i].id,{sortOrder:i}); };

  // --- CRUD Vendor Bills ---
  const createVendorBill = async (data: any) => { const result = await financeCommand('vendorBills','create',{...data,projectId:data.projectId || projectId},undefined,''); return result.id; };

  const updateVendorBillStatus = async (id: string, status: any, logReason?: string) => { const result = await financeCommand('vendorBills','status',{...{status},projectId:projectId},id,logReason || ''); return result.id; };

  const voidVendorBill = async (id: string, reason?: string) => {
    return updateVendorBillStatus(id, 'Void', reason || 'Voided by user');
  };

  // --- CRUD Vendor Payments (Atomic Transaction) ---
  const createVendorPayment = async (data: any) => { const result = await financeCommand('vendorPayments','create',{...data,projectId:data.projectId || projectId},undefined,''); return result.id; };

  const updateVendorPaymentStatus = async (id: string, status: any, logReason?: string) => { const result = await financeCommand('vendorPayments','status',{...{status},projectId:projectId},id,logReason || ''); return result.id; };

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
