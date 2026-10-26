import React from 'react';
import { useParams } from 'react-router-dom';
import { useExpense } from '../../../context/ExpenseContext';
import { useProjects } from '../../../context/ProjectContext';
import { ProjectExpenseCategory } from '../../../types';
import { Badge } from '../../../components/ui';
import { CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';

const CATEGORIES: ProjectExpenseCategory[] = [
  'Site Visit',
  'Printing',
  'Konsumsi',
  'Transport',
  'Software License',
  'Alat Kantor',
  'Subkon Lainnya',
  'Lain-lain',
];

export function BudgetVsActualTab() {
  const { id: projectId } = useParams<{ id: string }>();
  const { projects } = useProjects();
  const { expenses } = useExpense();

  const project = projects.find((p) => p.id === projectId);
  const totalBudget = project?.budgetOtherExpenses || 0;

  // Strict project scoping
  const projectExpenses = expenses.filter((e) => e.projectId === projectId);

  // Realized expenses (Approved or Paid)
  const approvedExpenses = projectExpenses.filter((e) => e.status === 'Approved' || e.status === 'Paid');
  const totalActual = approvedExpenses.reduce((sum, e) => sum + e.amount, 0);

  const overallPct = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;
  const overallRemaining = totalBudget - totalActual;

  // Breakdown by category
  const categoryBreakdown = CATEGORIES.map((cat) => {
    const items = approvedExpenses.filter((e) => e.expenseCategory === cat);
    const actual = items.reduce((sum, e) => sum + e.amount, 0);
    const count = items.length;
    const shareOfTotal = totalActual > 0 ? (actual / totalActual) * 100 : 0;
    return {
      category: cat,
      actual,
      count,
      shareOfTotal,
    };
  }).sort((a, b) => b.actual - a.actual);

  return (
    <div className="space-y-6">
      {/* Overview Progress Card */}
      <div className="p-6 rounded-2xl border border-[var(--color-border)] bg-white/70 dark:bg-white/5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              Kontrol Anggaran Biaya Operasional (Budget vs Actual)
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Memantau realisasi pengeluaran terhadap plafon anggaran yang dialokasikan pada proyek ini.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {overallPct > 100 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                <AlertOctagon className="w-3.5 h-3.5" />
                Over Budget ({overallPct.toFixed(1)}%)
              </span>
            ) : overallPct > 80 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                Mendekati Batas ({overallPct.toFixed(1)}%)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Aman ({overallPct.toFixed(1)}%)
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full h-3.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                overallPct > 100
                  ? 'bg-rose-500'
                  : overallPct > 80
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(overallPct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-[var(--color-text-secondary)]">
            <span>Realisasi: Rp {totalActual.toLocaleString('id-ID')}</span>
            <span>Anggaran Plafon: Rp {totalBudget.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* 3 Metric Mini Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--color-border)]">
          <div>
            <span className="text-xs text-[var(--color-text-secondary)]">Total Anggaran (Plafon)</span>
            <p className="text-lg font-bold text-[var(--color-text-primary)] mt-0.5">
              Rp {totalBudget.toLocaleString('id-ID')}
            </p>
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-secondary)]">Total Realisasi Terpakai</span>
            <p className="text-lg font-bold text-amber-500 mt-0.5">
              Rp {totalActual.toLocaleString('id-ID')}
            </p>
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-secondary)]">Sisa Anggaran Tersedia</span>
            <p className={`text-lg font-bold mt-0.5 ${overallRemaining < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              Rp {overallRemaining.toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      </div>

      {/* Category Breakdown Table */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-white/40 dark:bg-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <h4 className="font-semibold text-sm text-[var(--color-text-primary)]">
            Distribusi Realisasi Pengeluaran per Kategori
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-bg)]/80 text-[var(--color-text-secondary)] text-xs border-b border-[var(--color-border)]">
              <tr>
                <th className="py-3 px-4">Kategori Pengeluaran</th>
                <th className="py-3 px-4 text-center">Jumlah Transaksi</th>
                <th className="py-3 px-4 text-right">Realisasi (Rp)</th>
                <th className="py-3 px-4 text-right">Porsi Pengeluaran</th>
                <th className="py-3 px-4">Proporsi Visual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {categoryBreakdown.map((item) => (
                <tr key={item.category} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 font-medium text-[var(--color-text-primary)]">
                    {item.category}
                  </td>
                  <td className="py-3 px-4 text-center text-xs text-[var(--color-text-secondary)]">
                    {item.count} Transaksi
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-[var(--color-text-primary)]">
                    Rp {item.actual.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-4 text-right text-xs text-[var(--color-text-secondary)]">
                    {item.shareOfTotal.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 w-48">
                    <div className="w-full h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(item.shareOfTotal, 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
