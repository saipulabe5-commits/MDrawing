import { projectReport } from '../../engine/financial/reportModel';
import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useFinance } from '../../context/FinanceContext';
import { useExpense } from '../../context/ExpenseContext';
import { useVendor } from '../../context/VendorContext';
import { useProjects } from '../../context/ProjectContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Button, Card, Badge, Input } from '../../components/ui';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Receipt, 
  Plus, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Building2, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  CreditCard
} from 'lucide-react';
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
import { formatCurrency, formatDate } from '../../lib/formatters';
import { generateInvoicePDF, generatePaymentReceiptPDF } from '../../lib/documentGenerator';
import { Invoice, ClientPayment, ProjectExpense, VendorBill } from '../../types';

export function ProjectFinanceView() {
  const { id: projectId } = useParams<{ id: string }>();
  const { projects } = useProjects();
  const { 
    quotations, 
    financeTerms, 
    invoices, 
    clientPayments, 
    loadingFinance 
  } = useFinance();
  const { expenses, cashflowEntries, loadingExpense } = useExpense();
  const { vendorBills, vendorPayments, projectVendors, loadingVendor } = useVendor();
  const { canViewFinance, canViewProfit, canEditFinance, canViewVendorCost } = usePermissions();

  const [activeTab, setActiveTab] = useState<'stream' | 'quotation' | 'terms' | 'invoices' | 'payments' | 'expenses' | 'cashflow' | 'pnl' | 'budget' | 'docs' | 'audit'>('stream');
  const [filterType, setFilterType] = useState<'ALL' | 'INVOICE' | 'PAYMENT' | 'EXPENSE' | 'VENDOR_BILL'>('ALL');
  const [search, setSearch] = useState('');

  const project = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);

  const metrics=projectReport(project,quotations,invoices,clientPayments,projectVendors,vendorBills,vendorPayments,expenses,cashflowEntries);
  // Financial calculations
  const totalContract = metrics.totalContract;

  const totalInvoiced = metrics.totalInvoiced;

  const totalPaid = metrics.totalPaid;

  const totalExpenses = metrics.expensesPaid;

  const totalVendorPaid = metrics.vendorPaid;

  const totalAllExpenses = metrics.totalCashOut;
  const netCash = metrics.netCash;
  const projectedProfit = metrics.projectedProfit;
  const profitMargin = metrics.profitMargin;
  const sisaPiutang = metrics.sisaPiutang;

  // Unified Transaction Stream
  interface UnifiedTx {
    id: string;
    type: 'INVOICE' | 'PAYMENT' | 'EXPENSE' | 'VENDOR_BILL';
    date: string;
    number: string;
    title: string;
    amount: number;
    status: string;
    raw: any;
  }

  const transactionStream = useMemo(() => {
    const list: UnifiedTx[] = [];

    invoices.forEach(inv => {
      list.push({
        id: `inv-${inv.id}`,
        type: 'INVOICE',
        date: inv.date || inv.createdAt,
        number: inv.invoiceNumber,
        title: `Tagihan Klien (Invoice)`,
        amount: inv.grandTotal,
        status: inv.status,
        raw: inv
      });
    });

    clientPayments.forEach(p => {
      list.push({
        id: `pay-${p.id}`,
        type: 'PAYMENT',
        date: p.paymentDate,
        number: p.paymentNumber || 'Kwitansi',
        title: `Pelunasan Klien (${p.paymentMethod})`,
        amount: p.amount,
        status: p.status,
        raw: p
      });
    });

    expenses.forEach(e => {
      list.push({
        id: `exp-${e.id}`,
        type: 'EXPENSE',
        date: e.expenseDate,
        number: e.expenseNumber || 'BIAYA',
        title: `${e.expenseCategory || 'Operasional'} - ${e.description}`,
        amount: e.amount,
        status: e.status,
        raw: e
      });
    });

    vendorBills.forEach(b => {
      list.push({
        id: `vbill-${b.id}`,
        type: 'VENDOR_BILL',
        date: b.billDate,
        number: b.billNumber,
        title: `Tagihan Vendor/Subkon`,
        amount: b.amount,
        status: b.status,
        raw: b
      });
    });

    // Sort descending by date
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, clientPayments, expenses, vendorBills]);

  const filteredStream = useMemo(() => {
    return transactionStream.filter(tx => {
      if (filterType !== 'ALL' && tx.type !== filterType) return false;
      if (search) {
        const query = search.toLowerCase();
        return (
          tx.number.toLowerCase().includes(query) ||
          tx.title.toLowerCase().includes(query) ||
          tx.status.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [transactionStream, filterType, search]);

  if (!canViewFinance()) {
    return (
      <div className="p-8 text-center text-slate-500 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">
        Anda tidak memiliki hak akses untuk melihat data keuangan proyek.
      </div>
    );
  }

  if (loadingFinance || loadingExpense || loadingVendor) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. FINANCIAL KPI SUMMARY STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-[var(--color-surface)] p-3.5 rounded-2xl border border-[var(--color-border)] shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Nilai Kontrak (SPK)</span>
          <span className="text-lg font-bold text-[var(--color-text-primary)] mt-0.5 block truncate">
            {formatCurrency(totalContract)}
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">Komersial Proyek</span>
        </div>

        <div className="bg-[var(--color-surface)] p-3.5 rounded-2xl border border-[var(--color-border)] shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Total Ditagihkan</span>
          <span className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5 block truncate">
            {formatCurrency(totalInvoiced)}
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {totalContract > 0 ? `${Math.round((totalInvoiced / totalContract) * 100)}% dari Nilai SPK` : '0%'}
          </span>
        </div>

        <div className="bg-[var(--color-surface)] p-3.5 rounded-2xl border border-[var(--color-border)] shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Kas Masuk (Paid)</span>
          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block truncate">
            {formatCurrency(totalPaid)}
          </span>
          <span className="text-[10px] text-emerald-500 mt-1 block">
            {totalInvoiced > 0 ? `${Math.round((totalPaid / totalInvoiced) * 100)}% Tertagih` : '0%'}
          </span>
        </div>

        <div className="bg-[var(--color-surface)] p-3.5 rounded-2xl border border-[var(--color-border)] shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Sisa Piutang (AR)</span>
          <span className={`text-lg font-bold mt-0.5 block truncate ${sisaPiutang > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
            {formatCurrency(sisaPiutang)}
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">Piutang Berjalan</span>
        </div>

        <div className="bg-[var(--color-surface)] p-3.5 rounded-2xl border border-[var(--color-border)] shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Proyeksi Laba (P&L)</span>
          <span className={`text-lg font-bold mt-0.5 block truncate ${projectedProfit >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-rose-600'}`}>
            {formatCurrency(projectedProfit)}
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Margin: {Math.round(profitMargin)}%
          </span>
        </div>
      </div>

      {/* 2. SUB-NAVIGATION TOOLBAR & FAST ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-surface)] p-3.5 rounded-2xl border border-[var(--color-border)] shadow-xs">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-[var(--color-border)] overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('stream')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'stream'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Arus Transaksi Terpadu
          </button>
          <button
            onClick={() => setActiveTab('quotation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'quotation'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Penawaran (Quotation)
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'terms'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Termin Penagihan
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'invoices'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Invoice ({invoices.length})
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'payments'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Pembayaran ({clientPayments.length})
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'expenses'
                ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Biaya Operasional ({expenses.length})
          </button>
          {canViewProfit() && (
            <button
              onClick={() => setActiveTab('pnl')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'pnl'
                  ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Laba Rugi (P&L)
            </button>
          )}
          <button
            onClick={() => setActiveTab('budget')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'budget'
                ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Budget vs Realisasi
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'docs'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Dokumen & Cetak
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'audit'
                ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Audit Log
          </button>
        </div>

        {canEditFinance() && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => setActiveTab('invoices')}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Buat Invoice</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setActiveTab('payments')}
              className="text-xs font-semibold shadow-xs text-emerald-600 dark:text-emerald-400"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Catat Bayar</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setActiveTab('expenses')}
              className="text-xs font-semibold shadow-xs text-rose-600 dark:text-rose-400"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Input Biaya</span>
            </Button>
          </div>
        )}
      </div>

      {/* 3. UNIFIED TRANSACTION STREAM TABLE */}
      {activeTab === 'stream' && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                Arus Transaksi Finansial Proyek (Unified Stream)
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Rekam jejak tagihan invoice, pelunasan kas, pengeluaran operasional, dan vendor AP.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-[var(--color-border)] text-xs">
                {(['ALL', 'INVOICE', 'PAYMENT', 'EXPENSE', 'VENDOR_BILL'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      filterType === type
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {type === 'ALL' ? 'Semua' : type === 'INVOICE' ? 'Invoice' : type === 'PAYMENT' ? 'Bayar' : type === 'EXPENSE' ? 'Biaya' : 'Vendor'}
                  </button>
                ))}
              </div>

              <div className="w-full sm:w-48">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari transaksi..."
                  className="text-xs h-8"
                />
              </div>
            </div>
          </div>

          {filteredStream.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-[var(--color-border)] rounded-xl">
              <DollarSign className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <h4 className="text-xs font-bold text-[var(--color-text-primary)]">Belum Ada Transaksi Finansial</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Mulai dengan membuat Invoice termin atau mencatat pengeluaran proyek.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-slate-500 dark:text-slate-400 font-semibold bg-slate-50/50 dark:bg-slate-800/50">
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-3">Tipe</th>
                    <th className="py-2.5 px-3">Nomor Ref</th>
                    <th className="py-2.5 px-3">Uraian / Deskripsi</th>
                    <th className="py-2.5 px-3 text-right">Nominal</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {filteredStream.map((tx) => {
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                          {formatDate(tx.date)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.type === 'INVOICE'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : tx.type === 'PAYMENT'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : tx.type === 'EXPENSE'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                          }`}>
                            {tx.type === 'INVOICE' && <FileText className="w-3 h-3" />}
                            {tx.type === 'PAYMENT' && <ArrowDownLeft className="w-3 h-3" />}
                            {tx.type === 'EXPENSE' && <ArrowUpRight className="w-3 h-3" />}
                            {tx.type === 'VENDOR_BILL' && <Building2 className="w-3 h-3" />}
                            <span>{tx.type}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-[var(--color-text-primary)]">
                          {tx.number}
                        </td>
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300 max-w-[240px] truncate">
                          {tx.title}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono font-bold whitespace-nowrap ${
                          tx.type === 'PAYMENT'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : tx.type === 'INVOICE'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {tx.type === 'EXPENSE' || tx.type === 'VENDOR_BILL' ? '- ' : '+ '}
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.status === 'Paid' || tx.status === 'Confirmed' || tx.status === 'Approved'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : tx.status === 'Pending' || tx.status === 'Draft' || tx.status === 'Sent'
                              ? 'bg-blue-500/10 text-blue-600'
                              : 'bg-amber-500/10 text-amber-600'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {tx.type === 'INVOICE' && (
                            <button
                              onClick={() => generateInvoicePDF(tx.raw)}
                              className="text-[11px] font-bold text-blue-600 hover:underline px-2 py-1"
                            >
                              Unduh PDF
                            </button>
                          )}
                          {tx.type === 'PAYMENT' && (
                            <button
                              onClick={() => generatePaymentReceiptPDF(tx.raw)}
                              className="text-[11px] font-bold text-emerald-600 hover:underline px-2 py-1"
                            >
                              Kuitansi PDF
                            </button>
                          )}
                          {tx.type === 'EXPENSE' && (
                            <button
                              onClick={() => setActiveTab('expenses')}
                              className="text-[11px] font-bold text-slate-500 hover:underline px-2 py-1"
                            >
                              Buka Biaya
                            </button>
                          )}
                          {tx.type === 'VENDOR_BILL' && (
                            <button
                              onClick={() => setActiveTab('budget')}
                              className="text-[11px] font-bold text-cyan-600 hover:underline px-2 py-1"
                            >
                              Detail AP
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. CANONICAL SUB-TAB VIEWS (PRESERVES 100% EXISTING CONTROLLERS) */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
        {activeTab === 'quotation' && <QuotationsTab />}
        {activeTab === 'terms' && <FinanceTermsTab />}
        {activeTab === 'invoices' && <InvoicesTab />}
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'expenses' && <ExpensesTab />}
        {activeTab === 'cashflow' && <CashflowTab />}
        {activeTab === 'pnl' && canViewProfit() && <ProfitLossTab />}
        {activeTab === 'budget' && <BudgetVsActualTab />}
        {activeTab === 'docs' && <ProjectDocumentsTab />}
        {activeTab === 'audit' && <AuditLogsTab />}
      </div>
    </div>
  );
}
