import { z } from 'zod';

/**
 * Centrally Managed Financial & Range Validation Schemas
 * Compliant with strict zero-trust financial rules.
 * All financial fields strictly forbid negative values and automatically reject NaN.
 */

// 1. Quotation Item Schema
export const QuotationItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, 'Deskripsi pekerjaan/item wajib diisi'),
  quantity: z
    .number({ message: 'Qty harus berupa angka valid' })
    .positive('Qty harus lebih besar dari 0 (tidak boleh 0 atau negatif)'),
  unit: z.string().min(1, 'Satuan wajib diisi (mis. lbr, m2, ls)'),
  unitPrice: z
    .number({ message: 'Harga satuan harus berupa angka valid' })
    .nonnegative('Harga satuan tidak boleh negatif (minimal 0)'),
  totalPrice: z.number().nonnegative().optional(),
});

export type QuotationItemFormData = z.infer<typeof QuotationItemSchema>;

// Complete Quotation Form Schema
export const QuotationFormSchema = z.object({
  discount: z
    .number({ message: 'Diskon harus berupa angka valid' })
    .nonnegative('Diskon tidak boleh bernilai negatif')
    .default(0),
  taxPercentage: z
    .number({ message: 'Persentase pajak harus berupa angka valid' })
    .min(0, 'Pajak minimal 0%')
    .max(100, 'Pajak maksimal 100%')
    .default(11),
  notes: z.string().optional().default(''),
  items: z.array(QuotationItemSchema).min(1, 'Penawaran harus memiliki minimal 1 item pekerjaan'),
});

export type QuotationFormData = z.infer<typeof QuotationFormSchema>;

// 2. Finance Term Schema (Client Termin)
export const FinanceTermSchema = z.object({
  termName: z.string().min(1, 'Nama termin penagihan wajib diisi'),
  triggerType: z.enum([
    'On Quotation Approved',
    'On Project Start',
    'On Drawing Progress',
    'On Drawing Final',
    'On Custom Date',
    'Manual',
  ]),
  triggerCondition: z.string().optional().default(''),
  amountType: z.enum(['Percentage', 'Nominal']),
  percentageValue: z
    .number({ message: 'Persentase harus berupa angka valid' })
    .min(0, 'Persentase minimal 0%')
    .max(100, 'Persentase maksimal 100%')
    .optional(),
  nominalValue: z
    .number({ message: 'Nominal termin harus berupa angka valid' })
    .nonnegative('Nominal termin tidak boleh bernilai negatif')
    .optional(),
  sortOrder: z.number().int().nonnegative().default(1),
}).refine(
  (data) => {
    if (data.amountType === 'Percentage') {
      return data.percentageValue !== undefined && data.percentageValue > 0;
    }
    return data.nominalValue !== undefined && data.nominalValue > 0;
  },
  {
    message: 'Nilai termin harus diisi angka positif lebih besar dari 0',
    path: ['amountType'],
  }
);

export type FinanceTermFormData = z.infer<typeof FinanceTermSchema>;

// 3. Invoice Item Schema & Invoice Form Schema
export const InvoiceItemSchema = z.object({
  termId: z.string().min(1, 'Termin penagihan wajib dipilih'),
  date: z.string().min(1, 'Tanggal invoice wajib diisi'),
  dueDate: z.string().min(1, 'Jatuh tempo invoice wajib diisi'),
  subTotal: z
    .number({ message: 'Subtotal harus berupa angka valid' })
    .nonnegative('Subtotal tidak boleh bernilai negatif'),
  discount: z
    .number({ message: 'Diskon harus berupa angka valid' })
    .nonnegative('Diskon tidak boleh bernilai negatif')
    .default(0),
  taxPercentage: z
    .number({ message: 'Persentase pajak harus berupa angka valid' })
    .min(0, 'Pajak minimal 0%')
    .max(100, 'Pajak maksimal 100%')
    .default(0),
  tax: z
    .number({ message: 'Nominal pajak harus berupa angka valid' })
    .nonnegative('Nominal pajak tidak boleh bernilai negatif')
    .default(0),
  grandTotal: z
    .number({ message: 'Total tagihan harus berupa angka valid' })
    .nonnegative('Total tagihan tidak boleh bernilai negatif'),
  notes: z.string().optional().default(''),
});

export type InvoiceFormData = z.infer<typeof InvoiceItemSchema>;

// 4. Client Payment Schema
export const ClientPaymentSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice penagihan wajib dipilih'),
  amount: z
    .number({ message: 'Jumlah pembayaran harus berupa angka valid' })
    .positive('Jumlah pembayaran harus berupa angka positif lebih besar dari 0'),
  paymentDate: z.string().min(1, 'Tanggal pembayaran wajib diisi'),
  paymentMethod: z.string().min(1, 'Metode pembayaran wajib diisi (mis. Transfer BCA, Mandiri)'),
  referenceNumber: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

export type ClientPaymentFormData = z.infer<typeof ClientPaymentSchema>;

// 5. Vendor Contract Schema (ProjectVendor)
export const VendorContractSchema = z.object({
  vendorId: z.string().optional().default(''),
  vendorName: z.string().min(1, 'Nama vendor wajib diisi'),
  vendorType: z.string().default('Struktur'),
  scopeOfWork: z.string().min(1, 'Lingkup pekerjaan vendor wajib diisi'),
  contractValue: z
    .number({ message: 'Nilai kontrak harus berupa angka valid' })
    .positive('Nilai kontrak vendor harus berupa angka positif lebih besar dari 0'),
  workStatus: z.enum(['Belum Mulai', 'Dalam Proses', 'On Hold', 'Selesai']),
  startDate: z.string().optional().default(''),
  targetDate: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

export type VendorContractFormData = z.infer<typeof VendorContractSchema>;

// 6. Vendor Payment Term Schema (Termin Vendor)
export const VendorPaymentTermSchema = z.object({
  projectVendorId: z.string().min(1, 'Kontrak vendor wajib dipilih'),
  termName: z.string().min(1, 'Nama termin pembayaran vendor wajib diisi'),
  triggerType: z.enum([
    'On Work Start',
    'On Work Progress',
    'On Work Completed',
    'On Client Payment Received',
    'On Custom Date',
    'Manual',
  ]),
  triggerCondition: z.string().optional().default(''),
  amountType: z.enum(['Percentage', 'Nominal']),
  percentageValue: z
    .number({ message: 'Persentase termin harus angka valid' })
    .min(0, 'Persentase minimal 0%')
    .max(100, 'Persentase maksimal 100%')
    .optional(),
  nominalValue: z
    .number({ message: 'Nominal termin harus angka valid' })
    .nonnegative('Nominal termin tidak boleh bernilai negatif')
    .optional(),
  sortOrder: z.number().int().nonnegative().default(1),
}).refine(
  (data) => {
    if (data.amountType === 'Percentage') {
      return data.percentageValue !== undefined && data.percentageValue > 0;
    }
    return data.nominalValue !== undefined && data.nominalValue > 0;
  },
  {
    message: 'Nilai termin vendor harus diisi angka positif lebih besar dari 0',
    path: ['amountType'],
  }
);

export type VendorPaymentTermFormData = z.infer<typeof VendorPaymentTermSchema>;

// 7. Vendor Bill Schema
export const VendorBillSchema = z.object({
  projectVendorId: z.string().min(1, 'Kontrak vendor wajib dipilih'),
  vendorId: z.string().optional().default(''),
  billNumber: z.string().optional().default(''),
  billDate: z.string().min(1, 'Tanggal tagihan vendor wajib diisi'),
  dueDate: z.string().min(1, 'Tanggal jatuh tempo tagihan wajib diisi'),
  amount: z
    .number({ message: 'Jumlah tagihan harus berupa angka valid' })
    .positive('Jumlah tagihan vendor harus lebih besar dari 0'),
  termId: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

export type VendorBillFormData = z.infer<typeof VendorBillSchema>;

// 8. Vendor Payment Schema
export const VendorPaymentSchema = z.object({
  billId: z.string().min(1, 'Tagihan vendor yang dibayar wajib dipilih'),
  amount: z
    .number({ message: 'Jumlah bayar harus berupa angka valid' })
    .positive('Jumlah pembayaran vendor harus lebih besar dari 0'),
  paymentDate: z.string().min(1, 'Tanggal pembayaran wajib diisi'),
  paymentMethod: z.string().min(1, 'Metode pembayaran wajib diisi'),
  bankSource: z.string().min(1, 'Rekening bank sumber wajib diisi'),
  referenceNumber: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  status: z.enum(['Draft', 'Confirmed', 'Void']).default('Confirmed'),
});

export type VendorPaymentFormData = z.infer<typeof VendorPaymentSchema>;

// 9. Project Expense Schema
export const ProjectExpenseSchema = z.object({
  expenseCategory: z.enum([
    'Site Visit',
    'Printing',
    'Konsumsi',
    'Transport',
    'Software License',
    'Alat Kantor',
    'Subkon Lainnya',
    'Lain-lain',
  ]),
  amount: z
    .number({ message: 'Jumlah pengeluaran harus berupa angka valid' })
    .positive('Jumlah pengeluaran harus angka positif lebih besar dari 0'),
  expenseDate: z.string().min(1, 'Tanggal pengeluaran wajib diisi'),
  description: z.string().min(1, 'Keterangan pengeluaran wajib diisi'),
  paidTo: z.string().min(1, 'Penerima pembayaran wajib diisi'),
  paymentMethod: z.string().min(1, 'Metode pembayaran wajib diisi (mis. Transfer, Kas/Tunai)'),
  isReimbursable: z.boolean().default(false),
  attachmentUrl: z.string().optional().default(''),
  status: z.enum(['Draft', 'Approved', 'Paid', 'Cancelled']).default('Draft'),
  notes: z.string().optional().default(''),
});

export type ProjectExpenseFormData = z.infer<typeof ProjectExpenseSchema>;

// 10. Cashflow Entry Schema
export const CashflowEntrySchema = z.object({
  type: z.enum(['IN', 'OUT']),
  category: z.enum([
    'Client Payment',
    'Vendor Payment',
    'Project Expense',
    'Modal/Injeksi',
    'Operasional Kantor',
    'Lain-lain',
  ]),
  amount: z
    .number({ message: 'Nominal arus kas harus berupa angka valid' })
    .positive('Nominal arus kas harus lebih besar dari 0'),
  date: z.string().min(1, 'Tanggal pencatatan kas wajib diisi'),
  description: z.string().min(1, 'Keterangan arus kas wajib diisi'),
  referenceType: z.enum(['ClientPayment', 'VendorPayment', 'ProjectExpense', 'Manual']).optional(),
  referenceNumber: z.string().optional().default(''),
});

export type CashflowEntryFormData = z.infer<typeof CashflowEntrySchema>;

// 11. Project Contract Schema
export const ProjectContractSchema = z.object({
  contractValue: z
    .number({ message: 'Nilai kontrak proyek harus berupa angka valid' })
    .nonnegative('Nilai kontrak proyek tidak boleh bernilai negatif')
    .optional()
    .default(0),
});

export type ProjectContractFormData = z.infer<typeof ProjectContractSchema>;
