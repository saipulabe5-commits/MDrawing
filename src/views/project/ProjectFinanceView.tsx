import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Card, SegmentedControl } from '../../components/ui';
import { QuotationsTab } from './finance/QuotationsTab';
import { FinanceTermsTab } from './finance/FinanceTermsTab';
import { InvoicesTab } from './finance/InvoicesTab';
import { PaymentsTab } from './finance/PaymentsTab';
import { ExpensesTab } from './finance/ExpensesTab';
import { CashflowTab } from './finance/CashflowTab';
import { ProfitLossTab } from './finance/ProfitLossTab';
import { BudgetVsActualTab } from './finance/BudgetVsActualTab';
import { ProjectDocumentsTab } from './finance/ProjectDocumentsTab';
import { AuditLogsTab } from './finance/AuditLogsTab';

export function ProjectFinanceView() {
  const { loadingFinance } = useFinance();
  const { role, currentUser, canViewProfit } = usePermissions();
  const [activeTab, setActiveTab] = useState('quotations');

  const canViewFinance = role === 'OWNER' || currentUser?.canViewFinance === true;

  if (!canViewFinance) {
    return <div className="p-4 text-center">Anda tidak memiliki akses ke modul Keuangan.</div>;
  }

  if (loadingFinance) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabOptions = [
    { label: 'Penawaran', value: 'quotations' },
    { label: 'Termin', value: 'terms' },
    { label: 'Invoice', value: 'invoices' },
    { label: 'Pembayaran', value: 'payments' },
    { label: 'Biaya Ops', value: 'expenses' },
    { label: 'Arus Kas', value: 'cashflow' },
    ...(canViewProfit() ? [{ label: 'Laba Rugi', value: 'pnl' }] : []),
    { label: 'Budget vs Actual', value: 'budget' },
    { label: 'Dokumen', value: 'documents' },
    { label: 'Audit Log', value: 'logs' },
  ];

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto pb-1">
        <SegmentedControl
          options={tabOptions}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
        {activeTab === 'quotations' && <QuotationsTab />}
        {activeTab === 'terms' && <FinanceTermsTab />}
        {activeTab === 'invoices' && <InvoicesTab />}
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'expenses' && <ExpensesTab />}
        {activeTab === 'cashflow' && <CashflowTab />}
        {activeTab === 'pnl' && canViewProfit() && <ProfitLossTab />}
        {activeTab === 'budget' && <BudgetVsActualTab />}
        {activeTab === 'documents' && <ProjectDocumentsTab />}
        {activeTab === 'logs' && <AuditLogsTab />}
      </div>
    </div>
  );
}
