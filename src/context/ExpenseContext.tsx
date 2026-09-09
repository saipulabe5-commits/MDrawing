import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, doc, getDoc, getDocs, onSnapshot, query, where, 
  runTransaction, setDoc, updateDoc, deleteDoc, orderBy 
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { ProjectExpense, CashflowEntry, ProjectExpenseStatus, FinancialAuditLog } from '../types';
import { hasCapability, isCompanyWideFinanceRole } from '../security/authorization';

interface ExpenseContextType {
  expenses: ProjectExpense[];
  cashflowEntries: CashflowEntry[];
  loadingExpense: boolean;
  createExpense: (data: Partial<ProjectExpense>) => Promise<string>;
  updateExpense: (id: string, data: Partial<ProjectExpense>, logReason?: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  updateExpenseStatus: (id: string, status: ProjectExpenseStatus, logReason?: string) => Promise<void>;
  createCashflowEntry: (data: Partial<CashflowEntry>) => Promise<string>;
  deleteCashflowEntry: (id: string) => Promise<void>;
}

const ExpenseContext = createContext<ExpenseContextType | null>(null);

export const useExpense = () => {
  const context = useContext(ExpenseContext);
  if (!context) throw new Error("useExpense must be used within ExpenseProvider");
  return context;
};

export const ExpenseProvider: React.FC<{ projectId?: string; children: React.ReactNode }> = ({ projectId, children }) => {
  const { user, appUser } = useAuth();
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [cashflowEntries, setCashflowEntries] = useState<CashflowEntry[]>([]);
  const [loadingExpense, setLoadingExpense] = useState(true);

  const canViewFinance = hasCapability(appUser, 'canViewFinance');
  const canEditFinance = hasCapability(appUser, 'canEditFinance');

  // Fetch Project Expenses
  useEffect(() => {
    if (!user || !canViewFinance) {
      setExpenses([]);
      setLoadingExpense(false);
      return;
    }

    const isCompanyWide = isCompanyWideFinanceRole(appUser);
    let q;
    if (projectId) {
      q = query(collection(db, 'projectExpenses'), where('projectId', '==', projectId), orderBy('expenseDate', 'desc'));
    } else if (isCompanyWide) {
      q = query(collection(db, 'projectExpenses'), orderBy('expenseDate', 'desc'));
    } else {
      const assigned = appUser?.assignedProjectIds || [];
      if (assigned.length === 0) {
        setExpenses([]);
        setLoadingExpense(false);
        return;
      }
      q = query(collection(db, 'projectExpenses'), where('projectId', 'in', assigned.slice(0, 30)), orderBy('expenseDate', 'desc'));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ProjectExpense[] = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ProjectExpense));
        setExpenses(list);
        setLoadingExpense(false);
      },
      (error) => {
        console.error("Error fetching project expenses:", error);
        setLoadingExpense(false);
      }
    );

    return () => unsubscribe();
  }, [user, appUser, projectId, canViewFinance]);

  // Fetch Manual Cashflow Entries
  useEffect(() => {
    if (!user || !canViewFinance) {
      setCashflowEntries([]);
      return;
    }

    const isCompanyWide = isCompanyWideFinanceRole(appUser);
    let q;
    if (projectId) {
      q = query(collection(db, 'cashflowEntries'), where('projectId', '==', projectId), orderBy('date', 'desc'));
    } else if (isCompanyWide) {
      q = query(collection(db, 'cashflowEntries'), orderBy('date', 'desc'));
    } else {
      const assigned = appUser?.assignedProjectIds || [];
      if (assigned.length === 0) {
        setCashflowEntries([]);
        return;
      }
      q = query(collection(db, 'cashflowEntries'), where('projectId', 'in', assigned.slice(0, 30)), orderBy('date', 'desc'));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CashflowEntry[] = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as CashflowEntry));
        setCashflowEntries(list);
      },
      (error) => {
        console.error("Error fetching cashflow entries:", error);
      }
    );

    return () => unsubscribe();
  }, [user, appUser, projectId, canViewFinance]);

  const getNextExpenseNumber = async (): Promise<string> => {
    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
    const counterRef = doc(db, 'documentCounters', `EXP_${yearMonth}`);

    let count = 1;
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      if (snap.exists()) {
        count = snap.data().lastNumber + 1;
        tx.update(counterRef, { lastNumber: count });
      } else {
        tx.set(counterRef, { lastNumber: 1, yearMonth, type: 'Expense' });
      }
    });

    return `EXP-${yearMonth}-${count.toString().padStart(4, '0')}`;
  };

  const createExpense = async (data: Partial<ProjectExpense>): Promise<string> => {
    if (!user || !canEditFinance) throw new Error("Akses ditolak: Izin keuangan diperlukan.");
    if (!data.projectId && !projectId) throw new Error("ID Proyek diperlukan.");

    const activeProjectId = data.projectId || projectId!;
    const expenseNumber = await getNextExpenseNumber();
    const expenseRef = doc(collection(db, 'projectExpenses'));
    const id = expenseRef.id;

    const newExpense: ProjectExpense = {
      id,
      projectId: activeProjectId,
      expenseNumber,
      expenseCategory: data.expenseCategory || 'Lain-lain',
      expenseDate: data.expenseDate || new Date().toISOString().slice(0, 10),
      amount: Number(data.amount) || 0,
      description: data.description || '',
      paidTo: data.paidTo || '',
      paymentMethod: data.paymentMethod || 'Kas/Cash',
      attachmentUrl: data.attachmentUrl || '',
      isReimbursable: Boolean(data.isReimbursable),
      status: data.status || 'Draft',
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(expenseRef, newExpense);

    // Write audit log
    const logRef = doc(collection(db, 'financialAuditLogs'));
    const auditLog: FinancialAuditLog = {
      id: logRef.id,
      projectId: activeProjectId,
      transactionType: 'Expense',
      transactionId: id,
      action: 'CREATE',
      userId: user.uid,
      userName: appUser?.name || user.email || 'Pengguna',
      userRole: appUser?.role || 'FINANCE',
      oldValue: null,
      newValue: newExpense,
      reason: `Pencatatan pengeluaran baru ${expenseNumber}`,
      createdAt: new Date().toISOString(),
    };
    await setDoc(logRef, auditLog);

    return id;
  };

  const updateExpense = async (id: string, data: Partial<ProjectExpense>, logReason?: string): Promise<void> => {
    if (!user || !canEditFinance) throw new Error("Akses ditolak: Izin keuangan diperlukan.");

    const expenseRef = doc(db, 'projectExpenses', id);
    const snap = await getDoc(expenseRef);
    if (!snap.exists()) throw new Error("Data pengeluaran tidak ditemukan.");

    const oldExpense = snap.data() as ProjectExpense;
    const updated = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(expenseRef, updated);

    // Audit log
    const logRef = doc(collection(db, 'financialAuditLogs'));
    const auditLog: FinancialAuditLog = {
      id: logRef.id,
      projectId: oldExpense.projectId,
      transactionType: 'Expense',
      transactionId: id,
      action: 'UPDATE',
      userId: user.uid,
      userName: appUser?.name || user.email || 'Pengguna',
      userRole: appUser?.role || 'FINANCE',
      oldValue: oldExpense,
      newValue: { ...oldExpense, ...updated },
      reason: logReason || `Update pengeluaran ${oldExpense.expenseNumber}`,
      createdAt: new Date().toISOString(),
    };
    await setDoc(logRef, auditLog);
  };

  const updateExpenseStatus = async (id: string, status: ProjectExpenseStatus, logReason?: string): Promise<void> => {
    await updateExpense(id, { status }, logReason || `Perubahan status pengeluaran menjadi ${status}`);
  };

  const deleteExpense = async (id: string): Promise<void> => {
    if (!user || !canEditFinance) throw new Error("Akses ditolak: Izin keuangan diperlukan.");
    const expenseRef = doc(db, 'projectExpenses', id);
    const snap = await getDoc(expenseRef);
    if (!snap.exists()) return;
    const oldExpense = snap.data() as ProjectExpense;

    await deleteDoc(expenseRef);

    // Audit log
    const logRef = doc(collection(db, 'financialAuditLogs'));
    const auditLog: FinancialAuditLog = {
      id: logRef.id,
      projectId: oldExpense.projectId,
      transactionType: 'Expense',
      transactionId: id,
      action: 'CANCEL',
      userId: user.uid,
      userName: appUser?.name || user.email || 'Pengguna',
      userRole: appUser?.role || 'FINANCE',
      oldValue: oldExpense,
      newValue: null,
      reason: `Penghapusan pengeluaran ${oldExpense.expenseNumber}`,
      createdAt: new Date().toISOString(),
    };
    await setDoc(logRef, auditLog);
  };

  const createCashflowEntry = async (data: Partial<CashflowEntry>): Promise<string> => {
    if (!user || !canEditFinance) throw new Error("Akses ditolak: Izin keuangan diperlukan.");
    const ref = doc(collection(db, 'cashflowEntries'));
    const entry: CashflowEntry = {
      id: ref.id,
      projectId: data.projectId || projectId,
      date: data.date || new Date().toISOString().slice(0, 10),
      type: data.type || 'OUT',
      category: data.category || 'Lain-lain',
      referenceType: data.referenceType || 'Manual',
      referenceNumber: data.referenceNumber || '',
      description: data.description || '',
      amount: Number(data.amount) || 0,
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
    };
    await setDoc(ref, entry);
    return ref.id;
  };

  const deleteCashflowEntry = async (id: string): Promise<void> => {
    if (!user || !canEditFinance) throw new Error("Akses ditolak: Izin keuangan diperlukan.");
    await deleteDoc(doc(db, 'cashflowEntries', id));
  };

  return (
    <ExpenseContext.Provider
      value={{
        expenses,
        cashflowEntries,
        loadingExpense,
        createExpense,
        updateExpense,
        deleteExpense,
        updateExpenseStatus,
        createCashflowEntry,
        deleteCashflowEntry,
      }}
    >
      {children}
    </ExpenseContext.Provider>
  );
};
