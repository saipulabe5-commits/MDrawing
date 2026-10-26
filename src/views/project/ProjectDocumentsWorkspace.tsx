import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { hasCapability } from '../../security/authorization';
import { useDocument } from '../../context/DocumentContext';
import { generateTransmittalPdf } from '../../lib/exportUtils';
import { projectReport } from '../../engine/financial/reportModel';
import React, { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { useExpense } from '../../context/ExpenseContext';
import { useVendor } from '../../context/VendorContext';
import { useDrawings } from '../../context/DrawingContext';
import { useTransmittals } from '../../context/TransmittalContext';
import { useProjects } from '../../context/ProjectContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Project, Invoice, Quotation, ClientPayment, ProjectExpense } from '../../types';
import { Button, Card, Badge, Input } from '../../components/ui';
import { 
  FileText, 
  Download, 
  Search, 
  Send, 
  Receipt, 
  DollarSign, 
  Building2, 
  FileSpreadsheet, 
  Layers, 
  CheckCircle2, 
  Clock, 
  Eye, 
  Filter
} from 'lucide-react';
import { 
  buildQuotationPdf
} from '../../lib/pdfGenerator';
import { 
  generateInvoicePDF, 
  generatePaymentReceiptPDF, 
  generateExpenseReportPDF,
  generateCashflowReportPDF,
  generateProfitLossReportPDF,
  generateVendorAPReportPDF
} from '../../lib/documentGenerator';
import { exportDrawingListToPDF, exportDrawingListToExcel } from '../../lib/exportUtils';
import { formatCurrency, formatDate } from '../../lib/formatters';

interface ProjectDocumentsWorkspaceProps {
  project?: Project;
  projectId?: string;
  projectName?: string;
}

export function ProjectDocumentsWorkspace({ 
  project: directProject, 
  projectId: directProjectId, 
  projectName: directProjectName 
}: ProjectDocumentsWorkspaceProps) {
  const { projects } = useProjects();
  const { quotations, invoices, clientPayments, clients, loadingFinance } = useFinance();
  const { expenses, cashflowEntries } = useExpense();
  const { projectVendors, vendorBills, vendorPayments } = useVendor();
  const { items, groups } = useDrawings();
  const { transmittals } = useTransmittals();
  const { canViewFinance, canViewProfit, canViewVendorCost } = usePermissions();
  const { companySettings }=useDocument();
  const { appUser: documentUser }=useAuth();

  const [category, setCategory] = useState<'ALL' | 'DRAWING' | 'INVOICE' | 'QUOTATION' | 'RECEIPT' | 'REPORT' | 'TRANSMITTAL'>('ALL');
  const [search, setSearch] = useState('');

  const project = useMemo(() => {
    if (directProject) return directProject;
    const found = projects.find(p => p.id === directProjectId);
    if (found) return found;
    return {
      id: directProjectId || 'PROJ',
      projectName: directProjectName || 'Proyek APM',
      projectCode: 'PROJ',
      clientName: 'Client',
      status: 'Berjalan' as const,
      location: '-',
      projectType: 'Arsitektur',
      startDate: new Date().toISOString(),
      targetDate: new Date().toISOString(),
      description: '',
      members: [],
      createdBy: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }, [directProject, directProjectId, directProjectName, projects]);

  const metrics=projectReport(project,quotations,invoices,clientPayments,projectVendors,vendorBills,vendorPayments,expenses,cashflowEntries);
  // Financial calculations
  const totalContract = metrics.totalContract;

  const totalInvoiced = metrics.totalInvoiced;

  const totalPaid = metrics.totalPaid;

  const totalExpenses = metrics.expensesPaid;

  const totalVendorPaid = metrics.vendorPaid;

  const totalOut = metrics.totalCashOut;
  const projectedProfit = metrics.projectedProfit;
  const profitMargin = metrics.profitMargin;

  // Unified Document List
  interface DocItem {
    id: string;
    category: 'DRAWING' | 'INVOICE' | 'QUOTATION' | 'RECEIPT' | 'REPORT' | 'TRANSMITTAL';
    title: string;
    subtitle: string;
    docNumber: string;
    date: string;
    status: string;
    onDownload: () => void;
  }

  const documents = useMemo(() => {
    const list: DocItem[] = [];

    // 1. Drawing Reports
    list.push({
      id: 'doc-drawing-pdf',
      category: 'DRAWING',
      title: 'Master Drawing Register (PDF)',
      subtitle: `Daftar resmi ${items.length} lembar gambar dalam ${groups.length} grup CAD`,
      docNumber: `MDR-${project.projectCode}`,
      date: new Date().toISOString(),
      status: 'Ready',
      onDownload: () => exportDrawingListToPDF(project.projectName, groups, items, project.projectCode)
    });

    list.push({
      id: 'doc-drawing-excel',
      category: 'DRAWING',
      title: 'Drawing Register Spreadsheet (Excel)',
      subtitle: 'Data terstruktur untuk reporting engineering dan submission',
      docNumber: `XLS-${project.projectCode}`,
      date: new Date().toISOString(),
      status: 'Ready',
      onDownload: () => exportDrawingListToExcel(project.projectName, groups, items, project.projectCode)
    });

    // 2. Transmittals
    transmittals.forEach(tr => {
      list.push({
        id: `tr-${tr.id}`,
        category: 'TRANSMITTAL',
        title: `Surat Pengantar Gambar (${tr.purpose})`,
        subtitle: `Kepada: ${tr.recipientName} (${tr.itemIds?.length || 0} lembar)`,
        docNumber: tr.transmittalNumber,
        date: tr.createdAt,
        status: 'Diterbitkan',
        onDownload: () => {
          generateTransmittalPdf(tr,project,companySettings);
        }
      });
    });

    // 3. Quotations
    if (canViewFinance()) {
      quotations.forEach(q => {
        list.push({
          id: `quo-${q.id}`,
          category: 'QUOTATION',
          title: `Surat Penawaran Harga (Quotation)`,
          subtitle: `Nilai: ${formatCurrency(q.grandTotal)}`,
          docNumber: q.quotationNumber || 'QUO-DOC',
          date: q.date,
          status: q.status,
          onDownload: () => {
            const pdf = buildQuotationPdf(q, clients.find(c=>c.id===q.clientId) , { preview: false });
            pdf.save(`Quotation_${q.quotationNumber}.pdf`);
          }
        });
      });

      // 4. Invoices
      invoices.forEach(inv => {
        list.push({
          id: `inv-${inv.id}`,
          category: 'INVOICE',
          title: `Invoice Penagihan: ${inv.invoiceNumber}`,
          subtitle: `Nominal: ${formatCurrency(inv.grandTotal)} (Terbayar: ${formatCurrency(inv.amountPaid || 0)})`,
          docNumber: inv.invoiceNumber,
          date: inv.date || inv.createdAt,
          status: inv.status,
          onDownload: () => generateInvoicePDF(inv, undefined, project.clientName)
        });
      });

      // 5. Payment Receipts
      clientPayments.forEach(p => {
        list.push({
          id: `pay-${p.id}`,
          category: 'RECEIPT',
          title: `Kuitansi Resmi Pembayaran`,
          subtitle: `Nominal: ${formatCurrency(p.amount)} (${p.paymentMethod})`,
          docNumber: p.paymentNumber || 'KWT-DOC',
          date: p.paymentDate,
          status: p.status,
          onDownload: () => generatePaymentReceiptPDF(p)
        });
      });

      // 6. Reports
      list.push({
        id: 'rep-cashflow',
        category: 'REPORT',
        title: 'Laporan Arus Kas Proyek (Cashflow PDF)',
        subtitle: `Kas Masuk: ${formatCurrency(totalPaid)} | Kas Keluar: ${formatCurrency(totalOut)}`,
        docNumber: `CASH-${project.projectCode}`,
        date: new Date().toISOString(),
        status: 'Generated',
        onDownload: () => generateCashflowReportPDF(metrics.entries as any, project.projectName, {
          totalCashIn: totalPaid,
          totalCashOut: totalOut,
          netCashflow: totalPaid - totalOut
        })
      });

      if (canViewProfit()) {
        list.push({
          id: 'rep-pnl',
          category: 'REPORT',
          title: 'Laporan Laba Rugi Komprehensif (P&L PDF)',
          subtitle: `Margin: ${Math.round(profitMargin)}% | Laba Bersih: ${formatCurrency(projectedProfit)}`,
          docNumber: `PNL-${project.projectCode}`,
          date: new Date().toISOString(),
          status: 'Generated',
          onDownload: () => generateProfitLossReportPDF({
            contractValue: totalContract,
            totalInvoiced,
            totalExpenses: metrics.vendorBilled + metrics.expensesAccrued,
            projectedProfit,
            profitMargin
          }, project.projectName)
        });
      }

      if (canViewVendorCost()) {
        list.push({
          id: 'rep-vendor-ap',
          category: 'REPORT',
          title: 'Laporan Rekonsiliasi Hutang Vendor (AP PDF)',
          subtitle: `${projectVendors.length} Vendor Terkontrak`,
          docNumber: `AP-${project.projectCode}`,
          date: new Date().toISOString(),
          status: 'Generated',
          onDownload: () => generateVendorAPReportPDF(projectVendors, vendorBills, vendorPayments, project.projectName)
        });
      }

      if (expenses.length > 0) {
        list.push({
          id: 'rep-expense-list',
          category: 'REPORT',
          title: 'Rekap Biaya Operasional Proyek (PDF)',
          subtitle: `Total ${expenses.length} transaksi pengeluaran (${formatCurrency(totalExpenses)})`,
          docNumber: `EXP-${project.projectCode}`,
          date: new Date().toISOString(),
          status: 'Generated',
          onDownload: () => generateExpenseReportPDF(expenses, `Laporan Biaya - ${project.projectName}`)
        });
      }
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [
    project, items, groups, transmittals, quotations, invoices, clientPayments, 
    cashflowEntries, expenses, projectVendors, vendorBills, vendorPayments,
    totalPaid, totalOut, totalInvoiced, totalContract, projectedProfit, profitMargin, totalExpenses,
    canViewFinance, canViewProfit, canViewVendorCost, companySettings, clients
  ]);

  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      if (category !== 'ALL' && doc.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          doc.title.toLowerCase().includes(q) ||
          doc.subtitle.toLowerCase().includes(q) ||
          doc.docNumber.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [documents, category, search]);

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & FILTER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] shadow-xs">
        {/* Category Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-[var(--color-border)] overflow-x-auto max-w-full text-xs">
          {(['ALL', 'DRAWING', 'INVOICE', 'QUOTATION', 'RECEIPT', 'REPORT', 'TRANSMITTAL'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                category === cat
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {cat === 'ALL' ? 'Semua Dokumen' : cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="w-full md:w-64">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari dokumen..."
            className="text-xs h-9 bg-[var(--color-surface)]"
          />
        </div>
      </div>

      {/* 2. DOCUMENT GRID CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.map((doc) => (
          <div 
            key={doc.id}
            className="bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] shadow-xs flex flex-col justify-between hover:border-blue-500/40 transition-all group"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  doc.category === 'DRAWING'
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : doc.category === 'INVOICE'
                    ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                    : doc.category === 'RECEIPT'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : doc.category === 'REPORT'
                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                    : doc.category === 'QUOTATION'
                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}>
                  {doc.category}
                </span>

                <span className="text-[10px] font-mono text-slate-400">
                  {formatDate(doc.date)}
                </span>
              </div>

              <h4 className="text-xs font-bold text-[var(--color-text-primary)] leading-snug group-hover:text-blue-600 transition-colors">
                {doc.title}
              </h4>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                {doc.subtitle}
              </p>
              <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>No: {doc.docNumber}</span>
                <span className="font-semibold text-emerald-600">{doc.status}</span>
              </div>
            </div>

            <Button
              size="sm"
              onClick={()=>{if(doc.category!=='DRAWING'&&doc.category!=='TRANSMITTAL'&&!hasCapability(documentUser,'canExportFinanceReport')){toast.error('Izin export finance diperlukan.');return;}try{doc.onDownload();}catch(e:any){toast.error(e.message||'Dokumen belum berhasil dibuat.');}}}
              className="mt-4 w-full text-xs font-semibold flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 transition-all border border-[var(--color-border)]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Dokumen</span>
            </Button>
          </div>
        ))}
      </div>

      {filteredDocs.length === 0 && (
        <div className="text-center py-16 bg-[var(--color-surface)] rounded-2xl border border-dashed border-[var(--color-border)]">
          <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h4 className="text-xs font-bold text-[var(--color-text-primary)]">Tidak Ada Dokumen yang Cocok</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Coba pilih kategori dokumen lain atau periksa filter pencarian Anda.
          </p>
        </div>
      )}
    </div>
  );
}
