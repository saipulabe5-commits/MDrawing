import React, { useState } from 'react';
import { useVendor } from '../../context/VendorContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Button, Card, Badge, Input } from '../../components/ui';
import { 
  Building2, 
  FileText, 
  DollarSign, 
  Plus, 
  Search, 
  Eye, 
  CreditCard,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileCheck
} from 'lucide-react';
import { VendorContractsTab } from './vendor/VendorContractsTab';
import { VendorTermsTab } from './vendor/VendorTermsTab';
import { VendorBillsTab } from './vendor/VendorBillsTab';
import { VendorPaymentsTab } from './vendor/VendorPaymentsTab';
import { VendorHutangTab } from './vendor/VendorHutangTab';
import { VendorAuditTab } from './vendor/VendorAuditTab';
import { VendorBill, ProjectVendor } from '../../types';
import { formatCurrency, formatDate } from '../../lib/formatters';

interface ProjectVendorViewProps {
  projectId: string;
}

export function ProjectVendorView({ projectId }: ProjectVendorViewProps) {
  const { 
    loadingVendor, 
    projectVendors, 
    vendorBills, 
    vendorPayments 
  } = useVendor();
  const { canViewFinance, canViewVendorCost, canManageProjects, canWriteProjectData } = usePermissions();
  const canManageVendor = canManageProjects() || canWriteProjectData(projectId);

  const [viewMode, setViewMode] = useState<'summary' | 'contracts' | 'terms' | 'bills' | 'payments' | 'hutang' | 'audit'>('summary');
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<VendorBill | null>(null);
  const [search, setSearch] = useState('');
  const [selectedVendorDetail, setSelectedVendorDetail] = useState<ProjectVendor | null>(null);

  const canView = canViewVendorCost() || canViewFinance();

  if (!canView) {
    return (
      <div className="p-8 text-center text-slate-500 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">
        Anda tidak memiliki akses ke modul Vendor proyek ini.
      </div>
    );
  }

  if (loadingVendor) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Filter current project records
  const activeVendors = projectVendors.filter(v => v.projectId === projectId);
  const activeBills = vendorBills.filter(b => b.projectId === projectId);
  const activePayments = vendorPayments.filter(p => p.projectId === projectId);

  // Compute metrics
  const totalSPK = activeVendors.reduce((acc, v) => acc + (v.contractValue || 0), 0);
  const totalBilled = activeBills.reduce((acc, b) => acc + (b.amount || 0), 0);
  const totalPaid = activePayments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const sisaHutang = Math.max(0, totalBilled - totalPaid);

  const handlePayBillDirectly = (bill: VendorBill) => {
    setSelectedBillForPayment(bill);
    setViewMode('payments');
  };

  const filteredVendors = activeVendors.filter(v => 
    v.vendorName.toLowerCase().includes(search.toLowerCase()) ||
    v.scopeOfWork.toLowerCase().includes(search.toLowerCase()) ||
    v.vendorType.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* 1. VENDOR SUMMARY METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-[var(--color-surface)] p-3.5 rounded-2xl border border-[var(--color-border)] shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Vendor Aktif</span>
          <span className="text-lg font-bold text-[var(--color-text-primary)] mt-0.5 block">
            {activeVendors.length} <span className="text-xs font-normal text-slate-500">Mitra/Subkon</span>
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">Terkontrak</span>
        </div>

        <div className="bg-[var(--color-surface)] p-3.5 rounded-2xl border border-[var(--color-border)] shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Total Nilai SPK</span>
          <span className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5 block truncate">
            {formatCurrency(totalSPK)}
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">Kontrak Kerja</span>
        </div>

        <div className="bg-[var(--color-surface)] p-3.5 rounded-2xl border border-[var(--color-border)] shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Total Tagihan</span>
          <span className="text-lg font-bold text-slate-700 dark:text-slate-200 mt-0.5 block truncate">
            {formatCurrency(totalBilled)}
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {totalSPK > 0 ? `${Math.round((totalBilled / totalSPK) * 100)}% dari SPK` : '0%'}
          </span>
        </div>

        <div className="bg-[var(--color-surface)] p-3.5 rounded-2xl border border-[var(--color-border)] shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Sudah Dibayar</span>
          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block truncate">
            {formatCurrency(totalPaid)}
          </span>
          <span className="text-[10px] text-emerald-500 mt-1 block">
            {totalBilled > 0 ? `${Math.round((totalPaid / totalBilled) * 100)}% Lunas` : '0%'}
          </span>
        </div>

        <div className="bg-[var(--color-surface)] p-3.5 rounded-2xl border border-[var(--color-border)] shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Sisa Hutang AP</span>
          <span className={`text-lg font-bold mt-0.5 block truncate ${sisaHutang > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
            {formatCurrency(sisaHutang)}
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">Hutang Berjalan</span>
        </div>
      </div>

      {/* 2. NAVIGATION BAR & ACTION CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-surface)] p-3.5 rounded-2xl border border-[var(--color-border)] shadow-xs">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-[var(--color-border)] overflow-x-auto max-w-full">
          <button
            onClick={() => setViewMode('summary')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              viewMode === 'summary'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Daftar Vendor & SPK
          </button>
          <button
            onClick={() => setViewMode('bills')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              viewMode === 'bills'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Tagihan Vendor ({activeBills.length})
          </button>
          <button
            onClick={() => setViewMode('payments')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              viewMode === 'payments'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Pembayaran Vendor ({activePayments.length})
          </button>
          <button
            onClick={() => setViewMode('terms')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              viewMode === 'terms'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Cara Bayar / Termin
          </button>
          <button
            onClick={() => setViewMode('hutang')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              viewMode === 'hutang'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Laporan Hutang
          </button>
          <button
            onClick={() => setViewMode('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              viewMode === 'audit'
                ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Audit Log
          </button>
        </div>

        {canManageVendor && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => setViewMode('contracts')}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Tambah SPK Vendor</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setViewMode('bills')}
              className="text-xs font-semibold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Buat Tagihan</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setViewMode('payments')}
              className="text-xs font-semibold shadow-xs"
            >
              <CreditCard className="w-3.5 h-3.5 mr-1" />
              <span>Bayar Vendor</span>
            </Button>
          </div>
        )}
      </div>

      {/* 3. UNIFIED OVERVIEW TABLE VIEW */}
      {viewMode === 'summary' && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Daftar Kontrak & Rekonsiliasi Vendor</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Status SPK, tagihan masuk, pelunasan kas, dan sisa kewajiban vendor proyek.
              </p>
            </div>
            <div className="w-full sm:w-60">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari vendor / lingkup..."
                className="text-xs h-8"
              />
            </div>
          </div>

          {filteredVendors.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-[var(--color-border)] rounded-xl">
              <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <h4 className="text-xs font-bold text-[var(--color-text-primary)]">Belum Ada Vendor Terdaftar</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tambahkan vendor atau subkontraktor pertama untuk proyek ini.
              </p>
              {canManageVendor && (
                <Button
                  size="sm"
                  onClick={() => setViewMode('contracts')}
                  className="mt-3 bg-blue-600 text-white text-xs font-semibold"
                >
                  + Tambah SPK Vendor
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-slate-500 dark:text-slate-400 font-semibold bg-slate-50/50 dark:bg-slate-800/50">
                    <th className="py-2.5 px-3">Nama Vendor</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3">Lingkup Pekerjaan</th>
                    <th className="py-2.5 px-3 text-right">Nilai SPK</th>
                    <th className="py-2.5 px-3 text-right">Ditagihkan</th>
                    <th className="py-2.5 px-3 text-right">Terbayar</th>
                    <th className="py-2.5 px-3 text-right">Sisa Hutang</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {filteredVendors.map((vendor) => {
                    const vendorBillsList = activeBills.filter(b => b.projectVendorId === vendor.id);
                    const vendorPaymentsList = activePayments.filter(p => p.projectVendorId === vendor.id);
                    
                    const billed = vendorBillsList.reduce((acc, b) => acc + (b.amount || 0), 0);
                    const paid = vendorPaymentsList.reduce((acc, p) => acc + (p.amount || 0), 0);
                    const sisa = Math.max(0, billed - paid);

                    return (
                      <tr key={vendor.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-bold text-[var(--color-text-primary)]">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-[10px]">
                              {vendor.vendorName.charAt(0).toUpperCase()}
                            </div>
                            <span>{vendor.vendorName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                          {vendor.vendorType}
                        </td>
                        <td className="py-3 px-3 text-slate-500 truncate max-w-[140px]">
                          {vendor.scopeOfWork || 'Subkontraktor'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatCurrency(vendor.contractValue || 0)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-blue-600 dark:text-blue-400 font-semibold">
                          {formatCurrency(billed)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          {formatCurrency(paid)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                          {formatCurrency(sisa)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sisa === 0 && billed > 0
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          }`}>
                            {sisa === 0 && billed > 0 ? 'LUNAS' : vendor.workStatus}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setSelectedVendorDetail(vendor);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Lihat Detail Vendor"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {canManageVendor && (
                              <>
                                <button
                                  onClick={() => setViewMode('bills')}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  title="Buat Tagihan"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setViewMode('payments')}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  title="Catat Pembayaran"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
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

      {/* 4. SUB-TABS ROUTING (PRESERVING 100% CANONICAL CAPABILITIES) */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
        {viewMode === 'contracts' && (
          <VendorContractsTab projectId={projectId} />
        )}
        {viewMode === 'terms' && (
          <VendorTermsTab projectId={projectId} />
        )}
        {viewMode === 'bills' && (
          <VendorBillsTab 
            projectId={projectId} 
            onPayBill={handlePayBillDirectly}
          />
        )}
        {viewMode === 'payments' && (
          <VendorPaymentsTab 
            projectId={projectId} 
            initialSelectedBill={selectedBillForPayment}
            onClearSelectedBill={() => setSelectedBillForPayment(null)}
          />
        )}
        {viewMode === 'hutang' && (
          <VendorHutangTab projectId={projectId} />
        )}
        {viewMode === 'audit' && (
          <VendorAuditTab projectId={projectId} />
        )}
      </div>

      {/* VENDOR DETAIL MODAL / DRAWER */}
      {selectedVendorDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface)] w-full max-w-lg rounded-2xl border border-[var(--color-border)] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  {selectedVendorDetail.vendorName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                    {selectedVendorDetail.vendorName}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Tipe: {selectedVendorDetail.vendorType}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedVendorDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[var(--color-border)]">
                <span className="text-slate-500">Nilai Kontrak SPK:</span>
                <span className="font-bold text-[var(--color-text-primary)]">
                  {formatCurrency(selectedVendorDetail.contractValue || 0)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--color-border)]">
                <span className="text-slate-500">Lingkup Pekerjaan:</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {selectedVendorDetail.scopeOfWork || 'Subkon'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--color-border)]">
                <span className="text-slate-500">Status Pekerjaan:</span>
                <span className="font-bold text-blue-600">
                  {selectedVendorDetail.workStatus}
                </span>
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedVendorDetail(null)}
              >
                Tutup
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedVendorDetail(null);
                  setViewMode('bills');
                }}
                className="bg-blue-600 text-white"
              >
                Buka Tagihan Vendor
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
