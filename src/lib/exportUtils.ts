import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { 
  DrawingItem, DrawingGroup, Quotation, Invoice, Project, Client, ClientPayment,
  Vendor, ProjectVendor, VendorBill, VendorPayment, VendorPaymentTerm,
  ProjectExpense, CashflowEntry, CompanySettings, DrawingTransmittal
} from '../types';
import { formatScale } from './scaleUtils';

export function exportDrawingListToPDF(
  projectName: string, 
  groups: DrawingGroup[], 
  items: DrawingItem[],
  projectCode?: string
) {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a3' });
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  const didDrawPage = (data: any) => {
    // Outer border
    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 0, 0);
    doc.rect(10, 10, pageWidth - 20, pageHeight - 20); 
    doc.setLineWidth(0.2);
    doc.rect(11, 11, pageWidth - 22, pageHeight - 22);
    
    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(`DAFTAR GAMBAR ${projectName.toUpperCase()}`, 15, 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    doc.text(`TANGGAL: ${dateStr}`, pageWidth - 15, 25, { align: 'right' });
    
    // Header line
    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 0, 0);
    doc.line(11, 30, pageWidth - 11, 30);
    
    // Reset colors
    doc.setTextColor(0);
  };

  const tableBody: any[] = [];
  
  // Filter non-deleted items
  const validItems = items.filter(i => !i.isDeleted);
  
  // Create mapping
  const groupMap = new Map(groups.map(g => [g.id, g]));
  
  // Sort groups by sortOrder
  const sortedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);
  
  // Sort items matching CAD sheet logic
  let rowNum = 1;
  
  sortedGroups.forEach(grp => {
    const grpItems = validItems.filter(i => i.groupId === grp.id).sort((a, b) => a.sortOrder - b.sortOrder);
    if (grpItems.length > 0) {
      tableBody.push([{ 
        content: `  ${grp.groupName.toUpperCase()}`, 
        colSpan: 5, 
        styles: { fillColor: [240, 244, 248], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'left' } 
      }]);
      grpItems.forEach(item => {
        tableBody.push([
          rowNum++,
          item.drawingNumber,
          item.drawingName,
          item.status || 'Belum Mulai',
          formatScale(item.scale)
        ]);
      });
    }
  });

  const unassignedItems = validItems.filter(i => !i.groupId || !groupMap.has(i.groupId)).sort((a, b) => a.sortOrder - b.sortOrder);
  if (unassignedItems.length > 0) {
    tableBody.push([{ 
      content: `  GAMBAR LAIN-LAIN`, 
      colSpan: 5, 
      styles: { fillColor: [240, 244, 248], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'left' } 
    }]);
    unassignedItems.forEach(item => {
      tableBody.push([
        rowNum++,
        item.drawingNumber,
        item.drawingName,
        item.status || 'Belum Mulai',
        formatScale(item.scale)
      ]);
    });
  }

  if (tableBody.length === 0) {
    tableBody.push([{ content: 'Tidak ada data gambar dalam proyek ini.', colSpan: 5, styles: { halign: 'center' } }]);
  }

  autoTable(doc, {
    startY: 35,
    margin: { top: 35, bottom: 15, left: 15, right: 15 },
    didDrawPage: didDrawPage,
    head: [['NO', 'NO GAMBAR', 'JUDUL GAMBAR', 'KET', 'SKALA']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 11 },
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 45, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 35, halign: 'center' },
      4: { cellWidth: 30, halign: 'center', textColor: [180, 83, 9], fontStyle: 'bold' }
    },
    didParseCell: function(hookData: any) {
      // Style the PIC: line to be slightly lighter if possible
      // Not easily supported by jspdf-autotable out of the box, 
      // but we make sure the structure matches CAD template.
    }
  });

  doc.save(`Daftar_Gambar_${projectName.replace(/\s+/g, '_')}.pdf`);
}

export function exportDrawingListToExcel(
  projectName: string, 
  groups: DrawingGroup[], 
  items: DrawingItem[],
  projectCode?: string
) {
  const groupMap = new Map(groups.map(g => [g.id, g.groupName]));
  
  const sortedItems = [...items].sort((a, b) => {
    const gA = a.groupId ? groupMap.get(a.groupId) || 'Z' : 'Z';
    const gB = b.groupId ? groupMap.get(b.groupId) || 'Z' : 'Z';
    if (gA === gB) return a.sortOrder - b.sortOrder;
    return gA.localeCompare(gB);
  });

  let counter = 1;
  const data = sortedItems.length === 0 ? [{ Info: 'Tidak ada data gambar' }] : sortedItems.map(item => ({
    'No': counter++,
    'Grup / Kategori': item.groupId ? (groupMap.get(item.groupId) || 'Tanpa Kategori') : 'Tanpa Kategori',
    'No. Gambar': item.drawingNumber,
    'Judul Gambar': item.drawingName,
    'Skala': formatScale(item.scale),
    'PIC Drafter': item.picName || 'Belum Ditugaskan',
    'Status & Ket': item.status,
    'Progress (%)': item.progress,
    'Prioritas': item.priority,
    'Target Deadline': item.deadline ? new Date(item.deadline).toLocaleDateString('id-ID') : '-',
    'Revisi Ke': item.revisionCount,
    'Catatan': item.notes || '-'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Daftar Gambar");
  
  XLSX.writeFile(workbook, `Daftar_Gambar_${projectName.replace(/\s+/g, '_')}.xlsx`);
}

export function generateQuotationPdf(quotation: Quotation, project: Project, client: Client | undefined) {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.text('PENAWARAN (QUOTATION)', 14, 20);
  
  doc.setFontSize(10);
  doc.text(`No: ${quotation.quotationNumber}`, 14, 30);
  doc.text(`Tanggal: ${new Date(quotation.date).toLocaleDateString('id-ID')}`, 14, 35);
  doc.text(`Proyek: ${project.projectName}`, 14, 40);
  
  doc.text('Kepada Yth:', 120, 30);
  doc.setFont('helvetica', 'bold');
  doc.text(client?.companyName || '-', 120, 35);
  doc.setFont('helvetica', 'normal');
  doc.text(client?.address || '-', 120, 40);
  
  const tableBody = quotation.items.map((item, idx) => [
    idx + 1,
    item.description,
    item.quantity,
    item.unit,
    `Rp ${item.unitPrice.toLocaleString('id-ID')}`,
    `Rp ${item.totalPrice.toLocaleString('id-ID')}`
  ]);
  
  autoTable(doc, {
    startY: 50,
    head: [['No', 'Deskripsi', 'Qty', 'Satuan', 'Harga Satuan', 'Total']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [0, 122, 255] }
  });
  
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const subTotal = quotation.items.reduce((sum, item) => sum + item.totalPrice, 0);
  
  doc.text('Subtotal:', 120, finalY);
  doc.text(`Rp ${subTotal.toLocaleString('id-ID')}`, 160, finalY);
  
  doc.text(`Diskon:`, 120, finalY + 7);
  doc.text(`Rp ${quotation.discount.toLocaleString('id-ID')}`, 160, finalY + 7);
  
  doc.text(`Pajak (${quotation.taxPercentage}%):`, 120, finalY + 14);
  doc.text(`Rp ${quotation.tax.toLocaleString('id-ID')}`, 160, finalY + 14);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Grand Total:`, 120, finalY + 24);
  doc.text(`Rp ${quotation.grandTotal.toLocaleString('id-ID')}`, 160, finalY + 24);
  
  if (quotation.notes) {
    doc.setFont('helvetica', 'normal');
    doc.text('Catatan:', 14, finalY + 40);
    doc.text(quotation.notes, 14, finalY + 45, { maxWidth: 100 });
  }
  
  doc.save(`Quotation_${quotation.quotationNumber}.pdf`);
}

export function generateInvoicePdf(invoice: Invoice, quotation: Quotation | undefined, project: Project, client: Client | undefined, termName: string = 'Invoice') {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.text('FAKTUR (INVOICE)', 14, 20);
  
  doc.setFontSize(10);
  doc.text(`No: ${invoice.invoiceNumber}`, 14, 30);
  doc.text(`Tanggal: ${new Date(invoice.createdAt).toLocaleDateString('id-ID')}`, 14, 35);
  doc.text(`Jatuh Tempo: ${new Date(invoice.dueDate).toLocaleDateString('id-ID')}`, 14, 40);
  
  doc.text('Kepada Yth:', 120, 30);
  doc.setFont('helvetica', 'bold');
  doc.text(client?.companyName || '-', 120, 35);
  doc.setFont('helvetica', 'normal');
  doc.text(client?.address || '-', 120, 40);
  
  doc.text(`Proyek: ${project.projectName}`, 14, 55);
  doc.text(`Referensi Penawaran: ${quotation?.quotationNumber || '-'}`, 14, 60);

  autoTable(doc, {
    startY: 70,
    head: [['Deskripsi', 'Jumlah']],
    body: [
      [`Tagihan untuk: ${termName} Proyek ${project.projectName}`, `Rp ${invoice.grandTotal.toLocaleString('id-ID')}`]
    ],
    theme: 'grid',
    headStyles: { fillColor: [0, 122, 255] }
  });
  
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Tagihan:`, 120, finalY);
  doc.text(`Rp ${invoice.grandTotal.toLocaleString('id-ID')}`, 160, finalY);
  
  doc.text(`Telah Dibayar:`, 120, finalY + 7);
  doc.text(`Rp ${invoice.amountPaid.toLocaleString('id-ID')}`, 160, finalY + 7);
  
  const sisa = invoice.grandTotal - invoice.amountPaid;
  doc.text(`Sisa Tagihan:`, 120, finalY + 14);
  doc.text(`Rp ${sisa.toLocaleString('id-ID')}`, 160, finalY + 14);
  
  doc.save(`Invoice_${invoice.invoiceNumber}.pdf`);
}

export function generatePaymentReceiptPdf(
  payment: ClientPayment, 
  project: Project, 
  client: Client | undefined, 
  company?: Partial<CompanySettings>
) {
  const doc = new jsPDF();
  const legalName = company?.companyName || "PT. Asa Perdana Mandiri";

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(legalName.toUpperCase(), 14, 15);

  doc.setFontSize(18);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text('KWITANSI PEMBAYARAN RESMI', 14, 25);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`No. Kwitansi: ${payment.paymentNumber}`, 14, 35);
  doc.text(`Tanggal Pembayaran: ${new Date(payment.paymentDate).toLocaleDateString('id-ID')}`, 14, 40);
  doc.text(`Metode: ${payment.paymentMethod}`, 14, 45);
  doc.text(`No. Referensi: ${payment.referenceNumber || '-'}`, 14, 50);

  doc.text('Diterima Dari:', 120, 35);
  doc.setFont('helvetica', 'bold');
  doc.text(client?.companyName || client?.clientName || project.clientName || '-', 120, 40);
  doc.setFont('helvetica', 'normal');
  doc.text(client?.address || '-', 120, 45, { maxWidth: 75 });

  doc.text(`Proyek: ${project.projectName} (${project.projectCode})`, 14, 62);

  autoTable(doc, {
    startY: 70,
    head: [['Uraian Pembayaran', 'Jumlah']],
    body: [
      [
        `Pembayaran untuk termin proyek arsitektur/perencanaan:\n${project.projectName}\nCatatan: ${payment.notes || '-'}`,
        `Rp ${payment.amount.toLocaleString('id-ID')}`
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: [0, 122, 255] }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Jumlah Pembayaran:`, 110, finalY);
  doc.text(`Rp ${payment.amount.toLocaleString('id-ID')}`, 160, finalY);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Status: Pembayaran Sah & Terverifikasi', 14, finalY + 15);
  doc.text('Diterbitkan oleh Sistem MDrawing - PT. Asa Perdana Mandiri', 14, finalY + 20);

  doc.text('Tanda Tangan Bagian Keuangan:', 120, finalY + 15);
  doc.text(company?.defaultSignatoryName || 'Saipul Abe, S.T., IAI', 120, finalY + 35);
  doc.text(company?.defaultSignatoryTitle || 'Direktur Utama', 120, finalY + 40);

  doc.save(`Kwitansi_${payment.paymentNumber}.pdf`);
}

export function generatePiutangReportPdf(invoices: Invoice[], payments: ClientPayment[], clients: Client[]) {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.text('LAPORAN PIUTANG (ACCOUNTS RECEIVABLE)', 14, 20);
  
  doc.setFontSize(10);
  doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 30);
  
  const tableBody = invoices.map(inv => {
    const sisa = inv.grandTotal - inv.amountPaid;
    return [
      inv.invoiceNumber,
      new Date(inv.dueDate).toLocaleDateString('id-ID'),
      `Rp ${inv.grandTotal.toLocaleString('id-ID')}`,
      `Rp ${inv.amountPaid.toLocaleString('id-ID')}`,
      `Rp ${sisa.toLocaleString('id-ID')}`,
      inv.status
    ];
  });
  
  autoTable(doc, {
    startY: 40,
    head: [['No. Invoice', 'Jatuh Tempo', 'Total', 'Dibayar', 'Sisa', 'Status']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [0, 122, 255] }
  });
  
  doc.save(`Laporan_Piutang_${new Date().getTime()}.pdf`);
}

export function generateVendorBillPdf(
  bill: VendorBill, 
  projectVendor: ProjectVendor | undefined, 
  vendor: Vendor | undefined, 
  project: Project | undefined
) {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.text('TAGIHAN VENDOR (VENDOR BILL)', 14, 20);
  
  doc.setFontSize(10);
  doc.text(`No. Tagihan: ${bill.billNumber}`, 14, 30);
  doc.text(`Tanggal: ${new Date(bill.billDate).toLocaleDateString('id-ID')}`, 14, 35);
  doc.text(`Jatuh Tempo: ${bill.dueDate ? new Date(bill.dueDate).toLocaleDateString('id-ID') : '-'}`, 14, 40);
  doc.text(`Status: ${bill.status}`, 14, 45);
  
  doc.text('Vendor / Penerima Pembayaran:', 120, 30);
  doc.setFont('helvetica', 'bold');
  doc.text(vendor?.vendorName || projectVendor?.vendorName || '-', 120, 35);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tipe: ${vendor?.vendorType || projectVendor?.vendorType || '-'}`, 120, 40);
  doc.text(`Kontak: ${vendor?.contactPerson || '-'} (${vendor?.phone || '-'})`, 120, 45);
  doc.text(`Rekening: ${vendor?.bankName || '-'} - ${vendor?.bankAccountNumber || '-'} (${vendor?.bankAccountHolder || '-'})`, 120, 50);
  
  doc.text(`Proyek: ${project?.projectName || '-'} (${project?.projectCode || '-'})`, 14, 60);
  doc.text(`Scope Pekerjaan: ${projectVendor?.scopeOfWork || '-'}`, 14, 65);

  autoTable(doc, {
    startY: 75,
    head: [['Deskripsi Tagihan', 'Jumlah Tagihan']],
    body: [
      [
        `Tagihan Vendor untuk: ${projectVendor?.scopeOfWork || 'Pekerjaan Subkon/Vendor'}\nProyek: ${project?.projectName || '-'}`,
        `Rp ${bill.amount.toLocaleString('id-ID')}`
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40] }
  });
  
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Tagihan:`, 120, finalY);
  doc.text(`Rp ${bill.amount.toLocaleString('id-ID')}`, 160, finalY);
  
  doc.text(`Telah Dibayar:`, 120, finalY + 7);
  doc.text(`Rp ${bill.paidAmount.toLocaleString('id-ID')}`, 160, finalY + 7);
  
  doc.text(`Sisa Hutang:`, 120, finalY + 14);
  doc.text(`Rp ${bill.remainingAmount.toLocaleString('id-ID')}`, 160, finalY + 14);
  
  if (bill.notes) {
    doc.setFont('helvetica', 'normal');
    doc.text('Catatan:', 14, finalY + 25);
    doc.text(bill.notes, 14, finalY + 30, { maxWidth: 100 });
  }

  doc.save(`VendorBill_${bill.billNumber}.pdf`);
}

export function generateVendorPaymentReceiptPdf(
  payment: VendorPayment, 
  bill: VendorBill | undefined, 
  vendor: Vendor | undefined, 
  project: Project | undefined
) {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.text('BUKTI PENGELUARAN KAS / PEMBAYARAN VENDOR', 14, 20);
  
  doc.setFontSize(10);
  doc.text(`No. Bukti Bayar: ${payment.paymentNumber}`, 14, 30);
  doc.text(`Tanggal Pembayaran: ${new Date(payment.paymentDate).toLocaleDateString('id-ID')}`, 14, 35);
  doc.text(`Metode: ${payment.paymentMethod} (Sumber: ${payment.bankSource || 'Kas'})`, 14, 40);
  doc.text(`No. Referensi: ${payment.referenceNumber || '-'}`, 14, 45);
  doc.text(`Status: ${payment.status}`, 14, 50);
  
  doc.text('Dibayarkan Kepada:', 120, 30);
  doc.setFont('helvetica', 'bold');
  doc.text(vendor?.vendorName || '-', 120, 35);
  doc.setFont('helvetica', 'normal');
  doc.text(`Rekening Tujuan: ${vendor?.bankName || '-'} ${vendor?.bankAccountNumber || '-'} a/n ${vendor?.bankAccountHolder || '-'}`, 120, 40);
  
  doc.text(`Proyek: ${project?.projectName || '-'}`, 14, 62);
  doc.text(`Tagihan Referensi: ${bill?.billNumber || '-'}`, 14, 67);

  autoTable(doc, {
    startY: 75,
    head: [['Deskripsi Transaksi', 'Jumlah Dibayar']],
    body: [
      [
        `Pembayaran Tagihan No. ${bill?.billNumber || '-'}\nProyek: ${project?.projectName || '-'}`,
        `Rp ${payment.amount.toLocaleString('id-ID')}`
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: [52, 199, 89] }
  });
  
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Total Pembayaran:`, 120, finalY);
  doc.text(`Rp ${payment.amount.toLocaleString('id-ID')}`, 160, finalY);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (payment.notes) {
    doc.text('Keterangan:', 14, finalY + 15);
    doc.text(payment.notes, 14, finalY + 20, { maxWidth: 100 });
  }

  doc.text('Tanda Tangan Bagian Keuangan:', 120, finalY + 30);
  doc.text('_____________________________', 120, finalY + 50);

  doc.save(`BuktiBayarVendor_${payment.paymentNumber}.pdf`);
}

export function generateHutangReportPdf(
  project: Project, 
  vendors: Vendor[], 
  projectVendors: ProjectVendor[], 
  bills: VendorBill[], 
  payments: VendorPayment[]
) {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(`LAPORAN HUTANG VENDOR - ${project.projectName}`, 14, 20);
  
  doc.setFontSize(10);
  doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 28);
  doc.text(`Kode Proyek: ${project.projectCode}`, 14, 34);

  const vendorMap = new Map(vendors.map(v => [v.id, v]));

  // Summary calculation
  const totalBills = bills.reduce((acc, b) => acc + (b.status !== 'Cancelled' && b.status !== 'Void' ? b.amount : 0), 0);
  const totalPaid = bills.reduce((acc, b) => acc + (b.status !== 'Cancelled' && b.status !== 'Void' ? b.paidAmount : 0), 0);
  const totalRemaining = totalBills - totalPaid;
  const overdueBills = bills.filter(b => b.remainingAmount > 0 && b.dueDate && new Date(b.dueDate) < new Date() && !['Void', 'Cancelled'].includes(b.status));
  const totalOverdue = overdueBills.reduce((acc, b) => acc + b.remainingAmount, 0);

  doc.text(`Total Tagihan: Rp ${totalBills.toLocaleString('id-ID')}`, 14, 44);
  doc.text(`Total Terbayar: Rp ${totalPaid.toLocaleString('id-ID')}`, 80, 44);
  doc.text(`Sisa Hutang Berjalan: Rp ${totalRemaining.toLocaleString('id-ID')}`, 14, 50);
  doc.text(`Hutang Jatuh Tempo: Rp ${totalOverdue.toLocaleString('id-ID')}`, 80, 50);

  const tableBody = bills.map(bill => {
    const v = vendorMap.get(bill.vendorId);
    const isOverdue = bill.remainingAmount > 0 && bill.dueDate && new Date(bill.dueDate) < new Date();
    return [
      bill.billNumber,
      v?.vendorName || '-',
      v?.vendorType || '-',
      bill.dueDate ? new Date(bill.dueDate).toLocaleDateString('id-ID') : '-',
      `Rp ${bill.amount.toLocaleString('id-ID')}`,
      `Rp ${bill.paidAmount.toLocaleString('id-ID')}`,
      `Rp ${bill.remainingAmount.toLocaleString('id-ID')}`,
      isOverdue ? 'Jatuh Tempo' : bill.status
    ];
  });

  autoTable(doc, {
    startY: 58,
    head: [['No. Tagihan', 'Vendor', 'Jenis', 'Jatuh Tempo', 'Jumlah', 'Terbayar', 'Sisa', 'Status']],
    body: tableBody.length > 0 ? tableBody : [['-', 'Tidak ada data tagihan vendor', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [0, 122, 255] }
  });

  doc.save(`Laporan_Hutang_Vendor_${project.projectCode}.pdf`);
}

// -------------------------------------------------------------
// PHASE 5: CASHFLOW, EXPENSES, P&L, & FINANCIAL REPORTS
// -------------------------------------------------------------

export function generateExpenseReportPdf(
  project: Project,
  expenses: ProjectExpense[],
  company?: Partial<CompanySettings>
) {
  const doc = new jsPDF();
  const legalName = company?.companyName || "PT. Asa Perdana Mandiri";

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(legalName.toUpperCase(), 14, 15);
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(`LAPORAN BIAYA OPERASIONAL PROYEK`, 14, 23);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Proyek: ${project.projectName} (${project.projectCode})`, 14, 31);
  doc.text(`Klien: ${project.clientName || "-"}`, 14, 37);
  doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString("id-ID")}`, 140, 31);

  const totalExpense = expenses.reduce((acc, e) => acc + (e.status !== "Cancelled" ? e.amount : 0), 0);
  const budget = project.budgetOtherExpenses || 0;
  const variance = budget - totalExpense;

  doc.text(`Anggaran Operasional: Rp ${budget.toLocaleString("id-ID")}`, 14, 46);
  doc.text(`Total Realisasi Biaya: Rp ${totalExpense.toLocaleString("id-ID")}`, 80, 46);
  doc.text(`Sisa Anggaran: Rp ${variance.toLocaleString("id-ID")}`, 140, 46);

  const tableBody = expenses.map((exp, idx) => [
    (idx + 1).toString(),
    exp.expenseNumber,
    new Date(exp.expenseDate).toLocaleDateString("id-ID"),
    exp.expenseCategory,
    exp.description,
    exp.paidTo || "-",
    exp.paymentMethod || "-",
    `Rp ${exp.amount.toLocaleString("id-ID")}`,
    exp.status,
  ]);

  autoTable(doc, {
    startY: 52,
    head: [["No", "No. Bukti", "Tanggal", "Kategori", "Deskripsi", "Penerima", "Metode", "Jumlah", "Status"]],
    body: tableBody.length > 0 ? tableBody : [["-", "-", "-", "Belum ada pengeluaran", "-", "-", "-", "-", "-"]],
    theme: "grid",
    headStyles: { fillColor: [255, 149, 0] },
    styles: { fontSize: 8 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 100;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Total Pengeluaran: Rp ${totalExpense.toLocaleString("id-ID")}`, 130, finalY + 10);

  doc.save(`Laporan_Biaya_${project.projectCode}.pdf`);
}

export function generateCashflowReportPdf(
  project: Project,
  entries: CashflowEntry[],
  summary: { totalIn: number; totalOut: number; balance: number },
  company?: Partial<CompanySettings>
) {
  const doc = new jsPDF();
  const legalName = company?.companyName || "PT. Asa Perdana Mandiri";

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(legalName.toUpperCase(), 14, 15);
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(`LAPORAN ARUS KAS (CASHFLOW) PROYEK`, 14, 23);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Proyek: ${project.projectName} (${project.projectCode})`, 14, 31);
  doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString("id-ID")}`, 140, 31);

  doc.text(`Total Kas Masuk (In): Rp ${summary.totalIn.toLocaleString("id-ID")}`, 14, 42);
  doc.text(`Total Kas Keluar (Out): Rp ${summary.totalOut.toLocaleString("id-ID")}`, 80, 42);
  doc.setFont("helvetica", "bold");
  doc.text(`Saldo Kas Berjalan: Rp ${summary.balance.toLocaleString("id-ID")}`, 140, 42);
  doc.setFont("helvetica", "normal");

  let running = 0;
  const tableBody = entries.map((item, idx) => {
    if (item.type === "IN") {
      running += item.amount;
    } else {
      running -= item.amount;
    }
    return [
      (idx + 1).toString(),
      new Date(item.date).toLocaleDateString("id-ID"),
      item.referenceNumber || item.referenceType || "-",
      item.category,
      item.description,
      item.type === "IN" ? `Rp ${item.amount.toLocaleString("id-ID")}` : "-",
      item.type === "OUT" ? `Rp ${item.amount.toLocaleString("id-ID")}` : "-",
      `Rp ${running.toLocaleString("id-ID")}`,
    ];
  });

  autoTable(doc, {
    startY: 50,
    head: [["No", "Tanggal", "Ref/No. Dok", "Kategori", "Uraian", "Masuk (In)", "Keluar (Out)", "Saldo"]],
    body: tableBody.length > 0 ? tableBody : [["-", "-", "-", "-", "Belum ada transaksi arus kas", "-", "-", "-"]],
    theme: "grid",
    headStyles: { fillColor: [0, 122, 255] },
    styles: { fontSize: 8 },
  });

  doc.save(`Laporan_Cashflow_${project.projectCode}.pdf`);
}

export function generateProfitLossReportPdf(
  project: Project,
  pnl: {
    contractValue: number;
    totalVendorCost: number;
    grossProfit: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    expectedProfit?: number;
  },
  company?: Partial<CompanySettings>
) {
  const doc = new jsPDF();
  const legalName = company?.companyName || "PT. Asa Perdana Mandiri";

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(legalName.toUpperCase(), 14, 15);
  doc.setFontSize(18);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(`LAPORAN LABA RUGI PROYEK (PROFIT & LOSS)`, 14, 25);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Proyek: ${project.projectName} (${project.projectCode})`, 14, 34);
  doc.text(`Klien: ${project.clientName || "-"}`, 14, 40);
  doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString("id-ID")}`, 140, 34);

  autoTable(doc, {
    startY: 50,
    head: [["Komponen Finansial", "Nominal", "Catatan"]],
    body: [
      ["Nilai Kontrak Proyek (Pendapatan)", `Rp ${pnl.contractValue.toLocaleString("id-ID")}`, "Nilai Kontrak Disepakati"],
      ["Beban Pokok Produksi (Subkon/Vendor)", `(Rp ${pnl.totalVendorCost.toLocaleString("id-ID")})`, "Total Tagihan/Kontrak Vendor"],
      ["LABA KOTOR (GROSS PROFIT)", `Rp ${pnl.grossProfit.toLocaleString("id-ID")}`, "Pendapatan - Beban Vendor"],
      ["Biaya Operasional Proyek (Expenses)", `(Rp ${pnl.totalExpenses.toLocaleString("id-ID")})`, "Realisasi Biaya Operasional"],
      ["LABA BERSIH (NET PROFIT)", `Rp ${pnl.netProfit.toLocaleString("id-ID")}`, "Gross Profit - Biaya Operasional"],
      ["Profit Margin", `${pnl.profitMargin.toFixed(1)}%`, "Rasio Laba Bersih terhadap Kontrak"],
      ["Target Profit Diharapkan", pnl.expectedProfit ? `Rp ${pnl.expectedProfit.toLocaleString("id-ID")}` : "-", "Target Awal"],
    ],
    theme: "striped",
    headStyles: { fillColor: [52, 199, 89] },
    styles: { fontSize: 10 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 120;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Laporan ini dihitung secara otomatis berdasarkan transaksi keuangan tervalidasi di sistem MDrawing.", 14, finalY + 15);
  doc.text("Disahkan oleh Keuangan & Manajemen,", 14, finalY + 30);
  doc.text("__________________________________", 14, finalY + 55);

  doc.save(`Laporan_LabaRugi_${project.projectCode}.pdf`);
}

export function generateFinancialReportPdf(
  projects: Project[],
  summary: {
    totalContractValue: number;
    totalInvoiced: number;
    totalReceived: number;
    totalReceivable: number;
    totalVendorCost: number;
    totalVendorPaid: number;
    totalVendorPayable: number;
    totalExpenses: number;
    netCashflow: number;
    estimatedConsolidatedProfit: number;
  },
  company?: Partial<CompanySettings>
) {
  const doc = new jsPDF("landscape");
  const legalName = company?.companyName || "PT. Asa Perdana Mandiri";

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(legalName.toUpperCase(), 14, 15);
  doc.setFontSize(18);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(`LAPORAN KEUANGAN KONSOLIDASI SELURUH PROYEK`, 14, 25);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString("id-ID")}`, 14, 33);
  doc.text(`Jumlah Proyek: ${projects.length}`, 80, 33);

  // High-level summary boxes
  autoTable(doc, {
    startY: 40,
    head: [["Total Kontrak", "Penerimaan Klien", "Piutang Klien", "Biaya Subkon", "Hutang Subkon", "Biaya Operasional", "Estimasi Laba Konsolidasi"]],
    body: [[
      `Rp ${summary.totalContractValue.toLocaleString("id-ID")}`,
      `Rp ${summary.totalReceived.toLocaleString("id-ID")}`,
      `Rp ${summary.totalReceivable.toLocaleString("id-ID")}`,
      `Rp ${summary.totalVendorCost.toLocaleString("id-ID")}`,
      `Rp ${summary.totalVendorPayable.toLocaleString("id-ID")}`,
      `Rp ${summary.totalExpenses.toLocaleString("id-ID")}`,
      `Rp ${summary.estimatedConsolidatedProfit.toLocaleString("id-ID")}`,
    ]],
    theme: "grid",
    headStyles: { fillColor: [30, 30, 30] },
    styles: { fontSize: 8, fontStyle: "bold" },
  });

  const nextY = (doc as any).lastAutoTable?.finalY + 10 || 70;

  const tableBody = projects.map((p, idx) => [
    (idx + 1).toString(),
    p.projectCode,
    p.projectName,
    p.clientName || "-",
    p.status,
    `Rp ${(p.contractValue || 0).toLocaleString("id-ID")}`,
    `Rp ${(p.budgetOtherExpenses || 0).toLocaleString("id-ID")}`,
    p.expectedProfit ? `Rp ${p.expectedProfit.toLocaleString("id-ID")}` : "-",
  ]);

  autoTable(doc, {
    startY: nextY,
    head: [["No", "Kode", "Nama Proyek", "Klien", "Status", "Nilai Kontrak", "Budget Ops", "Target Profit"]],
    body: tableBody.length > 0 ? tableBody : [["-", "-", "Belum ada data proyek", "-", "-", "-", "-", "-"]],
    theme: "striped",
    headStyles: { fillColor: [0, 122, 255] },
    styles: { fontSize: 8 },
  });

  doc.save(`Laporan_Keuangan_Konsolidasi_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function generateTransmittalPdf(
  transmittal: DrawingTransmittal,
  project: Project,
  company?: Partial<CompanySettings>
) {
  const doc = new jsPDF();
  const legalName = company?.companyName || "PT. Asa Perdana Mandiri";

  // Kop Surat / Letterhead
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(legalName.toUpperCase(), 14, 15);
  
  if (company?.address) {
    doc.setFontSize(7);
    doc.text(company.address.substring(0, 80), 14, 19);
  }

  doc.setFontSize(15);
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.text("SURAT PENGANTAR GAMBAR (DRAWING TRANSMITTAL)", 14, 28);

  // Horizontal Accent Bar
  doc.setDrawColor(0, 122, 255);
  doc.setLineWidth(0.8);
  doc.line(14, 31, 196, 31);

  // Metadata Grid
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);

  // Left Column
  doc.setFont("helvetica", "bold");
  doc.text("Nomor Transmittal:", 14, 38);
  doc.setFont("helvetica", "normal");
  doc.text(transmittal.transmittalNumber, 55, 38);

  doc.setFont("helvetica", "bold");
  doc.text("Proyek:", 14, 44);
  doc.setFont("helvetica", "normal");
  doc.text(`${project.projectName} (${project.projectCode})`, 55, 44);

  doc.setFont("helvetica", "bold");
  doc.text("Klien Pemilik:", 14, 50);
  doc.setFont("helvetica", "normal");
  doc.text(project.clientName || "-", 55, 50);

  // Right Column
  doc.setFont("helvetica", "bold");
  doc.text("Tanggal Terbit:", 115, 38);
  doc.setFont("helvetica", "normal");
  doc.text(new Date(transmittal.issuedAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' }), 148, 38);

  doc.setFont("helvetica", "bold");
  doc.text("Penerima Dokumen:", 115, 44);
  doc.setFont("helvetica", "normal");
  doc.text(`${transmittal.recipientName} (${transmittal.recipientType})`, 148, 44);

  doc.setFont("helvetica", "bold");
  doc.text("Tujuan Pengiriman:", 115, 50);
  doc.setFont("helvetica", "normal");
  doc.text(transmittal.purpose, 148, 50);

  // Notes Box
  if (transmittal.notes) {
    doc.setFont("helvetica", "bold");
    doc.text("Catatan Pengantar:", 14, 57);
    doc.setFont("helvetica", "normal");
    doc.text(transmittal.notes, 55, 57);
  }

  const startTableY = transmittal.notes ? 63 : 56;

  // Drawing Items Snapshot Table
  const tableBody = transmittal.itemRevisionSnapshot.map((item, idx) => [
    (idx + 1).toString(),
    item.drawingNumber,
    item.drawingName,
    item.revisionNumber || "Rev 0",
    "Terkirim",
  ]);

  autoTable(doc, {
    startY: startTableY,
    head: [["No", "Nomor Gambar", "Judul / Uraian Gambar Kerja", "Status Revisi", "Keterangan"]],
    body: tableBody.length > 0 ? tableBody : [["-", "-", "Tidak ada item gambar terlampir", "-", "-"]],
    theme: "grid",
    headStyles: { fillColor: [0, 122, 255] },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 42, fontStyle: "bold" },
      2: { cellWidth: "auto" },
      3: { cellWidth: 30, halign: "center" },
      4: { cellWidth: 28, halign: "center" },
    },
    styles: { fontSize: 8.5 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 120;
  const signatureY = finalY + 15 > 250 ? 250 : finalY + 15;

  // Signatures Section
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");

  // Pengirim
  doc.text("Diserahkan oleh,", 25, signatureY);
  doc.text(legalName, 25, signatureY + 4);
  doc.text("(                                                  )", 25, signatureY + 28);
  doc.setFont("helvetica", "bold");
  doc.text(transmittal.issuedByName || "Penanggung Jawab Proyek", 25, signatureY + 33);
  doc.setFont("helvetica", "normal");
  doc.text("Tanggal: ....................................", 25, signatureY + 38);

  // Penerima
  doc.text("Diterima oleh,", 130, signatureY);
  doc.text(`${transmittal.recipientType}: ${transmittal.recipientName}`, 130, signatureY + 4);
  doc.text("(                                                  )", 130, signatureY + 28);
  doc.setFont("helvetica", "bold");
  doc.text(transmittal.recipientName, 130, signatureY + 33);
  doc.setFont("helvetica", "normal");
  doc.text("Tanggal: ....................................", 130, signatureY + 38);

  doc.save(`Transmittal_${transmittal.transmittalNumber.replace(/\//g, "_")}.pdf`);
  return doc;
}

