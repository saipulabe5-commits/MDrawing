import React from 'react';
import { useVendor } from '../../../context/VendorContext';
import { useProjects } from '../../../context/ProjectContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { Button, Card } from '../../../components/ui';
import { Download, AlertCircle, CheckCircle2, DollarSign, FileSpreadsheet, Lock } from 'lucide-react';
import { generateHutangReportPdf } from '../../../lib/exportUtils';
import toast from 'react-hot-toast';

interface VendorHutangTabProps {
  projectId: string;
}

export function VendorHutangTab({ projectId }: VendorHutangTabProps) {
  const { projects } = useProjects();
  const currentProject = projects.find(p => p.id === projectId);
  const { vendors, projectVendors, vendorBills, vendorPayments } = useVendor();
  const { canViewVendorCost, canExportFinanceReport } = usePermissions();

  const canSeeCost = canViewVendorCost();
  const canExport = canExportFinanceReport();

  // Scoped strictly to current active project
  const currentProjectVendors = projectVendors.filter(pv => pv.projectId === projectId);
  const currentProjectBills = vendorBills.filter(b => b.projectId === projectId);
  const currentProjectPayments = vendorPayments.filter(p => p.projectId === projectId);

  // Metrics calculations
  const totalContract = currentProjectVendors.reduce((acc, pv) => acc + (pv.contractValue || 0), 0);
  const activeBills = currentProjectBills.filter(b => !['Void', 'Cancelled'].includes(b.status));
  const totalBilled = activeBills.reduce((acc, b) => acc + (b.amount || 0), 0);
  const totalPaid = activeBills.reduce((acc, b) => acc + (b.paidAmount || 0), 0);
  const totalOutstanding = Math.max(0, totalBilled - totalPaid);

  const now = new Date();
  const overdueBills = activeBills.filter(b => 
    b.remainingAmount > 0 && b.dueDate && new Date(b.dueDate) < now
  );
  const totalOverdue = overdueBills.reduce((acc, b) => acc + b.remainingAmount, 0);

  const handleExportPdf = () => {
    if (!canExport) {
      toast.error('Anda tidak memiliki hak akses untuk mengunduh laporan keuangan (canExportFinanceReport)');
      return;
    }
    if (!currentProject) {
      toast.error('Data proyek tidak ditemukan');
      return;
    }

    generateHutangReportPdf(
      currentProject,
      vendors,
      currentProjectVendors,
      activeBills,
      currentProjectPayments
    );
    toast.success('Mengunduh Laporan Hutang Vendor (PDF)...');
  };

  return (
    <div className="space-y-6">
      {/* Header & Export Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Laporan Hutang Vendor (Accounts Payable)
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Ringkasan liabilitas, status jatuh tempo, dan riwayat tagihan vendor proyek
          </p>
        </div>

        <div className="relative group">
          <Button
            onClick={handleExportPdf}
            disabled={!canExport}
            className="flex items-center gap-2"
          >
            {canExport ? <Download className="w-4 h-4" /> : <Lock className="w-4 h-4 opacity-60" />}
            <span>Export Laporan Hutang</span>
          </Button>

          {!canExport && (
            <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block z-20 px-3 py-1.5 bg-black/90 text-white text-[11px] rounded-lg whitespace-nowrap shadow-lg">
              Perlu izin `canExportFinanceReport` untuk mengunduh
            </div>
          )}
        </div>
      </div>

      {/* 5 High-Level Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Metric 1: Total Nilai Kontrak */}
        <Card className="p-4 space-y-1">
          <span className="text-[11px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider block">
            Total Kontrak
          </span>
          <p className="text-base font-bold text-[var(--color-text-primary)]">
            {canSeeCost ? `Rp ${totalContract.toLocaleString('id-ID')}` : 'Terkunci'}
          </p>
          <span className="text-[11px] text-[var(--color-text-secondary)]">
            {currentProjectVendors.length} Kontrak rekanan
          </span>
        </Card>

        {/* Metric 2: Total Ditagihkan */}
        <Card className="p-4 space-y-1">
          <span className="text-[11px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider block">
            Total Ditagih
          </span>
          <p className="text-base font-bold text-blue-600 dark:text-blue-400">
            {canSeeCost ? `Rp ${totalBilled.toLocaleString('id-ID')}` : 'Terkunci'}
          </p>
          <span className="text-[11px] text-[var(--color-text-secondary)]">
            {activeBills.length} Tagihan diterima
          </span>
        </Card>

        {/* Metric 3: Total Terbayar */}
        <Card className="p-4 space-y-1">
          <span className="text-[11px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider block">
            Total Terbayar
          </span>
          <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
            {canSeeCost ? `Rp ${totalPaid.toLocaleString('id-ID')}` : 'Terkunci'}
          </p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            {totalBilled > 0 ? `${Math.round((totalPaid / totalBilled) * 100)}% dari tagihan` : '0%'}
          </span>
        </Card>

        {/* Metric 4: Sisa Hutang Berjalan */}
        <Card className="p-4 space-y-1">
          <span className="text-[11px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider block">
            Sisa Hutang
          </span>
          <p className="text-base font-bold text-amber-600 dark:text-amber-400">
            {canSeeCost ? `Rp ${totalOutstanding.toLocaleString('id-ID')}` : 'Terkunci'}
          </p>
          <span className="text-[11px] text-[var(--color-text-secondary)]">
            Kewajiban aktif
          </span>
        </Card>

        {/* Metric 5: Jatuh Tempo */}
        <Card className={`p-4 space-y-1 ${totalOverdue > 0 ? 'border-red-500/30 bg-red-500/5' : ''}`}>
          <span className="text-[11px] font-medium text-red-600 dark:text-red-400 uppercase tracking-wider block">
            Jatuh Tempo
          </span>
          <p className="text-base font-bold text-red-600 dark:text-red-400">
            {canSeeCost ? `Rp ${totalOverdue.toLocaleString('id-ID')}` : 'Terkunci'}
          </p>
          <span className="text-[11px] text-red-500 font-medium">
            {overdueBills.length} Tagihan lewat batas
          </span>
        </Card>
      </div>

      {/* Vendor Liabilities Breakdown Table */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]">
          <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">
            Rincian Kewajiban Per Vendor & Subkon
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-black/5 dark:bg-white/5 text-[var(--color-text-secondary)] uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">Vendor / Rekanan</th>
                <th className="px-4 py-3">Jenis Layanan</th>
                <th className="px-4 py-3 text-right">Nilai Kontrak</th>
                <th className="px-4 py-3 text-right">Total Ditagih</th>
                <th className="px-4 py-3 text-right">Terbayar</th>
                <th className="px-4 py-3 text-right">Sisa Hutang</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-text-primary)]">
              {currentProjectVendors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[var(--color-text-secondary)]">
                    Belum ada data rekanan vendor pada proyek ini.
                  </td>
                </tr>
              ) : (
                currentProjectVendors.map((pv) => {
                  const pvBills = activeBills.filter(b => b.projectVendorId === pv.id);
                  const pvBilled = pvBills.reduce((acc, b) => acc + b.amount, 0);
                  const pvPaid = pvBills.reduce((acc, b) => acc + b.paidAmount, 0);
                  const pvRemaining = Math.max(0, pvBilled - pvPaid);
                  const pvOverdue = pvBills.some(b => b.remainingAmount > 0 && b.dueDate && new Date(b.dueDate) < now);

                  return (
                    <tr key={pv.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-semibold block">{pv.vendorName}</span>
                        <span className="text-[11px] text-[var(--color-text-secondary)]">{pv.scopeOfWork}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          {pv.vendorType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {canSeeCost ? `Rp ${pv.contractValue.toLocaleString('id-ID')}` : 'Terkunci'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-blue-600 dark:text-blue-400">
                        {canSeeCost ? `Rp ${pvBilled.toLocaleString('id-ID')}` : 'Terkunci'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                        {canSeeCost ? `Rp ${pvPaid.toLocaleString('id-ID')}` : 'Terkunci'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-400">
                        {canSeeCost ? `Rp ${pvRemaining.toLocaleString('id-ID')}` : 'Terkunci'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {pvOverdue ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700/60">
                            Lewat Tempo
                          </span>
                        ) : pvRemaining === 0 && pvBilled > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60">
                            Lunas
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                            Aktif
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
