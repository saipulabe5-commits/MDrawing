import { createBrandedPdf, requireInvoiceBank } from './brandedPdf';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Quotation, 
  Invoice, 
  ClientPayment, 
  ProjectExpense, 
  CashflowEntry, 
  ProjectVendor, 
  VendorBill, 
  VendorPayment
} from '../types';
import { formatCurrency, formatDate } from './formatters';


export function generateInvoicePDF(invoice: Invoice, quotation?: Quotation, clientName?: string) {
  if(['Void','Cancelled'].includes(invoice.status))throw new Error('Invoice dibatalkan tidak dapat diterbitkan sebagai tagihan.');
  const bank=requireInvoiceBank();
  const doc = createBrandedPdf();
  doc.setFontSize(8);doc.text(bank.bankName+' '+bank.accountNumber+' a/n '+bank.accountHolder,14,doc.internal.pageSize.height-16);
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.status==='Draft'?'DRAFT INVOICE — BELUM DITERBITKAN':'FAKTUR PENAGIHAN (INVOICE)', 14, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('PT. ASA PERDANA MANDIRI', 14, 28);
  doc.line(14, 34, 196, 34);

  doc.text(`No. Invoice: ${invoice.invoiceNumber}`, 14, 42);
  doc.text(`Tanggal: ${formatDate(invoice.date || invoice.createdAt)}`, 14, 47);
  doc.text(`Jatuh Tempo: ${formatDate(invoice.dueDate)}`, 14, 52);

  if (clientName) doc.text(`Kepada: ${clientName}`, 120, 42);
  doc.text(`Status: ${invoice.status}`, 120, 47);

  autoTable(doc, {
    startY: 60,
    head: [['Deskripsi Tagihan', 'Jumlah']],
    body: [
      [`Tagihan Pekerjaan Gambar Kerja / Termin Proyek`, formatCurrency(invoice.grandTotal)]
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 9 }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 100;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Tagihan:`, 130, finalY + 10);
  doc.text(formatCurrency(invoice.grandTotal), 196, finalY + 10, { align: 'right' });

  doc.text(`Sudah Dibayar:`, 130, finalY + 16);
  doc.text(formatCurrency(invoice.amountPaid || invoice.paidAmount || 0), 196, finalY + 16, { align: 'right' });

  const remaining = invoice.grandTotal - (invoice.amountPaid || invoice.paidAmount || 0);
  doc.text(`Sisa Pembayaran:`, 130, finalY + 24);
  doc.text(formatCurrency(Math.max(0, remaining)), 196, finalY + 24, { align: 'right' });

  doc.save(`Invoice_${invoice.invoiceNumber}.pdf`);
}

export function generatePaymentReceiptPDF(payment: ClientPayment, invoice?: Invoice) {
  if(payment.status!=='Confirmed')throw new Error('Kwitansi hanya dapat diterbitkan untuk pembayaran Confirmed.');
  const bank=requireInvoiceBank();
  const doc = createBrandedPdf();
  doc.setFontSize(8);doc.text(bank.bankName+' '+bank.accountNumber+' a/n '+bank.accountHolder,14,doc.internal.pageSize.height-16);
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('KUITANSI RESMI PEMBAYARAN', 14, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('PT. ASA PERDANA MANDIRI', 14, 28);
  doc.line(14, 34, 196, 34);

  doc.text(`No. Kuitansi: ${payment.paymentNumber || 'KWT-DOC'}`, 14, 42);
  doc.text(`Tanggal Pembayaran: ${formatDate(payment.paymentDate)}`, 14, 47);
  doc.text(`Metode Bayar: ${payment.paymentMethod || 'Transfer Bank'}`, 14, 52);
  if (payment.referenceNumber) doc.text(`Ref / No Bukti: ${payment.referenceNumber}`, 14, 57);

  autoTable(doc, {
    startY: 65,
    head: [['Keterangan Pembayaran', 'Nominal']],
    body: [
      [
        `Diterima pembayaran pelunasan termin gambar kerja.\nRef Invoice: ${invoice?.invoiceNumber || '-'}\nCatatan: ${payment.notes || '-'}`,
        formatCurrency(payment.amount)
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129] },
    styles: { fontSize: 9 }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 100;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL DITERIMA: ${formatCurrency(payment.amount)}`, 14, finalY + 15);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Dokumen ini sah dan diterbitkan secara digital oleh Sistem MDrawing PT. APM', 14, finalY + 22);

  doc.save(`Kuitansi_${payment.paymentNumber || 'Doc'}.pdf`);
}

export function generateExpenseReportPDF(expenses: ProjectExpense[], title: string = 'Laporan Pengeluaran Proyek') {
  const doc = createBrandedPdf();
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), 14, 20);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('PT. ASA PERDANA MANDIRI - REKAP BIAYA OPERASIONAL', 14, 26);
  doc.line(14, 30, 196, 30);

  const total = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);

  const tableBody = expenses.map((e, idx) => [
    idx + 1,
    formatDate(e.expenseDate),
    e.expenseCategory || 'Operasional',
    e.description || '-',
    e.paymentMethod || 'Kas',
    formatCurrency(e.amount)
  ]);

  autoTable(doc, {
    startY: 36,
    head: [['No', 'Tanggal', 'Kategori', 'Keterangan', 'Sumber', 'Jumlah']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [225, 29, 72] },
    styles: { fontSize: 8 }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 100;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Biaya Operasional: ${formatCurrency(total)}`, 196, finalY + 10, { align: 'right' });

  doc.save(`Laporan_Biaya_${Date.now()}.pdf`);
}

export function generateCashflowReportPDF(
  entries: CashflowEntry[], 
  projectName: string,
  summary: { totalCashIn: number; totalCashOut: number; netCashflow: number }
) {
  const doc = createBrandedPdf();
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`LAPORAN ARUS KAS (CASHFLOW) - ${projectName.toUpperCase()}`, 14, 20);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('PT. ASA PERDANA MANDIRI', 14, 26);
  doc.line(14, 30, 196, 30);

  doc.setFontSize(9);
  doc.text(`Total Kas Masuk: ${formatCurrency(summary.totalCashIn)}`, 14, 38);
  doc.text(`Total Kas Keluar: ${formatCurrency(summary.totalCashOut)}`, 14, 43);
  doc.setFont('helvetica', 'bold');
  doc.text(`Net Cashflow: ${formatCurrency(summary.netCashflow)}`, 14, 48);

  doc.save(`Cashflow_${projectName.replace(/\s+/g, '_')}.pdf`);
}

export function generateProfitLossReportPDF(
  summary: { contractValue: number; totalInvoiced: number; totalExpenses: number; projectedProfit: number; profitMargin: number },
  projectName: string
) {
  const doc = createBrandedPdf();
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`LAPORAN LABA RUGI (P&L) - ${projectName.toUpperCase()}`, 14, 20);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('PT. ASA PERDANA MANDIRI', 14, 26);
  doc.line(14, 30, 196, 30);

  autoTable(doc, {
    startY: 38,
    head: [['Indikator Finansial', 'Nilai']],
    body: [
      ['Nilai Kontrak Proyek', formatCurrency(summary.contractValue)],
      ['Total Tagihan Diterbitkan', formatCurrency(summary.totalInvoiced)],
      ['Total Biaya & Beban Proyek', formatCurrency(summary.totalExpenses)],
      ['Proyeksi Laba Bersih', formatCurrency(summary.projectedProfit)],
      ['Margin Keuntungan (%)', `${Math.round(summary.profitMargin)}%`]
    ],
    theme: 'grid',
    headStyles: { fillColor: [147, 51, 234] },
    styles: { fontSize: 9 }
  });

  doc.save(`ProfitLoss_${projectName.replace(/\s+/g, '_')}.pdf`);
}

export function generateVendorAPReportPDF(
  vendors: ProjectVendor[],
  bills: VendorBill[],
  payments: VendorPayment[],
  projectName: string
) {
  const doc = createBrandedPdf();
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`LAPORAN REKONSILIASI HUTANG VENDOR - ${projectName.toUpperCase()}`, 14, 20);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('PT. ASA PERDANA MANDIRI', 14, 26);
  doc.line(14, 30, 196, 30);

  const tableBody = vendors.map((v, idx) => {
    const vBills = bills.filter(b => b.projectVendorId === v.id);
    const vPays = payments.filter(p => p.projectVendorId === v.id);
    const totalBilled = vBills.reduce((acc, b) => acc + (b.amount || 0), 0);
    const totalPaid = vPays.reduce((acc, p) => acc + (p.amount || 0), 0);
    const sisa = Math.max(0, totalBilled - totalPaid);

    return [
      idx + 1,
      v.vendorName,
      v.scopeOfWork || 'Subkon',
      formatCurrency(v.contractValue || 0),
      formatCurrency(totalBilled),
      formatCurrency(totalPaid),
      formatCurrency(sisa)
    ];
  });

  autoTable(doc, {
    startY: 36,
    head: [['No', 'Nama Vendor', 'Lingkup', 'SPK', 'Ditagihkan', 'Terbayar', 'Sisa Hutang']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [8, 145, 178] },
    styles: { fontSize: 8 }
  });

  doc.save(`VendorAP_${projectName.replace(/\s+/g, '_')}.pdf`);
}
