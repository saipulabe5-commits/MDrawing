import React from 'react';
import { useParams } from 'react-router-dom';
import { useFinance } from '../../../context/FinanceContext';
import { useVendor } from '../../../context/VendorContext';
import { useExpense } from '../../../context/ExpenseContext';
import { useProjects } from '../../../context/ProjectContext';
import { useDocument } from '../../../context/DocumentContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { Button, Card, Badge } from '../../../components/ui';
import { Download, TrendingUp, TrendingDown, Percent, Target, ShieldAlert } from 'lucide-react';
import { generateProfitLossReportPdf } from '../../../lib/exportUtils';
import toast from 'react-hot-toast';

export function ProfitLossTab() {
  const { id: projectId } = useParams<{ id: string }>();
  const { projects } = useProjects();
  const { quotations } = useFinance();
  const { vendorBills, projectVendors } = useVendor();
  const { expenses } = useExpense();
  const { companySettings, recordGeneratedDocument } = useDocument();
  const { canViewProfit, currentUser } = usePermissions();

  const project = projects.find((p) => p.id === projectId);

  if (!canViewProfit()) {
    return (
      <div className="py-12 text-center max-w-md mx-auto space-y-3">
        <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
          Akses Terbatas: Laba Rugi Proyek
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
          Informasi kalkulasi laba rugi dan marjin profit proyek hanya dapat diakses oleh peran Owner, Admin, atau akun yang memiliki izin eksplisit `canViewProfit`.
        </p>
      </div>
    );
  }

  // 1. Contract Value (Revenue)
  const approvedQuotation = quotations.find((q) => q.status === 'Approved' || q.status === 'Sent');
  const contractValue = project?.contractValue || approvedQuotation?.grandTotal || 0;

  // 2. Cost of Subcontractors (Vendor Cost)
  // Use vendor bills if any, or project vendor contract values
  const totalVendorBills = vendorBills
    .filter((b) => b.status !== 'Cancelled' && b.status !== 'Void')
    .reduce((sum, b) => sum + b.amount, 0);

  const totalVendorContract = projectVendors.reduce((sum, pv) => sum + (pv.contractValue || 0), 0);
  const totalVendorCost = totalVendorBills > 0 ? totalVendorBills : totalVendorContract;

  // 3. Gross Profit
  const grossProfit = contractValue - totalVendorCost;
  const grossMargin = contractValue > 0 ? (grossProfit / contractValue) * 100 : 0;

  // 4. Operating Expenses
  const totalExpenses = expenses
    .filter((e) => e.status === 'Approved' || e.status === 'Paid')
    .reduce((sum, e) => sum + e.amount, 0);

  // 5. Net Profit
  const netProfit = grossProfit - totalExpenses;
  const netMargin = contractValue > 0 ? (netProfit / contractValue) * 100 : 0;

  // Target comparison
  const expectedProfit = project?.expectedProfit || 0;
  const varianceFromTarget = netProfit - expectedProfit;

  const handleExportPdf = () => {
    if (!project) return;
    generateProfitLossReportPdf(
      project,
      {
        contractValue,
        totalVendorCost,
        grossProfit,
        totalExpenses,
        netProfit,
        profitMargin: netMargin,
        expectedProfit,
      },
      companySettings
    );

    recordGeneratedDocument({
      projectId: project.id,
      projectName: project.projectName,
      documentType: 'ProfitLossReport',
      documentNumber: `PNL-${project.projectCode}-${new Date().toISOString().slice(0, 10)}`,
      title: `Laporan Laba Rugi - ${project.projectName}`,
      version: 1,
      fileFormat: 'PDF',
      createdBy: currentUser?.uid || '',
      createdByName: currentUser?.name || 'User',
    });

    toast.success('Laporan Laba Rugi PDF berhasil diunduh');
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header & Print Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Laporan Laba Rugi Proyek (Profit & Loss)
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Kalkulasi performa finansial riil berdasarkan tagihan klien, subkon, dan biaya operasional.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExportPdf}>
          <Download className="w-4 h-4 mr-1.5" />
          Cetak Laporan P&L PDF
        </Button>
      </div>

      {/* Top 3 High Level KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white/70 dark:bg-white/5 border border-[var(--color-border)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] font-medium">
            <span>LABA KOTOR (GROSS)</span>
            <span className="text-xs font-semibold">{grossMargin.toFixed(1)}%</span>
          </div>
          <p className={`text-2xl font-bold mt-2 ${grossProfit >= 0 ? 'text-[var(--color-text-primary)]' : 'text-rose-500'}`}>
            Rp {grossProfit.toLocaleString('id-ID')}
          </p>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
            Pendapatan dikurangi beban subkon
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white/70 dark:bg-white/5 border border-[var(--color-border)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] font-medium">
            <span>LABA BERSIH (NET)</span>
            <span className={`text-xs font-semibold ${netMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {netMargin.toFixed(1)}%
            </span>
          </div>
          <p className={`text-2xl font-bold mt-2 ${netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            Rp {netProfit.toLocaleString('id-ID')}
          </p>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
            Setelah dikurangi seluruh pengeluaran
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white/70 dark:bg-white/5 border border-[var(--color-border)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] font-medium">
            <span>TARGET PROFIT</span>
            {expectedProfit > 0 && (
              <span className={`text-xs font-semibold ${varianceFromTarget >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {varianceFromTarget >= 0 ? 'Tercapai' : 'Di Bawah Target'}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold mt-2 text-[var(--color-text-primary)]">
            Rp {expectedProfit.toLocaleString('id-ID')}
          </p>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
            Varians: Rp {varianceFromTarget.toLocaleString('id-ID')}
          </span>
        </div>
      </div>

      {/* Financial Statement Table Card */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-white/40 dark:bg-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex justify-between items-center">
          <span className="font-semibold text-sm text-[var(--color-text-primary)]">
            Struktur Laporan Finansial Proyek
          </span>
          <Badge variant="outline">{project?.projectCode}</Badge>
        </div>

        <div className="divide-y divide-[var(--color-border)] text-sm">
          {/* Revenue */}
          <div className="px-6 py-3.5 flex justify-between items-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <div>
              <span className="font-medium text-[var(--color-text-primary)]">1. Nilai Kontrak Proyek (Pendapatan)</span>
              <p className="text-xs text-[var(--color-text-secondary)]">Nilai kontrak yang disepakati dengan klien</p>
            </div>
            <span className="font-semibold text-base text-[var(--color-text-primary)]">
              Rp {contractValue.toLocaleString('id-ID')}
            </span>
          </div>

          {/* Subcontractor Costs */}
          <div className="px-6 py-3.5 flex justify-between items-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors bg-rose-500/5">
            <div>
              <span className="font-medium text-rose-600 dark:text-rose-400">
                2. Beban Pokok Produksi (Subkon & Vendor)
              </span>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Total kontrak & tagihan pihak ketiga ({projectVendors.length} Subkon)
              </p>
            </div>
            <span className="font-semibold text-base text-rose-600 dark:text-rose-400">
              (Rp {totalVendorCost.toLocaleString('id-ID')})
            </span>
          </div>

          {/* Gross Profit Divider Row */}
          <div className="px-6 py-4 flex justify-between items-center bg-[var(--color-bg)]/80 font-semibold border-y border-[var(--color-border)]">
            <div>
              <span className="text-[var(--color-text-primary)]">LABA KOTOR (GROSS PROFIT)</span>
              <span className="ml-3 text-xs font-normal text-[var(--color-text-secondary)]">
                Margin Kotor: {grossMargin.toFixed(1)}%
              </span>
            </div>
            <span className="text-lg text-[var(--color-text-primary)]">
              Rp {grossProfit.toLocaleString('id-ID')}
            </span>
          </div>

          {/* Operational Expenses */}
          <div className="px-6 py-3.5 flex justify-between items-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors bg-amber-500/5">
            <div>
              <span className="font-medium text-amber-600 dark:text-amber-400">
                3. Biaya Operasional Proyek (Project Expenses)
              </span>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Site visit, printing gambar, konsumsi, transport, ATK ({expenses.length} Item)
              </p>
            </div>
            <span className="font-semibold text-base text-amber-600 dark:text-amber-400">
              (Rp {totalExpenses.toLocaleString('id-ID')})
            </span>
          </div>

          {/* Net Profit Summary Row */}
          <div className="px-6 py-5 flex justify-between items-center bg-emerald-500/10 dark:bg-emerald-950/30">
            <div>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                LABA BERSIH PROYEK (NET PROFIT)
              </span>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Marjin Bersih: <strong className="text-emerald-600 dark:text-emerald-400">{netMargin.toFixed(1)}%</strong> terhadap nilai kontrak
              </p>
            </div>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              Rp {netProfit.toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
