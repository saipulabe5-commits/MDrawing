import React, { useState, useEffect } from 'react';
import { useProjects } from '../context/ProjectContext';
import { useDocument } from '../context/DocumentContext';
import { usePermissions } from '../hooks/usePermissions';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Button, Card, Badge, Input } from '../components/ui';
import { 
  Download, DollarSign, TrendingUp, Briefcase, 
  Layers, Search, Filter, ShieldAlert 
} from 'lucide-react';
import { generateFinancialReportPdf } from '../lib/exportUtils';
import toast from 'react-hot-toast';

interface ProjectFinancialSummary {
  projectId: string;
  projectCode: string;
  projectName: string;
  clientName: string;
  status: string;
  contractValue: number;
  clientPaid: number;
  vendorCost: number;
  expenses: number;
  grossProfit: number;
  netProfit: number;
  netMargin: number;
}

export function FinancialReportsView() {
  const { projects, loadingProjects } = useProjects();
  const { companySettings, recordGeneratedDocument } = useDocument();
  const { canViewFinance, canViewProfit, isCompanyWideFinance, currentUser, appUser } = usePermissions();

  const [loadingData, setLoadingData] = useState(true);
  const [projectSummaries, setProjectSummaries] = useState<ProjectFinancialSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const isCompanyWide = isCompanyWideFinance();
  const assignedProjectIds = appUser?.assignedProjectIds || [];

  // Scoped project list: Company-wide roles see all projects; other roles see only assigned projects
  const scopedProjects = isCompanyWide 
    ? projects 
    : projects.filter((p) => assignedProjectIds.includes(p.id));

  useEffect(() => {
    async function loadFinancialData() {
      if (!canViewFinance()) {
        setLoadingData(false);
        return;
      }

      if (!isCompanyWide && assignedProjectIds.length === 0) {
        setProjectSummaries([]);
        setLoadingData(false);
        return;
      }

      try {
        setLoadingData(true);
        const paymentsByProj: Record<string, number> = {};
        const billsByProj: Record<string, number> = {};
        const expByProj: Record<string, number> = {};

        if (isCompanyWide) {
          // Company-wide roles (OWNER, ADMIN, FINANCE) fetch full dataset
          const [paymentsSnap, billsSnap, expSnap] = await Promise.all([
            getDocs(collection(db, 'clientPayments')),
            getDocs(collection(db, 'vendorBills')),
            getDocs(collection(db, 'projectExpenses')),
          ]);

          paymentsSnap.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'Confirmed' && data.projectId) {
              paymentsByProj[data.projectId] = (paymentsByProj[data.projectId] || 0) + (data.amount || 0);
            }
          });

          billsSnap.forEach((doc) => {
            const data = doc.data();
            if (data.status !== 'Cancelled' && data.status !== 'Void' && data.projectId) {
              billsByProj[data.projectId] = (billsByProj[data.projectId] || 0) + (data.amount || 0);
            }
          });

          expSnap.forEach((doc) => {
            const data = doc.data();
            if ((data.status === 'Approved' || data.status === 'Paid') && data.projectId) {
              expByProj[data.projectId] = (expByProj[data.projectId] || 0) + (data.amount || 0);
            }
          });
        } else {
          // Restricted roles (PROJECT_LEADER, TEAM with canViewFinance):
          // Query ONLY assigned projects with chunking <= 30
          const CHUNK_SIZE = 30;
          const chunks: string[][] = [];
          for (let i = 0; i < assignedProjectIds.length; i += CHUNK_SIZE) {
            chunks.push(assignedProjectIds.slice(i, i + CHUNK_SIZE));
          }

          const [paymentsSnaps, billsSnaps, expSnaps] = await Promise.all([
            Promise.all(chunks.map((chunk) => getDocs(query(collection(db, 'clientPayments'), where('projectId', 'in', chunk))))),
            Promise.all(chunks.map((chunk) => getDocs(query(collection(db, 'vendorBills'), where('projectId', 'in', chunk))))),
            Promise.all(chunks.map((chunk) => getDocs(query(collection(db, 'projectExpenses'), where('projectId', 'in', chunk))))),
          ]);

          paymentsSnaps.forEach((snapGroup) => {
            snapGroup.forEach((doc) => {
              const data = doc.data();
              if (data.status === 'Confirmed' && data.projectId) {
                paymentsByProj[data.projectId] = (paymentsByProj[data.projectId] || 0) + (data.amount || 0);
              }
            });
          });

          billsSnaps.forEach((snapGroup) => {
            snapGroup.forEach((doc) => {
              const data = doc.data();
              if (data.status !== 'Cancelled' && data.status !== 'Void' && data.projectId) {
                billsByProj[data.projectId] = (billsByProj[data.projectId] || 0) + (data.amount || 0);
              }
            });
          });

          expSnaps.forEach((snapGroup) => {
            snapGroup.forEach((doc) => {
              const data = doc.data();
              if ((data.status === 'Approved' || data.status === 'Paid') && data.projectId) {
                expByProj[data.projectId] = (expByProj[data.projectId] || 0) + (data.amount || 0);
              }
            });
          });
        }

        // Map over scoped projects
        const summaries: ProjectFinancialSummary[] = scopedProjects.map((p) => {
          const contractValue = p.contractValue || 0;
          const clientPaid = paymentsByProj[p.id] || 0;
          const vendorCost = billsByProj[p.id] || 0;
          const expenses = expByProj[p.id] || 0;
          const grossProfit = contractValue - vendorCost;
          const netProfit = grossProfit - expenses;
          const netMargin = contractValue > 0 ? (netProfit / contractValue) * 100 : 0;

          return {
            projectId: p.id,
            projectCode: p.projectCode,
            projectName: p.projectName,
            clientName: p.clientName,
            status: p.status,
            contractValue,
            clientPaid,
            vendorCost,
            expenses,
            grossProfit,
            netProfit,
            netMargin,
          };
        });

        setProjectSummaries(summaries);
      } catch (err) {
        console.error('Error calculating scoped financial report:', err);
      } finally {
        setLoadingData(false);
      }
    }

    if (projects.length > 0) {
      loadFinancialData();
    } else if (!loadingProjects) {
      setLoadingData(false);
    }
  }, [projects, loadingProjects, isCompanyWide, assignedProjectIds]);

  if (!canViewFinance()) {
    return (
      <div className="py-16 text-center max-w-md mx-auto space-y-3">
        <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
          Akses Terbatas: Laporan Keuangan
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
          Modul Laporan Keuangan Konsolidasi hanya dapat diakses oleh peran Owner, Admin, atau akun dengan hak akses keuangan.
        </p>
      </div>
    );
  }

  if (!isCompanyWide && assignedProjectIds.length === 0) {
    return (
      <div className="py-16 text-center max-w-md mx-auto space-y-3">
        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center mx-auto">
          <Briefcase className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
          Tidak Ada Proyek yang Ditugaskan
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
          Anda memiliki hak akses keuangan proyek, namun saat ini belum ada proyek yang ditugaskan ke akun Anda. Hubungi Administrator atau Owner untuk penugasan proyek.
        </p>
      </div>
    );
  }

  // Filtered summaries
  const filteredSummaries = projectSummaries.filter((p) => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (
      searchQuery &&
      !p.projectName.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !p.projectCode.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !p.clientName.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  // Consolidated KPIs
  const totalContract = filteredSummaries.reduce((sum, p) => sum + p.contractValue, 0);
  const totalClientPaid = filteredSummaries.reduce((sum, p) => sum + p.clientPaid, 0);
  const totalVendorCost = filteredSummaries.reduce((sum, p) => sum + p.vendorCost, 0);
  const totalExpenses = filteredSummaries.reduce((sum, p) => sum + p.expenses, 0);
  const totalGrossProfit = totalContract - totalVendorCost;
  const totalNetProfit = totalGrossProfit - totalExpenses;
  const consolidatedMargin = totalContract > 0 ? (totalNetProfit / totalContract) * 100 : 0;

  const handleExportPdf = () => {
    const reportData = filteredSummaries.map((p) => ({
      projectName: p.projectName,
      clientName: p.clientName,
      contractValue: p.contractValue,
      totalInvoiced: p.clientPaid,
      totalPaid: p.clientPaid,
      totalVendorCost: p.vendorCost,
      totalExpenses: p.expenses,
      netProfit: p.netProfit,
    }));

    const summaryTotals = {
      totalContractValue: totalContract,
      totalInvoiced: totalClientPaid,
      totalReceived: totalClientPaid,
      totalReceivable: Math.max(0, totalContract - totalClientPaid),
      totalVendorCost,
      totalVendorPaid: totalVendorCost,
      totalVendorPayable: 0,
      totalExpenses,
      netCashflow: totalClientPaid - (totalVendorCost + totalExpenses),
      estimatedConsolidatedProfit: totalNetProfit,
    };

    generateFinancialReportPdf(scopedProjects, summaryTotals, companySettings);

    recordGeneratedDocument({
      projectId: isCompanyWide ? 'ALL' : 'SCOPED',
      projectName: isCompanyWide ? 'Konsolidasi Seluruh Proyek' : `Laporan Keuangan Proyek (${scopedProjects.length} Proyek)`,
      documentType: 'ConsolidatedFinanceReport',
      documentNumber: `REP-${isCompanyWide ? 'CONS' : 'PROJ'}-${new Date().toISOString().slice(0, 10)}`,
      title: isCompanyWide ? 'Laporan Keuangan Konsolidasi Perusahaan' : 'Laporan Keuangan Proyek Tertugaskan',
      version: 1,
      fileFormat: 'PDF',
      createdBy: currentUser?.uid || '',
      createdByName: currentUser?.name || 'User',
    });

    toast.success(isCompanyWide ? 'Laporan Keuangan Konsolidasi PDF berhasil diunduh' : 'Laporan Keuangan Proyek PDF berhasil diunduh');
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Title & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              {isCompanyWide ? 'Laporan Keuangan Konsolidasi' : 'Laporan Keuangan Proyek'}
            </h1>
            {!isCompanyWide && (
              <Badge variant="purple">Akses Terbatas ({scopedProjects.length} Proyek)</Badge>
            )}
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {isCompanyWide
              ? 'Rekapitulasi performa finansial, arus kas, beban subkon, dan profitabilitas seluruh proyek perusahaan.'
              : 'Rekapitulasi performa finansial, arus kas, beban subkon, dan profitabilitas proyek yang ditugaskan kepada Anda.'}
          </p>
        </div>

        <Button onClick={handleExportPdf} size="sm" disabled={filteredSummaries.length === 0}>
          <Download className="w-4 h-4 mr-1.5" />
          {isCompanyWide ? 'Cetak Laporan Konsolidasi PDF' : 'Cetak Laporan Keuangan PDF'}
        </Button>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white/70 dark:bg-white/5 border border-[var(--color-border)] shadow-xs">
          <span className="text-xs text-[var(--color-text-secondary)] font-medium">TOTAL NILAI KONTRAK</span>
          <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1.5">
            Rp {totalContract.toLocaleString('id-ID')}
          </p>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
            Kas Masuk: Rp {totalClientPaid.toLocaleString('id-ID')}
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white/70 dark:bg-white/5 border border-[var(--color-border)] shadow-xs">
          <span className="text-xs text-[var(--color-text-secondary)] font-medium">TOTAL BEBAN SUBKON</span>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1.5">
            Rp {totalVendorCost.toLocaleString('id-ID')}
          </p>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
            Subkontraktor & Vendor Rekanan
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white/70 dark:bg-white/5 border border-[var(--color-border)] shadow-xs">
          <span className="text-xs text-[var(--color-text-secondary)] font-medium">BIAYA OPERASIONAL PROYEK</span>
          <p className="text-2xl font-bold text-amber-500 mt-1.5">
            Rp {totalExpenses.toLocaleString('id-ID')}
          </p>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
            Site visit, cetak gambar, ATK, transport
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white/70 dark:bg-white/5 border border-[var(--color-border)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] font-medium">
            <span>LABA BERSIH BERJALAN</span>
            <span className="font-semibold text-emerald-500">{consolidatedMargin.toFixed(1)}%</span>
          </div>
          <p className={`text-2xl font-bold mt-1.5 ${totalNetProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            Rp {totalNetProfit.toLocaleString('id-ID')}
          </p>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
            Laba Kotor: Rp {totalGrossProfit.toLocaleString('id-ID')}
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <Input
            placeholder="Cari kode, nama proyek, atau klien..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs h-9 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
          >
            <option value="ALL">Semua Status Proyek</option>
            <option value="Planning">Planning</option>
            <option value="In Progress">In Progress</option>
            <option value="Review">Review</option>
            <option value="Completed">Completed</option>
            <option value="On Hold">On Hold</option>
          </select>
        </div>
      </div>

      {/* Projects Matrix Table */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-white/40 dark:bg-white/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--color-bg)]/80 text-[var(--color-text-secondary)] text-xs border-b border-[var(--color-border)]">
            <tr>
              <th className="py-3.5 px-4">Proyek & Klien</th>
              <th className="py-3.5 px-4 text-center">Status</th>
              <th className="py-3.5 px-4 text-right">Nilai Kontrak</th>
              <th className="py-3.5 px-4 text-right">Kas Masuk (Paid)</th>
              <th className="py-3.5 px-4 text-right">Beban Subkon</th>
              <th className="py-3.5 px-4 text-right">Biaya Ops</th>
              {canViewProfit() && (
                <>
                  <th className="py-3.5 px-4 text-right">Laba Bersih</th>
                  <th className="py-3.5 px-4 text-right">Margin (%)</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {loadingData || loadingProjects ? (
              <tr>
                <td colSpan={canViewProfit() ? 8 : 6} className="py-12 text-center text-[var(--color-text-secondary)]">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Memuat data finansial konsolidasi...
                </td>
              </tr>
            ) : filteredSummaries.length === 0 ? (
              <tr>
                <td colSpan={canViewProfit() ? 8 : 6} className="py-10 text-center text-[var(--color-text-secondary)]">
                  Tidak ada data proyek yang sesuai kriteria pencarian.
                </td>
              </tr>
            ) : (
              filteredSummaries.map((p) => (
                <tr key={p.projectId} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-[var(--color-text-primary)]">{p.projectName}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">
                      {p.projectCode} &middot; Klien: {p.clientName}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <Badge variant={p.status === 'Completed' ? 'success' : p.status === 'In Progress' ? 'info' : 'default'}>
                      {p.status}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-right font-medium text-[var(--color-text-primary)]">
                    Rp {p.contractValue.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3.5 px-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                    Rp {p.clientPaid.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3.5 px-4 text-right font-medium text-rose-600 dark:text-rose-400">
                    Rp {p.vendorCost.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3.5 px-4 text-right font-medium text-amber-600 dark:text-amber-400">
                    Rp {p.expenses.toLocaleString('id-ID')}
                  </td>
                  {canViewProfit() && (
                    <>
                      <td className={`py-3.5 px-4 text-right font-bold ${p.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        Rp {p.netProfit.toLocaleString('id-ID')}
                      </td>
                      <td className={`py-3.5 px-4 text-right font-semibold text-xs ${p.netMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {p.netMargin.toFixed(1)}%
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
