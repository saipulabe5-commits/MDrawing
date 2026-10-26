import { projectReport } from '../../../engine/financial/reportModel';
import React from 'react';
import { useParams } from 'react-router-dom';
import { useFinance } from '../../../context/FinanceContext';
import { useVendor } from '../../../context/VendorContext';
import { useExpense } from '../../../context/ExpenseContext';
import { useProjects } from '../../../context/ProjectContext';
import { useDocument } from '../../../context/DocumentContext';
import { useDrawings } from '../../../context/DrawingContext';
import { useTransmittals } from '../../../context/TransmittalContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { DrawingTransmittal } from '../../../types';
import { Button, Card, Badge } from '../../../components/ui';
import { 
  FileText, Download, DollarSign, Receipt, CreditCard, 
  TrendingUp, Truck, Layers, FileSpreadsheet 
} from 'lucide-react';
import { 
  generateExpenseReportPdf, generateCashflowReportPdf, 
  generateProfitLossReportPdf, generateHutangReportPdf,
  generateQuotationPdf, generateInvoicePdf, generatePaymentReceiptPdf,
  exportDrawingListToPDF, exportDrawingListToExcel, generateTransmittalPdf
} from '../../../lib/exportUtils';
import toast from 'react-hot-toast';

export function ProjectDocumentsTab() {
  const { id: projectId } = useParams<{ id: string }>();
  const { projects } = useProjects();
  const { quotations, invoices, clientPayments } = useFinance();
  const { vendors, projectVendors, vendorBills, vendorPayments } = useVendor();
  const { expenses, cashflowEntries } = useExpense();
  const { groups, items } = useDrawings();
  const { transmittals } = useTransmittals();
  const { companySettings, recordGeneratedDocument } = useDocument();
  const { canViewProfit, canViewFinance, currentUser } = usePermissions();

  const project = projects.find((p) => p.id === projectId);

  if (!project || !projectId) return null;

  // Strict project data isolation
  const projectQuotations = quotations.filter((item) => item.projectId === projectId);
  const projectInvoices = invoices.filter((item) => item.projectId === projectId);
  const projectClientPayments = clientPayments.filter((item) => item.projectId === projectId);
  const projectExpenses = expenses.filter((e) => e.projectId === projectId);
  const projectVendorPayments = vendorPayments.filter((vp) => vp.projectId === projectId);
  const projectVendorBills = vendorBills.filter((b) => b.projectId === projectId);
  const currentProjectVendors = projectVendors.filter((pv) => pv.projectId === projectId);
  const projectGroups = groups.filter((g) => g.projectId === projectId);
  const projectItems = items.filter((i) => i.projectId === projectId);
  const projectTransmittals = transmittals.filter((t) => t.projectId === projectId);

  const handleDownloadQuotation = () => {
    const q = projectQuotations.find((item) => item.status === 'AGREED' || item.status === 'Sent') || projectQuotations[0];
    if (!q) {
      toast.error('Belum ada data penawaran harga (Quotation) untuk proyek ini.');
      return;
    }
    generateQuotationPdf(q, project, { name: project.clientName || 'Klien' } as any);
    recordGeneratedDocument({
      projectId: project.id,
      projectName: project.projectName,
      documentType: 'Quotation',
      documentNumber: q.quotationNumber,
      title: `Surat Penawaran Harga - ${q.quotationNumber}`,
      version: 1,
      fileFormat: 'PDF',
      createdBy: currentUser?.uid || '',
      createdByName: currentUser?.name || 'User',
    });
    toast.success('Surat Penawaran Harga PDF berhasil diunduh');
  };

  const handleDownloadInvoice = () => {
    const inv = projectInvoices.find((item) => item.status === 'Sent' || item.status === 'Paid') || projectInvoices[0];
    if (!inv) {
      toast.error('Belum ada data Faktur Tagihan (Invoice) untuk proyek ini.');
      return;
    }
    const matchingQuotation = projectQuotations.find((item) => item.status === 'AGREED' || item.status === 'Sent') || projectQuotations[0];
    generateInvoicePdf(inv, matchingQuotation, project, { companyName: project.clientName || 'Klien' } as any, 'Termin Proyek');
    recordGeneratedDocument({
      projectId: project.id,
      projectName: project.projectName,
      documentType: 'Invoice',
      documentNumber: inv.invoiceNumber,
      title: `Faktur Tagihan Klien - ${inv.invoiceNumber}`,
      version: 1,
      fileFormat: 'PDF',
      createdBy: currentUser?.uid || '',
      createdByName: currentUser?.name || 'User',
    });
    toast.success('Faktur Tagihan PDF berhasil diunduh');
  };

  const handleDownloadReceipt = () => {
    const pay = projectClientPayments.find((item) => item.status === 'Confirmed') || projectClientPayments[0];
    if (!pay) {
      toast.error('Belum ada catatan pembayaran klien terkonfirmasi untuk proyek ini.');
      return;
    }
    generatePaymentReceiptPdf(pay, project, { name: project.clientName || 'Klien' } as any);
    recordGeneratedDocument({
      projectId: project.id,
      projectName: project.projectName,
      documentType: 'ClientPaymentReceipt',
      documentNumber: pay.paymentNumber,
      title: `Kwitansi Pembayaran Klien - ${pay.paymentNumber}`,
      version: 1,
      fileFormat: 'PDF',
      createdBy: currentUser?.uid || '',
      createdByName: currentUser?.name || 'User',
    });
    toast.success('Kwitansi Pembayaran PDF berhasil diunduh');
  };

  const handleDownloadExpenses = () => {
    generateExpenseReportPdf(project, projectExpenses, companySettings);
    recordGeneratedDocument({
      projectId: project.id,
      projectName: project.projectName,
      documentType: 'ExpenseReport',
      documentNumber: `EXP-${project.projectCode}-${new Date().toISOString().slice(0, 10)}`,
      title: `Laporan Biaya Operasional - ${project.projectName}`,
      version: 1,
      fileFormat: 'PDF',
      createdBy: currentUser?.uid || '',
      createdByName: currentUser?.name || 'User',
    });
    toast.success('Laporan Biaya Operasional PDF berhasil diunduh');
  };

  const handleDownloadCashflow = ()=>{try{const m=projectReport(project,projectQuotations,projectInvoices,projectClientPayments,projectVendors,projectVendorBills,projectVendorPayments,projectExpenses,cashflowEntries);generateCashflowReportPdf(project,m.entries as any,{totalIn:m.totalCashIn,totalOut:m.totalCashOut,balance:m.netCash},companySettings);toast.success('PDF arus kas dibuat dari seluruh transaksi yang sah.');}catch(e:any){toast.error(e.message);}};

  const handleDownloadPnL = ()=>{try{const m=projectReport(project,projectQuotations,projectInvoices,projectClientPayments,projectVendors,projectVendorBills,projectVendorPayments,projectExpenses,cashflowEntries);generateProfitLossReportPdf(project,{contractValue:m.totalContract,totalVendorCost:m.vendorBilled,grossProfit:m.totalContract-m.vendorBilled,totalExpenses:m.expensesAccrued,netProfit:m.projectedProfit,profitMargin:m.profitMargin,expectedProfit:project.expectedProfit},companySettings);toast.success('PDF proyeksi laba dibuat; bukan pengakuan pendapatan akrual.');}catch(e:any){toast.error(e.message);}};

  const handleDownloadVendorAP = () => {
    const activeBills = projectVendorBills.filter((b) => !['Void', 'Cancelled'].includes(b.status));
    generateHutangReportPdf(project, vendors, currentProjectVendors, activeBills, projectVendorPayments);
    recordGeneratedDocument({
      projectId: project.id,
      projectName: project.projectName,
      documentType: 'Other',
      documentNumber: `AP-${project.projectCode}-${new Date().toISOString().slice(0, 10)}`,
      title: `Laporan Hutang Subkon - ${project.projectName}`,
      version: 1,
      fileFormat: 'PDF',
      createdBy: currentUser?.uid || '',
      createdByName: currentUser?.name || 'User',
    });
    toast.success('Laporan Hutang Vendor PDF berhasil diunduh');
  };

  const handleDownloadDrawingTransmittal = () => {
    const latestTrm = projectTransmittals[0];
    const trmNumber = latestTrm?.transmittalNumber || `TRM/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${project.projectCode}`;
    const trmData: DrawingTransmittal = latestTrm || {
      id: 'preview-trm',
      projectId: project.id,
      transmittalNumber: trmNumber,
      recipientType: 'Klien',
      recipientName: project.clientName || 'Klien / Konsultan Pengawas',
      purpose: 'For Review',
      itemIds: projectItems.map(i => i.id),
      itemRevisionSnapshot: projectItems.map(i => ({
        itemId: i.id,
        drawingNumber: i.drawingNumber || '-',
        drawingName: i.drawingName || '-',
        revisionNumber: String(i.revisionCount || '0')
      })),
      notes: 'Diserahkan sebagai dokumen surat pengantar gambar kerja resmi.',
      issuedBy: currentUser?.uid || '',
      issuedByName: currentUser?.name || 'Document Controller',
      issuedAt: new Date().toISOString()
    };

    generateTransmittalPdf(trmData, project, companySettings);
    recordGeneratedDocument({
      projectId: project.id,
      projectName: project.projectName,
      documentType: 'DrawingTransmittal',
      documentNumber: trmNumber,
      title: `Surat Pengantar Transmittal - ${project.projectName}`,
      version: 1,
      fileFormat: 'PDF',
      createdBy: currentUser?.uid || '',
      createdByName: currentUser?.name || 'User',
    });
    toast.success('Surat Pengantar Gambar (Transmittal) PDF berhasil diunduh');
  };

  const handleDownloadMasterDrawingRegister = () => {
    exportDrawingListToPDF(project.projectName, projectGroups, projectItems);
    recordGeneratedDocument({
      projectId: project.id,
      projectName: project.projectName,
      documentType: 'DrawingTransmittal',
      documentNumber: `MDR-${project.projectCode}-${new Date().toISOString().slice(0, 10)}`,
      title: `Master Drawing Register - ${project.projectName}`,
      version: 1,
      fileFormat: 'PDF',
      createdBy: currentUser?.uid || '',
      createdByName: currentUser?.name || 'User',
    });
    toast.success('Master Drawing Register PDF berhasil diunduh');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
          Pusat Dokumen Resmi Proyek (Official Documents Hub)
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Cetak dan unduh seluruh berkas finansial dan teknis ber-kop surat resmi PT. Asa Perdana Mandiri.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Surat Penawaran */}
        <div className="p-5 rounded-2xl border border-[var(--color-border)] bg-white/70 dark:bg-white/5 flex flex-col justify-between shadow-xs">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-sm text-[var(--color-text-primary)]">
              Surat Penawaran Harga (Quotation)
            </h4>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Dokumen penawaran harga resmi dengan rincian lingkup gambar, tahapan termin, dan syarat ketentuan.
            </p>
          </div>
          <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={handleDownloadQuotation}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Unduh Penawaran PDF
          </Button>
        </div>

        {/* Faktur Tagihan */}
        <div className="p-5 rounded-2xl border border-[var(--color-border)] bg-white/70 dark:bg-white/5 flex flex-col justify-between shadow-xs">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-sm text-[var(--color-text-primary)]">
              Faktur Penagihan Klien (Invoice)
            </h4>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Faktur penagihan termin proyek lengkap dengan instruksi transfer bank resmi PT. Asa Perdana Mandiri.
            </p>
          </div>
          <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={handleDownloadInvoice}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Unduh Invoice PDF
          </Button>
        </div>

        {/* Kwitansi Pembayaran */}
        <div className="p-5 rounded-2xl border border-[var(--color-border)] bg-white/70 dark:bg-white/5 flex flex-col justify-between shadow-xs">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-sm text-[var(--color-text-primary)]">
              Kwitansi Pembayaran (Official Receipt)
            </h4>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Tanda terima sah pembayaran klien yang telah terverifikasi dan masuk ke rekening perusahaan.
            </p>
          </div>
          <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={handleDownloadReceipt}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Unduh Kwitansi PDF
          </Button>
        </div>

        {/* Laporan Pengeluaran Proyek */}
        <div className="p-5 rounded-2xl border border-[var(--color-border)] bg-white/70 dark:bg-white/5 flex flex-col justify-between shadow-xs">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-sm text-[var(--color-text-primary)]">
              Laporan Biaya Operasional Proyek
            </h4>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Rekapitulasi seluruh pengeluaran operasional per kategori (site visit, printing, transport, ATK).
            </p>
          </div>
          <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={handleDownloadExpenses}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Unduh Laporan Biaya PDF
          </Button>
        </div>

        {/* Laporan Arus Kas */}
        <div className="p-5 rounded-2xl border border-[var(--color-border)] bg-white/70 dark:bg-white/5 flex flex-col justify-between shadow-xs">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-sm text-[var(--color-text-primary)]">
              Laporan Arus Kas (Cashflow Ledger)
            </h4>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Aliran kas masuk dan keluar secara kronologis dengan saldo berjalan (running balance).
            </p>
          </div>
          <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={handleDownloadCashflow}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Unduh Cashflow PDF
          </Button>
        </div>

        {/* Laporan Laba Rugi */}
        {canViewProfit() && (
          <div className="p-5 rounded-2xl border border-[var(--color-border)] bg-white/70 dark:bg-white/5 flex flex-col justify-between shadow-xs">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-sm text-[var(--color-text-primary)]">
                Laporan Laba Rugi (Profit & Loss)
              </h4>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Struktur kalkulasi laba kotor, beban subkon, beban operasional, laba bersih, dan profit margin.
              </p>
            </div>
            <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={handleDownloadPnL}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Unduh P&L PDF
            </Button>
          </div>
        )}

        {/* Laporan Hutang Vendor */}
        <div className="p-5 rounded-2xl border border-[var(--color-border)] bg-white/70 dark:bg-white/5 flex flex-col justify-between shadow-xs">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-sm text-[var(--color-text-primary)]">
              Laporan Hutang Vendor (Accounts Payable)
            </h4>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Monitoring tagihan pihak ketiga, jatuh tempo, sisa hutang berjalan, dan riwayat pembayaran subkon.
            </p>
          </div>
          <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={handleDownloadVendorAP}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Unduh Hutang Vendor PDF
          </Button>
        </div>

        {/* Drawing Transmittal */}
        <div className="p-5 rounded-2xl border border-[var(--color-border)] bg-white/70 dark:bg-white/5 flex flex-col justify-between shadow-xs">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-sm text-[var(--color-text-primary)]">
              Drawing Transmittal & Master Drawing Register
            </h4>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Surat pengantar resmi pengiriman gambar (Transmittal Letter) dan register lengkap gambar kerja CAD.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button variant="secondary" size="sm" className="flex-1" onClick={handleDownloadDrawingTransmittal} title="Unduh Surat Pengantar Transmittal Resmi">
              <Download className="w-3.5 h-3.5 mr-1" />
              Transmittal PDF
            </Button>
            <Button variant="secondary" size="sm" className="flex-1" onClick={handleDownloadMasterDrawingRegister} title="Unduh Daftar Master Drawing Register">
              <FileText className="w-3.5 h-3.5 mr-1" />
              Register PDF
            </Button>
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => exportDrawingListToExcel(project.projectName, projectGroups, projectItems)} title="Unduh Format Excel">
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
              Excel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
