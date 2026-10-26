import { useProjects } from './ProjectContext';
import { setDoc,updateDoc,deleteDoc } from '../lib/quotationWrites';
import { financeCommand, apiRequest } from '../lib/commandClient';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, doc, getDoc, getDocs, onSnapshot, query, where, 
  runTransaction, orderBy 
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { 
  Client, Quotation, FinanceTerm, Invoice, ClientPayment, 
  FinancialAuditLog, QuotationItem 
} from '../types';
import { hasCapability, canAccessProject } from '../security/authorization';
import { 
  calculateQuotationTotals, 
  calculateInvoiceTotals, 
  calculateInvoicePaymentSync, 
  validateClientPaymentMutation,
  normalizeMoney 
} from '../engine/financial/financialEngine';

interface FinanceContextType {
  clients: Client[];
  quotations: Quotation[];
  financeTerms: FinanceTerm[];
  invoices: Invoice[];
  clientPayments: ClientPayment[];
  financialLogs: FinancialAuditLog[];
  loadingFinance: boolean;
  
  // Clients
  createClient: (data: Partial<Client>) => Promise<string>;
  updateClient: (id: string, data: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  
  // Quotations
  createQuotation: (data: Partial<Quotation>) => Promise<string>;
  updateQuotation: (id: string, data: Partial<Quotation>, logReason?: string) => Promise<void>;
  updateQuotationStatus: (id: string, status: Quotation['status'], logReason?: string) => Promise<void>;
  
  // Finance Terms
  createFinanceTerm: (data: Partial<FinanceTerm>) => Promise<string>;
  updateFinanceTerm: (id: string, data: Partial<FinanceTerm>) => Promise<void>;
  deleteFinanceTerm: (id: string) => Promise<void>;
  reorderFinanceTerms: (terms: FinanceTerm[]) => Promise<void>;
  
  // Invoices
  createInvoice: (data: Partial<Invoice>) => Promise<string>;
  updateInvoiceStatus: (id: string, status: Invoice['status'], logReason?: string) => Promise<void>;
  
  // Payments
  createPayment: (data: Partial<ClientPayment>) => Promise<string>;
  updatePaymentStatus: (id: string, status: ClientPayment['status'], logReason?: string) => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) throw new Error("useFinance must be used within FinanceProvider");
  return context;
};

export const FinanceProvider: React.FC<{ projectId: string; children: React.ReactNode }> = ({ projectId, children }) => {
  const { user, appUser } = useAuth();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [financeTerms, setFinanceTerms] = useState<FinanceTerm[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>([]);
  const [financialLogs, setFinancialLogs] = useState<FinancialAuditLog[]>([]);
  
  const [loadingFinance, setLoadingFinance] = useState(true);

  const canViewFinance = hasCapability(appUser, 'canViewFinance');
  const canEditFinance = hasCapability(appUser, 'canEditFinance');
  const hasProjectAccess = useProjects().projects.some(p=>p.id===projectId);

  useEffect(() => {
    if (!user || !canViewFinance) {
      setClients([]);
      setQuotations([]);
      setFinanceTerms([]);
      setInvoices([]);
      setClientPayments([]);
      setFinancialLogs([]);
      setLoadingFinance(false);
      return;
    }

    setQuotations([]);setFinanceTerms([]);setInvoices([]);setClientPayments([]);setFinancialLogs([]);
    setLoadingFinance(true);

    const qClients = query(collection(db, 'clients'));
    const unsubClients = onSnapshot(qClients, (snapshot) => {
      setClients(snapshot.docs.map(doc => doc.data() as Client).filter((d:any)=>!d.isArchived && d.status!=="Cancelled"));
    }, (error) => {
      console.error("Error fetching clients:", error);
    });

    if (!projectId || !hasProjectAccess) {
      setQuotations([]);
      setFinanceTerms([]);
      setInvoices([]);
      setClientPayments([]);
      setFinancialLogs([]);
      setLoadingFinance(false);
      return () => unsubClients();
    }

    const qQuots = query(collection(db, 'quotations'), where('projectId', '==', projectId));
    const unsubQuots = onSnapshot(qQuots, (snapshot) => {
      setQuotations(snapshot.docs.map(doc => doc.data() as Quotation));
    }, (error) => {
      console.error("Error fetching quotations:", error);
      setLoadingFinance(false);
    });

    const qTerms = query(collection(db, 'financeTerms'), where('projectId', '==', projectId), orderBy('sortOrder', 'asc'));
    const unsubTerms = onSnapshot(qTerms, (snapshot) => {
      setFinanceTerms(snapshot.docs.map(doc => doc.data() as FinanceTerm).filter((d:any)=>!d.isArchived && d.status!=="Cancelled"));
    }, (error) => {
      console.error("Error fetching terms:", error);
      setLoadingFinance(false);
    });

    const qInvoices = query(collection(db, 'invoices'), where('projectId', '==', projectId));
    const unsubInvoices = onSnapshot(qInvoices, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => doc.data() as Invoice));
    }, (error) => {
      console.error("Error fetching invoices:", error);
      setLoadingFinance(false);
    });

    const qPayments = query(collection(db, 'clientPayments'), where('projectId', '==', projectId));
    const unsubPayments = onSnapshot(qPayments, (snapshot) => {
      setClientPayments(snapshot.docs.map(doc => doc.data() as ClientPayment));
    }, (error) => {
      console.error("Error fetching payments:", error);
      setLoadingFinance(false);
    });

    const qLogs = query(collection(db, 'financialAuditLogs'), where('projectId', '==', projectId), orderBy('createdAt', 'desc'));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      setFinancialLogs(snapshot.docs.map(doc => doc.data() as FinancialAuditLog));
      setLoadingFinance(false);
    }, (error) => {
      console.error("Error fetching audit logs:", error);
      setLoadingFinance(false);
    });

    return () => {
      unsubClients();
      unsubQuots();
      unsubTerms();
      unsubInvoices();
      unsubPayments();
      unsubLogs();
    };
  }, [user, projectId, canViewFinance, hasProjectAccess]);

  // Helper to log audit
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

  const createClient = async (data: Partial<Client>) => {
    if (!canEditFinance) throw new Error("Permission denied");
    const docRef = doc(collection(db, 'clients'));
    const client: Client = {
      id: docRef.id,
      clientName: data.clientName || '',
      companyName: data.companyName || '',
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      taxId: data.taxId || '',
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, client);
    return docRef.id;
  };

  const updateClient = async (id: string, data: Partial<Client>) => {
    if (!canEditFinance) throw new Error("Permission denied");
    await updateDoc(doc(db, 'clients', id), {
      ...data,
      updatedAt: new Date().toISOString()
    });
  };

  const deleteClient = async (id: string) => { await apiRequest('/api/master/archive',{collection:'clients',id}); };

  const generateDocumentNumber = async (type: 'quotation' | 'invoice' | 'payment'): Promise<string> => {
    const counterRef = doc(db, 'documentCounters', type);
    return await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      let sequence = 1;
      let prefix = type === 'quotation' ? 'QUO' : type === 'invoice' ? 'INV' : 'PAY';
      
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

  const createQuotation = async (data: Partial<Quotation>) => {
    if (!canEditFinance || !projectId || !appUser) throw new Error("Permission denied");
    
    const docNumber = 'Nomor diterbitkan server saat tersimpan';
    const { items, subTotal, discount, taxPercentage, tax, grandTotal } = calculateQuotationTotals(
      (data.items || []) as any[], 
      data.discount || 0, 
      data.taxPercentage || 0
    );
    
    const docRef = doc(collection(db, 'quotations'));
    const quo: Quotation = {
      id: docRef.id,
      projectId: projectId,
      clientId: data.clientId || '',
      quotationNumber: docNumber,
      revisionNumber: data.revisionNumber || 0,
      date: data.date || new Date().toISOString().split('T')[0],
      validUntil: data.validUntil || '',
      status: 'DRAFT',
      items: items as any,
      subTotal,
      discount,
      tax,
      taxPercentage,
      grandTotal,
      notes: data.notes || '',
      termsAndConditions: data.termsAndConditions || '',
      createdBy: appUser.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await setDoc(docRef, quo);

    return docRef.id;
  };

  const updateQuotation = async (id: string, data: Partial<Quotation>, logReason?: string) => {
    if (!canEditFinance) throw new Error("Permission denied");
    const quoRef = doc(db, 'quotations', id);
    const quoDoc = await getDoc(quoRef);
    if (!quoDoc.exists()) return;
    
    const oldData = quoDoc.data() as Quotation;
    let updates: any = { ...data, updatedAt: new Date().toISOString() };
    
    if (data.items || data.discount !== undefined || data.taxPercentage !== undefined) {
      const items = data.items || oldData.items;
      const discount = data.discount !== undefined ? data.discount : oldData.discount;
      const taxPercentage = data.taxPercentage !== undefined ? data.taxPercentage : oldData.taxPercentage;
      const calculated = calculateQuotationTotals(items as any[], discount, taxPercentage);
      updates = { 
        ...updates, 
        items: calculated.items,
        subTotal: calculated.subTotal,
        discount: calculated.discount,
        taxPercentage: calculated.taxPercentage,
        tax: calculated.tax,
        grandTotal: calculated.grandTotal
      };
    }
    
    await updateDoc(quoRef, updates);
    const newData = { ...oldData, ...updates };

  };

  const updateQuotationStatus = async (id: string, status: Quotation['status'], logReason?: string) => {
    if (!canEditFinance) throw new Error("Permission denied");
    const quoRef = doc(db, 'quotations', id);
    const quoDoc = await getDoc(quoRef);
    if (!quoDoc.exists()) return;
    
    const oldData = quoDoc.data() as Quotation;
    await updateDoc(quoRef, { status, updatedAt: new Date().toISOString() });
    
    let action: FinancialAuditLog['action'] = 'UPDATE';
    if (status === 'Approved') action = 'APPROVE';
    else if (status === 'Cancelled') action = 'CANCEL';

  };

  const createFinanceTerm = async (data: any) => { const result = await financeCommand('financeTerms','create',{...data,projectId:data.projectId || projectId},undefined,''); return result.id; };

  const updateFinanceTerm = async (id: string, data: any, logReason?: string) => { const result = await financeCommand('financeTerms','update',{...data,projectId:projectId},id,logReason || ''); return result.id; };

  const deleteFinanceTerm = async (id: string) => { const result = await financeCommand('financeTerms','delete',{...{},projectId:projectId},id,''); return result.id; };

  const reorderFinanceTerms = async (terms: FinanceTerm[]) => { for(let i=0;i<terms.length;i++) await updateFinanceTerm(terms[i].id,{sortOrder:i}); };

  const createInvoice = async (data: any) => { const result = await financeCommand('invoices','create',{...data,projectId:data.projectId || projectId},undefined,''); return result.id; };

  const updateInvoiceStatus = async (id: string, status: any, logReason?: string) => { const result = await financeCommand('invoices','status',{...{status},projectId:projectId},id,logReason || ''); return result.id; };

  const createPayment = async (data: any) => { const result = await financeCommand('clientPayments','create',{...data,projectId:data.projectId || projectId},undefined,''); return result.id; };

  const updatePaymentStatus = async (id: string, status: any, logReason?: string) => { const result = await financeCommand('clientPayments','status',{...{status},projectId:projectId},id,logReason || ''); return result.id; };

  return (
    <FinanceContext.Provider value={{
      clients, quotations, financeTerms, invoices, clientPayments, financialLogs, loadingFinance,
      createClient, updateClient, deleteClient,
      createQuotation, updateQuotation, updateQuotationStatus,
      createFinanceTerm, updateFinanceTerm, deleteFinanceTerm, reorderFinanceTerms,
      createInvoice, updateInvoiceStatus,
      createPayment, updatePaymentStatus
    }}>
      {children}
    </FinanceContext.Provider>
  );
};
