import { configureDocumentBranding } from './documentBranding';
configureDocumentBranding({companyName:'SYNTHETIC TEST COMPANY',address:'SYNTHETIC TEST ADDRESS'});
import { describe, it, expect } from 'vitest';
import { buildQuotationPdf } from './pdfGenerator';

describe('Quotation PDF Generator', () => {
  const mockClient = {
    id: 'c1',
    companyName: 'PT. Test',
    clientName: 'Budi',
    address: 'Jl. Test No. 1',
    email: 'test@test.com',
    phone: '08123',
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01'
  };

  const mockQuotation = {
    id: 'q1',
    clientId: 'c1',
    quotationNumber: 'QUO-001',
    revisionNumber: 0,
    date: '2026-09-01',
    validUntil: '2026-09-15',
    status: 'DRAFT',
    items: [
      { id: 'i1', description: 'Item 1', quantity: 1, unit: 'Ls', unitPrice: 1000, totalPrice: 1000 }
    ],
    subTotal: 1000,
    discount: 0,
    taxPercentage: 11,
    tax: 110,
    grandTotal: 1110,
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01'
  };

  it('should build a PDF with valid data', () => {
    // @ts-ignore
    const pdf = buildQuotationPdf(mockQuotation, mockClient, { preview: false });
    expect(pdf).toBeDefined();
    expect(typeof pdf.output).toBe('function');
  });

  it('should throw error if quotation is missing', () => {
    // @ts-ignore
    expect(() => buildQuotationPdf(null, mockClient)).toThrow("DATA_PENAWARAN_TIDAK_LENGKAP");
  });

  it('should throw error if client is missing', () => {
    // @ts-ignore
    expect(() => buildQuotationPdf(mockQuotation, null)).toThrow("DATA_KLIEN_TIDAK_LENGKAP");
  });

  it('should throw error if items are empty', () => {
    // @ts-ignore
    expect(() => buildQuotationPdf({ ...mockQuotation, items: [] }, mockClient)).toThrow("DATA_PENAWARAN_TIDAK_LENGKAP");
  });
});
