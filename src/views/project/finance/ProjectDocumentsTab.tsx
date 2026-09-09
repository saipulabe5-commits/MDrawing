import React from 'react';
import { useParams } from 'react-router-dom';
import { useFinance } from '../../../context/FinanceContext';
import { useVendor } from '../../../context/VendorContext';
import { useExpense } from '../../../context/ExpenseContext';
import { useProjects } from '../../../context/ProjectContext';
import { useDocument } from '../../../context/DocumentContext';
import { useDrawings } from '../../../context/DrawingContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { Button, Card, Badge } from '../../../components/ui';
import { 
  FileText, Download, DollarSign, Receipt, CreditCard, 
  TrendingUp, Truck, Layers, FileSpreadsheet 
} from 'lucide-react';
import { 
  generateExpenseReportPdf, generateCashflowReportPdf, 
  generateProfitLossReportPdf, generateHutangReportPdf,
  generateQuotationPdf, generateInvoicePdf, generatePaymentReceiptPdf,
  exportDrawingListToPDF, exportDrawingListToExcel
} from '../../../lib/exportUtils';
import toast from 'react-hot-toast';

export function ProjectDocumentsTab() {
  const { id: projectId } = useParams<{ id: string }>();
  const { projects } = useProjects();
  const { quotations, invoices, clientPayments } = useFinance();
  const { vendors, projectVendors, vendorBills, vendorPayments } = useVendor();
  const { expenses, cashflowEntries } = useExpense();
  const { groups, items } = useDrawings();
  const { companySettings, recordGeneratedDocument } = useDocument();
  const { canViewProfit, canViewFinance, currentUser } = usePermissions();

  const project = projects.find((p) => p.id === projectId);

  if (!project) return null;

  const handleDownloadQuotation = () => {
    const q = quotations.find((item) => item.status === 'Approved' || item.status === 'Sent') || quotations[0];
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
    const inv = invoices.find((item) => item.status === 'Sent' || item.status === 'Paid') || invoices[0];
    if (!inv) {
      toast.error('Belum ada data Faktur Tagihan (Invoice) untuk proyek ini.');
      return;
    }
    generateInvoicePdf(inv, quotations[0], project, { companyName: project.clientName || 'Klien' } as any, 'Termin Proyek');
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
    const pay = clientPayments.find((item) => item.status === 'Confirmed') || clientPayments[0];
    if (!pay) {
      toast.error('Belum ada catatan pembayaran klien terkonfirmasi.');
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
    generateExpenseReportPdf(project, expenses, companySettings);
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

  const handleDownloadCashflow = () => {
    const totalIn = clientPayments.filter((cp) => cp.status === 'Confirmed').reduce((s, cp) => s + cp.amount, 0);
    const totalOutVendor = vendorPayments.filter((vp) => vp.status === 'Confirmed').reduce((s, vp) => s + vp.amount, 0);
    const totalOutExp = expenses.filter((e) => e.status === 'Approved' || e.status === 'Paid').reduce((s, e) => s + e.amount, 0);
    const totalOut = totalOutVendor + totalOutExp;

    const entries = [
      ...clientPayments.filter((cp) => cp.status === 'Confirmed').map((cp) => ({
        id: cp.id,
        date: cp.paymentDate,
        type: 'IN' as const,
        category: 'Client Payment' as const,
        referenceNumber: cp.paymentNumber,
        description: `Pembayaran Klien (${cp.paymentMethod})`,
        amount: cp.amount,
        createdAt: new Date().toISOString(),
      })),
      ...vendorPayments.filter((vp) => vp.status === 'Confirmed').map((vp) => ({
        id: vp.id,
        date: vp.paymentDate,
        type: 'OUT' as const,
        category: 'Vendor Payment' as const,
        referenceNumber: vp.paymentNumber,
        description: `Bayar Subkon (${vp.paymentMethod})`,
        amount: vp.amount,
        createdAt: new Date().toISOString(),
      })),
      ...expenses.filter((e) => e.status === 'Approved' || e.status === 'Paid').map((e) => ({
        id: e.id,
        date: e.expenseDate,
        type: 'OUT' as const,
        category: 'Project Expense' as const,
        referenceNumber: e.expenseNumber,
        description: e.description,
        amount: e.amount,
        createdAt: new Date().toISOString(),
      })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    generateCashflowReportPdf(project, entries, { totalIn, totalOut, balance: totalIn - totalOut }, companySettings);
    recordGeneratedDocument({
      projectId: project.id,
      projectName: project.projectName,
      documentType: 'CashflowReport',
      documentNumber: `CF-${project.projectCode}-${new Date().toISOString().slice(0, 10)}`,
      title: `Laporan Arus Kas - ${project.projectName}`,
      version: 1,
      fileFormat: 'PDF',
      createdBy: currentUser?.uid || '',
      createdByName: currentUser?.name || 'User',
    });
    toast.success('Laporan Arus Kas PDF berhasil diunduh');
  };

  const handleDownloadPnL = () => {
    const contractVal = project.contractValue || 0;
    const vendorCost = vendorBills.reduce((s, b) => s + (b.status !== 'Cancelled' ? b.amount : 0), 0);
    const gross = contractVal - vendorCost;
    const expCost = expenses.reduce((s, e) => s + (e.status === 'Approved' || e.status === 'Paid' ? e.amount : 0), 0);
    const net = gross - expCost;
    const margin = contractVal > 0 ? (net / contractVal) * 100 : 0;

    generateProfitLossReportPdf(
      project,
      {
        contractValue: contractVal,
        totalVendorCost: vendorCost,
        grossProfit: gross,
        totalExpenses: expCost,
        netProfit: net,
        profitMargin: margin,
        expectedProfit: project.expectedProfit,
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

  const handleDownloadVendorAP = () => {
    generateHutangReportPdf(project, vendors, projectVendors, vendorBills, vendorPayments);
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
    exportDrawingListToPDF(project.projectName, groups, items);
    recordGeneratedDocument({
      projectId: project.id,
      projectName: project.projectName,
      documentType: 'DrawingTransmittal',
      documentNumber: `TRM-${project.projectCode}-${new Date().toISOString().slice(0, 10)}`,
      title: `Drawing Transmittal - ${project.projectName}`,
      version: 1,
      fileFormat: 'PDF',
      createdBy: currentUser?.uid || '',
      createdByName: currentUser?.name || 'User',
    });
    toast.success('Transmittal Gambar PDF berhasil diunduh');
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
              Drawing Transmittal / Berita Acara Gambar
            </h4>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Daftar seluruh item gambar kerja, kode lembar, status produksi, dan revisi terkini.
            </p>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="secondary" size="sm" className="flex-1" onClick={handleDownloadDrawingTransmittal}>
              <Download className="w-3.5 h-3.5 mr-1" />
              PDF
            </Button>
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => exportDrawingListToExcel(project.projectName, groups, items)}>
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
              Excel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
