import { projectReport } from '../../engine/financial/reportModel';
import React, { useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { useExpense } from '../../context/ExpenseContext';
import { useVendor } from '../../context/VendorContext';
import { useDrawings } from '../../context/DrawingContext';
import { useTransmittals } from '../../context/TransmittalContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Project, DrawingItem, Invoice, VendorBill, ClientPayment } from '../../types';
import { Card, Button, Badge } from '../../components/ui';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  FileText, 
  ArrowRight, 
  FileCheck, 
  AlertCircle, 
  Send, 
  TrendingUp, 
  Building2, 
  Layers,
  Sparkles
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';

interface ProjectSummaryViewProps {
  project: Project;
  onNavigateTab: (tab: string) => void;
}

export function ProjectSummaryView({ project, onNavigateTab }: ProjectSummaryViewProps) {
  const { items, groups } = useDrawings();
  const { invoices, clientPayments, quotations } = useFinance();
  const { expenses, cashflowEntries } = useExpense();
  const { projectVendors, vendorBills, vendorPayments } = useVendor();
  const { transmittals } = useTransmittals();
  const { canViewFinance, canEditFinance } = usePermissions();

  const metrics=projectReport(project,quotations,invoices,clientPayments,projectVendors,vendorBills,vendorPayments,expenses,cashflowEntries);
  // 1. Drawing Status Breakdown
  const totalDrawings = items.length;
  const completedDrawings = items.filter(i => i.status === 'Selesai').length;
  const inProgressDrawings = items.filter(i => i.status === 'Proses').length;
  const reviewDrawings = items.filter(i => i.status === 'Review').length;
  const revisionDrawings = items.filter(i => i.status === 'Revisi').length;
  const holdDrawings = items.filter(i => i.status === 'Hold').length;
  const notStartedDrawings = items.filter(i => i.status === 'Belum Mulai').length;

  const drawingProgress = totalDrawings > 0 ? Math.round((completedDrawings / totalDrawings) * 100) : 0;

  // 2. Financial Metrics
  const totalContract = metrics.totalContract;

  const totalInvoiced = metrics.totalInvoiced;

  const totalPaid = metrics.totalPaid;

  const totalExpenseVal = metrics.totalExpenseVal;

  const totalVendorPaidVal = metrics.totalVendorPaidVal;

  const totalAllOut = metrics.totalAllOut;
  const projectedProfit = metrics.projectedProfit;
  const sisaPiutang = metrics.sisaPiutang;

  // 3. Next Actions Intelligence Engine
  interface NextAction {
    id: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    category: 'DRAWING' | 'FINANCE' | 'VENDOR' | 'DOCS';
    title: string;
    description: string;
    actionLabel: string;
    targetTab: string;
  }

  const nextActions = useMemo(() => {
    const list: NextAction[] = [];

    // Overdue or urgent drawings
    const overdueItems = items.filter(i => {
      if (!i.deadline || i.status === 'Selesai') return false;
      return new Date(i.deadline).getTime() < new Date().setHours(0,0,0,0);
    });

    if (overdueItems.length > 0) {
      list.push({
        id: 'act-overdue-drawings',
        priority: 'HIGH',
        category: 'DRAWING',
        title: `${overdueItems.length} Lembar Gambar Melewati Deadline`,
        description: `Terdapat lembar gambar yang telah melampaui tanggal target pengerjaan (${overdueItems.slice(0, 2).map(i => i.drawingNumber).join(', ')}...).`,
        actionLabel: 'Tinjau Gambar',
        targetTab: 'drawings'
      });
    }

    // Unpaid / Overdue Invoices
    const unpaidInvoices = invoices.filter(i => i.status !== 'Paid' && i.status !== 'Void' && i.status !== 'Cancelled');
    if (unpaidInvoices.length > 0) {
      const overdueInv = unpaidInvoices.filter(i => new Date(i.dueDate).getTime() < Date.now());
      if (overdueInv.length > 0) {
        list.push({
          id: 'act-overdue-invoices',
          priority: 'HIGH',
          category: 'FINANCE',
          title: `${overdueInv.length} Invoice Jatuh Tempo Menunggu Pelunasan`,
          description: `Total piutang jatuh tempo: ${formatCurrency(overdueInv.reduce((sum, i) => sum + (i.grandTotal - (i.amountPaid || 0)), 0))}.`,
          actionLabel: 'Catat Pembayaran',
          targetTab: 'finance'
        });
      } else {
        list.push({
          id: 'act-pending-invoices',
          priority: 'MEDIUM',
          category: 'FINANCE',
          title: `${unpaidInvoices.length} Invoice Aktif Belum Lunas`,
          description: `Sisa piutang klien berjalan: ${formatCurrency(sisaPiutang)}.`,
          actionLabel: 'Buka Keuangan',
          targetTab: 'finance'
        });
      }
    }

    // Pending Vendor Bills
    const pendingVendorBills = vendorBills.filter(b => b.status !== 'Paid' && b.status !== 'Cancelled');
    if (pendingVendorBills.length > 0) {
      const sisaVendorAP = pendingVendorBills.reduce((acc, b) => acc + (b.remainingAmount || b.amount), 0);
      list.push({
        id: 'act-vendor-bills',
        priority: 'MEDIUM',
        category: 'VENDOR',
        title: `${pendingVendorBills.length} Tagihan Vendor Belum Selesai`,
        description: `Total kewajiban hutang vendor: ${formatCurrency(sisaVendorAP)}.`,
        actionLabel: 'Bayar Vendor',
        targetTab: 'vendor'
      });
    }

    // Drawings in review
    if (reviewDrawings > 0) {
      list.push({
        id: 'act-review-drawings',
        priority: 'MEDIUM',
        category: 'DRAWING',
        title: `${reviewDrawings} Lembar Gambar Siap Review / Approval`,
        description: 'Drafter telah menyelesaikan draft gambar dan siap diperiksa oleh Lead Arsitek.',
        actionLabel: 'Periksa Gambar',
        targetTab: 'drawings'
      });
    }

    // Transmittal recommendation
    if (completedDrawings > 0 && transmittals.length === 0) {
      list.push({
        id: 'act-create-transmittal',
        priority: 'LOW',
        category: 'DOCS',
        title: 'Buat Transmittal Pertama untuk Klien',
        description: `${completedDrawings} lembar gambar telah rampung. Terbitkan surat pengantar resmi.`,
        actionLabel: 'Buat Transmittal',
        targetTab: 'documents'
      });
    }

    return list;
  }, [items, invoices, vendorBills, reviewDrawings, completedDrawings, transmittals, sisaPiutang]);

  return (
    <div className="space-y-6">
      {/* 1. NEXT ACTION ENGINE WIDGET */}
      <div className="bg-[var(--color-surface)] p-5 rounded-2xl border border-[var(--color-border)] shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                Aksi Berikutnya (Next Actions Hub)
              </h3>
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                Rekomendasi prioritas otomatis untuk memajukan progres proyek tanpa hambatan.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {nextActions.length} Tindakan
          </span>
        </div>

        {nextActions.length === 0 ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="text-xs">
              <span className="font-bold block">Semua Pekerjaan Sesuai Jadwal!</span>
              <span>Tidak ada tagihan tertunggak, gambar overdue, atau tugas blocking saat ini.</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {nextActions.map((act) => (
              <div 
                key={act.id}
                className="bg-[var(--color-bg)] p-3.5 rounded-xl border border-[var(--color-border)] flex flex-col justify-between hover:border-blue-500/40 transition-all shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      act.priority === 'HIGH'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        : act.priority === 'MEDIUM'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    }`}>
                      {act.priority === 'HIGH' ? 'Prioritas Tinggi' : act.priority === 'MEDIUM' ? 'Penting' : 'Info'}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-mono">{act.category}</span>
                  </div>
                  <h4 className="text-xs font-bold text-[var(--color-text-primary)] leading-snug">
                    {act.title}
                  </h4>
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                    {act.description}
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onNavigateTab(act.targetTab)}
                  className="mt-3 w-full text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <span>{act.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. DUAL METRICS PANELS: PRODUKSI GAMBAR & FINANSIAL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* GAMBAR KERJA PROGRESS */}
        <div className="bg-[var(--color-surface)] p-5 rounded-2xl border border-[var(--color-border)] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Produksi Lembar Gambar</h3>
                <p className="text-[11px] text-[var(--color-text-secondary)]">Total {totalDrawings} lembar dalam {groups.length} grup CAD</p>
              </div>
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => onNavigateTab('drawings')}
              className="text-xs font-semibold"
            >
              Buka Gambar →
            </Button>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1.5">
              <span className="text-slate-500">Progres Gambar Selesai</span>
              <span className="text-blue-600 font-bold">{drawingProgress}% ({completedDrawings}/{totalDrawings})</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500" 
                style={{ width: `${totalDrawings > 0 ? (completedDrawings / totalDrawings) * 100 : 0}%` }}
                title={`Selesai: ${completedDrawings}`}
              />
              <div 
                className="h-full bg-blue-500 transition-all duration-500" 
                style={{ width: `${totalDrawings > 0 ? (inProgressDrawings / totalDrawings) * 100 : 0}%` }}
                title={`Proses: ${inProgressDrawings}`}
              />
              <div 
                className="h-full bg-purple-500 transition-all duration-500" 
                style={{ width: `${totalDrawings > 0 ? (reviewDrawings / totalDrawings) * 100 : 0}%` }}
                title={`Review: ${reviewDrawings}`}
              />
              <div 
                className="h-full bg-amber-500 transition-all duration-500" 
                style={{ width: `${totalDrawings > 0 ? (revisionDrawings / totalDrawings) * 100 : 0}%` }}
                title={`Revisi: ${revisionDrawings}`}
              />
            </div>
          </div>

          {/* Breakdown Mini Cards */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[var(--color-border)]">
              <span className="text-[10px] text-slate-500 block">Selesai (Done)</span>
              <span className="text-base font-bold text-emerald-600 block mt-0.5">{completedDrawings}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[var(--color-border)]">
              <span className="text-[10px] text-slate-500 block">Dalam Proses</span>
              <span className="text-base font-bold text-blue-600 block mt-0.5">{inProgressDrawings}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[var(--color-border)]">
              <span className="text-[10px] text-slate-500 block">Revisi / Review</span>
              <span className="text-base font-bold text-amber-600 block mt-0.5">{revisionDrawings + reviewDrawings}</span>
            </div>
          </div>
        </div>

        {/* KEUANGAN & KOMERSIAL */}
        {canViewFinance() ? (
          <div className="bg-[var(--color-surface)] p-5 rounded-2xl border border-[var(--color-border)] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Ringkasan Komersial & Kas</h3>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">Kontrak: {formatCurrency(totalContract)}</p>
                </div>
              </div>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => onNavigateTab('finance')}
                className="text-xs font-semibold text-emerald-600"
              >
                Buka Keuangan →
              </Button>
            </div>

            {/* Financial Bars */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[var(--color-border)]">
                <span className="text-slate-500">Total Ditagihkan:</span>
                <span className="font-mono font-bold text-blue-600">{formatCurrency(totalInvoiced)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--color-border)]">
                <span className="text-slate-500">Kas Masuk (Terbayar):</span>
                <span className="font-mono font-bold text-emerald-600">{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--color-border)]">
                <span className="text-slate-500">Sisa Piutang Klien:</span>
                <span className="font-mono font-bold text-amber-600">{formatCurrency(sisaPiutang)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--color-border)]">
                <span className="text-slate-500">Total Biaya & Vendor:</span>
                <span className="font-mono font-bold text-rose-600">{formatCurrency(totalAllOut)}</span>
              </div>
              <div className="flex justify-between py-1.5 bg-purple-500/5 dark:bg-purple-950/20 px-2 rounded-lg font-bold">
                <span className="text-purple-700 dark:text-purple-300">Proyeksi Laba Bersih:</span>
                <span className="font-mono text-purple-600 dark:text-purple-400">{formatCurrency(projectedProfit)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--color-surface)] p-5 rounded-2xl border border-[var(--color-border)] shadow-xs flex items-center justify-center text-center">
            <p className="text-xs text-slate-500">Modul komersial dibatasi untuk peran Anda.</p>
          </div>
        )}
      </div>

      {/* 3. VENDOR & DOKUMEN QUICK STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[var(--color-text-primary)]">Vendor & Subkon Proyek</h4>
              <p className="text-[11px] text-[var(--color-text-secondary)]">{projectVendors.length} Vendor Terkontrak</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onNavigateTab('vendor')}
            className="text-xs font-semibold"
          >
            Kelola Vendor
          </Button>
        </div>

        <div className="bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[var(--color-text-primary)]">Pusat Dokumen Resmi</h4>
              <p className="text-[11px] text-[var(--color-text-secondary)]">Penawaran, Invoice, Kwitansi, Transmittal</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onNavigateTab('documents')}
            className="text-xs font-semibold"
          >
            Buka Dokumen
          </Button>
        </div>
      </div>
    </div>
  );
}
