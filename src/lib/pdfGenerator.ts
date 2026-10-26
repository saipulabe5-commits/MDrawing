import { createBrandedPdf, requireInvoiceBank } from './brandedPdf';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Quotation, Client } from '../types';

export const buildQuotationPdf = (
  quotation: Quotation,
  client?: Client | null,
  options?: { preview?: boolean }
): jsPDF => {
  const preview = options?.preview || false;

  // 1. Validation
  if (!quotation) throw new Error("DATA_PENAWARAN_TIDAK_LENGKAP");
  if (!quotation.quotationNumber) throw new Error("DATA_PENAWARAN_TIDAK_LENGKAP");
  if (!Array.isArray(quotation.items) || quotation.items.length === 0) throw new Error("DATA_PENAWARAN_TIDAK_LENGKAP");
  if (typeof quotation.grandTotal !== 'number') throw new Error("DATA_PENAWARAN_TIDAK_LENGKAP");
  if (!quotation.date || !quotation.validUntil) throw new Error("DATA_PENAWARAN_TIDAK_LENGKAP");

  if(!client?.id||!(client.companyName||client.clientName)||!client.address)throw new Error('DATA_KLIEN_TIDAK_LENGKAP');
  const doc = createBrandedPdf();
  
  const topMargin = 15;
  const leftMargin = 14;
  const rightMargin = 14;
  const bottomMargin = 20; // 20 units from the bottom
  const pageHeight = doc.internal.pageSize.height;
  const maxDrawableY = pageHeight - bottomMargin;
  const pageWidth = doc.internal.pageSize.width;
  const usableWidth = pageWidth - leftMargin - rightMargin;

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("PT. ASA PERDANA MANDIRI", leftMargin, 20);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Engineering, Architectural & Structural Detail Drawings", leftMargin, 25);
  doc.text("Gedung APM, Lt. 3", leftMargin, 30);
  doc.text("Jl. Teknik Arsitektur No. 1, Jakarta Selatan", leftMargin, 35);
  doc.text("Tel: (021) 555-0123 | Email: contact@asaperdana.co.id", leftMargin, 40);
  doc.text("www.asaperdana.co.id", leftMargin, 45);
  
  doc.line(leftMargin, 50, pageWidth - rightMargin, 50); // horizontal line

  // Letter Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("SURAT PENAWARAN HARGA", leftMargin, 60);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Nomor     : ${quotation.quotationNumber}`, leftMargin, 67);
  doc.text(`Revisi    : Rev.${quotation.revisionNumber?.toString().padStart(2, '0') || '00'}`, leftMargin, 72);
  doc.text(`Tanggal   : ${format(new Date(quotation.date), 'dd MMMM yyyy', { locale: localeId })}`, leftMargin, 77);
  doc.text(`Berlaku   : ${format(new Date(quotation.validUntil), 'dd MMMM yyyy', { locale: localeId })}`, leftMargin, 82);

  // Client Info
  doc.text(`KEPADA YTH:`, 120, 67);
  doc.setFont("helvetica", "bold");
  doc.text(client?.companyName || client?.clientName || '[Nama Perusahaan / Klien]', 120, 72, { maxWidth: pageWidth - 120 - rightMargin });
  doc.setFont("helvetica", "normal");
  const splitAddress = doc.splitTextToSize(client?.address || '[Alamat]', pageWidth - 120 - rightMargin);
  doc.text(splitAddress, 120, 77);
  
  const attnY = 77 + (splitAddress.length * 5);
  doc.text(`Attn: ${client?.clientName || '[Nama PIC]'}`, 120, attnY);

  // Subject
  let startY = 100;
  doc.setFont("helvetica", "bold");
  doc.text(`Perihal   : Penawaran Jasa ${quotation.projectName || 'Desain dan Perencanaan'}`, leftMargin, startY);
  doc.setFont("helvetica", "normal");
  
  startY += 10;
  doc.text("Dengan hormat,", leftMargin, startY);
  startY += 6;
  
  const openingText = `Sehubungan dengan rencana pekerjaan ${quotation.projectName || 'proyek Anda'}${quotation.location ? ` di ${quotation.location}` : ''}, bersama ini PT. Asa Perdana Mandiri menyampaikan penawaran jasa sebagai berikut:`;
  const splitOpening = doc.splitTextToSize(openingText, usableWidth);
  doc.text(splitOpening, leftMargin, startY);
  startY += splitOpening.length * 5 + 5;

  // Items Table
  const tableColumn = ["No", "Uraian Pekerjaan", "Qty", "Satuan", "Harga Satuan (Rp)", "Jumlah (Rp)"];
  const tableRows = quotation.items.map((item, index) => [
    index + 1,
    item.description || '-',
    item.quantity.toString(),
    item.unit || '-',
    item.unitPrice.toLocaleString('id-ID'),
    item.totalPrice.toLocaleString('id-ID')
  ]);

  autoTable(doc, {
    startY: startY,
    head: [tableColumn],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      2: { halign: 'center', cellWidth: 15 },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 35 },
      5: { halign: 'right', cellWidth: 35 },
    },
    margin: { left: leftMargin, right: rightMargin, bottom: bottomMargin },
  });

  startY = (doc as any).lastAutoTable.finalY + 10;

  const rightAlign = pageWidth - rightMargin;

  const checkPageBreak = (requiredHeight: number) => {
    if (startY + requiredHeight > maxDrawableY) {
      doc.addPage();
      startY = topMargin;
    }
  };

  checkPageBreak(30);

  // Totals
  doc.setFont("helvetica", "normal");
  doc.text(`Subtotal : Rp ${quotation.subTotal.toLocaleString('id-ID')}`, rightAlign, startY, { align: 'right' });
  startY += 6;
  
  if (quotation.discount && quotation.discount > 0) {
    doc.text(`Diskon : Rp ${quotation.discount.toLocaleString('id-ID')}`, rightAlign, startY, { align: 'right' });
    startY += 6;
  }
  
  doc.text(`PPN (${quotation.taxPercentage || 0}%) : Rp ${(quotation.tax || 0).toLocaleString('id-ID')}`, rightAlign, startY, { align: 'right' });
  startY += 8;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`GRAND TOTAL : Rp ${quotation.grandTotal.toLocaleString('id-ID')}`, rightAlign, startY, { align: 'right' });
  doc.setFontSize(10);
  
  startY += 15;

  // Terms and Conditions Section
  checkPageBreak(20);
  doc.setFont("helvetica", "bold");
  doc.text("SYARAT & KETENTUAN", leftMargin, startY);
  startY += 8;
  doc.setFont("helvetica", "normal");

  const termsText = [];
  if (quotation.dpPercentage && quotation.dpPercentage > 0) {
    termsText.push(`Uang Muka (DP): ${quotation.dpPercentage}% (Rp ${quotation.dpAmount?.toLocaleString('id-ID')})`);
  }
  if (quotation.paymentTerms) termsText.push(`Syarat Pembayaran:\n${quotation.paymentTerms}`);
  if (quotation.scopeOfWork) termsText.push(`Ruang Lingkup:\n${quotation.scopeOfWork}`);
  if (quotation.exclusions) termsText.push(`Pengecualian:\n${quotation.exclusions}`);
  if (quotation.termsAndConditions) termsText.push(`Lain-lain:\n${quotation.termsAndConditions}`);
  
  for (const term of termsText) {
    const splitTerm = doc.splitTextToSize(term, usableWidth);
    checkPageBreak(splitTerm.length * 5 + 5);
    doc.text(splitTerm, leftMargin, startY);
    startY += splitTerm.length * 5 + 5;
  }

  // Closing
  checkPageBreak(40);
  doc.text("Demikian penawaran ini kami sampaikan. Atas perhatian dan kerjasamanya, kami ucapkan terima kasih.", leftMargin, startY);
  startY += 15;
  
  doc.text("Hormat kami,", leftMargin, startY);
  doc.setFont("helvetica", "bold");
  doc.text("PT. ASA PERDANA MANDIRI", leftMargin, startY + 5);
  
  startY += 25; // space for signature
  doc.line(leftMargin, startY, leftMargin + 50, startY);
  doc.setFont("helvetica", "normal");
  doc.text("Direktur", leftMargin, startY + 5);

  // Watermark if Preview
  if (preview) {
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(60);
    doc.text("PREVIEW", pageWidth / 2, doc.internal.pageSize.height / 2, { align: 'center', angle: 45 });
  }

  // Page Numbers
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Halaman ${i} dari ${pageCount}`, rightAlign, doc.internal.pageSize.height - 10, { align: 'right' });
    doc.text(`Nomor Penawaran: ${quotation.quotationNumber} | Revisi: Rev.${quotation.revisionNumber?.toString().padStart(2, '0') || '00'}`, leftMargin, doc.internal.pageSize.height - 10);
  }

  return doc;
};
