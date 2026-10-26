import { useProjects } from './ProjectContext';
import toast from 'react-hot-toast';
import { financeCommand, apiRequest } from '../lib/commandClient';
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

  const {projects}=useProjects();
  const scopeIds=projects.map(p=>p.id).sort().join(',');
  // Fetch Project Expenses
  useEffect(()=>{
  setExpenses([]);setLoadingExpense(true);
  if(!user||!canViewFinance){setLoadingExpense(false);return;}
  const ids=projectId?(projects.some(p=>p.id===projectId)?[projectId]:[]):scopeIds.split(',').filter(Boolean);
  if(!ids.length){setLoadingExpense(false);return;}
  const chunks:any[][]=[];for(let i=0;i<ids.length;i+=30)chunks.push(ids.slice(i,i+30));
  const lists=new Map<number,any[]>();let live=true;
  const stop=chunks.map((part,i)=>onSnapshot(query(collection(db,'projectExpenses'),where('projectId','in',part)),snap=>{if(!live)return;lists.set(i,snap.docs.map(d=>({...d.data(),id:d.id})));setExpenses([...lists.values()].flat().sort((a,b)=>String(b.expenseDate||'').localeCompare(String(a.expenseDate||''))));setLoadingExpense(false);},e=>{if(!live)return;setExpenses([]);setLoadingExpense(false);toast.error('Data keuangan belum dapat dimuat: '+e.message,{id:'projectExpenses-load'});}));
  return()=>{live=false;stop.forEach(f=>f());};
},[user,canViewFinance,projectId,scopeIds]);

  // Fetch Manual Cashflow Entries
  useEffect(()=>{
  setCashflowEntries([]);
  if(!user||!canViewFinance){return;}
  const ids=projectId?(projects.some(p=>p.id===projectId)?[projectId]:[]):scopeIds.split(',').filter(Boolean);
  if(!ids.length){return;}
  const chunks:any[][]=[];for(let i=0;i<ids.length;i+=30)chunks.push(ids.slice(i,i+30));
  const lists=new Map<number,any[]>();let live=true;
  const stop=chunks.map((part,i)=>onSnapshot(query(collection(db,'cashflowEntries'),where('projectId','in',part)),snap=>{if(!live)return;lists.set(i,snap.docs.map(d=>({...d.data(),id:d.id})));setCashflowEntries([...lists.values()].flat().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))));},e=>{if(!live)return;setCashflowEntries([]);toast.error('Data keuangan belum dapat dimuat: '+e.message,{id:'cashflowEntries-load'});}));
  return()=>{live=false;stop.forEach(f=>f());};
},[user,canViewFinance,projectId,scopeIds]);

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

  const createExpense = async (data: any) => { const result = await financeCommand('projectExpenses','create',{...data,projectId:data.projectId || projectId},undefined,''); return result.id; };

  const updateExpense = async (id: string, data: any, logReason?: string) => { const result = await financeCommand('projectExpenses','update',{...data,projectId:projectId},id,logReason || ''); return result.id; };

  const updateExpenseStatus = async (id: string, status: any, logReason?: string) => { const result = await financeCommand('projectExpenses','status',{...{status},projectId:projectId},id,logReason || ''); return result.id; };

  const deleteExpense = async (id: string) => { const result = await financeCommand('projectExpenses','delete',{...{},projectId:projectId},id,''); return result.id; };

  const createCashflowEntry = async (data: any) => { const result = await financeCommand('cashflowEntries','create',{...data,projectId:data.projectId || projectId},undefined,''); return result.id; };

  const deleteCashflowEntry = async (id: string) => { const result = await financeCommand('cashflowEntries','delete',{...{},projectId:projectId},id,''); return result.id; };

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
