/**
 * MDrawing Canonical Financial Engine
 * Single Source of Truth for IDR Safe Integer Financial Computations, Invariants, and Aggregations.
 */

import { InvoiceStatus, VendorBillStatus, QuotationItem } from "../../types";

export const MAX_SAFE_RUPIAH = 1_000_000_000_000_000; // 1 Quadrillion IDR (safe integer limit)

/**
 * Validates that a numeric monetary value is finite, non-negative, and within safe integer range.
 */
export function assertSafeMoney(value: number, fieldName: string = "Nilai moneter"): void {
  if (typeof value !== "number" || isNaN(value)) {
    throw new Error(`${fieldName} tidak valid: nilai bukan angka (NaN).`);
  }
  if (!isFinite(value)) {
    throw new Error(`${fieldName} tidak valid: nilai tak terhingga (Infinity).`);
  }
  if (value < 0) {
    throw new Error(`${fieldName} tidak valid: nilai tidak boleh negatif (${value}).`);
  }
  if (!Number.isSafeInteger(Math.round(value))) {
    throw new Error(`${fieldName} tidak valid: nilai melampaui batas aman integer (${value}).`);
  }
  if (value > MAX_SAFE_RUPIAH) {
    throw new Error(`${fieldName} tidak valid: nilai melampaui batas maksimum Rp 1 Kuadriliun.`);
  }
}

/**
 * Normalizes any monetary input to a safe integer IDR value (clamped at 0).
 */
export function normalizeMoney(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const num = typeof value === "number" ? value : Number(value);
  if (isNaN(num) || !isFinite(num)) return 0;
  const rounded = Math.round(num);
  return Math.max(0, Math.min(MAX_SAFE_RUPIAH, rounded));
}

export function addMoney(a: number, b: number): number {
  const normA = normalizeMoney(a);
  const normB = normalizeMoney(b);
  const sum = normA + normB;
  assertSafeMoney(sum, "Hasil penjumlahan");
  return sum;
}

export function subtractMoney(a: number, b: number): number {
  const normA = normalizeMoney(a);
  const normB = normalizeMoney(b);
  const diff = normA - normB;
  return Math.max(0, Math.round(diff));
}

export function multiplyMoney(amount: number, factor: number): number {
  const normAmount = normalizeMoney(amount);
  if (factor < 0 || isNaN(factor) || !isFinite(factor)) {
    throw new Error(`Faktor pengali tidak valid: ${factor}`);
  }
  const result = Math.round(normAmount * factor);
  assertSafeMoney(result, "Hasil perkalian");
  return result;
}

export function percentOfMoney(amount: number, percentage: number): number {
  const normAmount = normalizeMoney(amount);
  const validPct = Math.max(0, Math.min(100, isNaN(percentage) ? 0 : percentage));
  return Math.round((normAmount * validPct) / 100);
}

// ----------------------------------------------------------------------
// QUOTATION ENGINE
// ----------------------------------------------------------------------

export interface QuotationCalculationResult {
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
  }>;
  subTotal: number;
  discount: number;
  taxBase: number;
  taxPercentage: number;
  tax: number;
  grandTotal: number;
}

export function calculateQuotationTotals(
  items: Array<{
    id?: string;
    description: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
  }>,
  rawDiscount: number = 0,
  rawTaxPercentage: number = 0
): QuotationCalculationResult {
  const validatedItems = items.map((item, idx) => {
    const qty = Math.max(1, Math.round(item.quantity || 1));
    const unitPrice = normalizeMoney(item.unitPrice);
    const totalPrice = Math.round(qty * unitPrice);
    assertSafeMoney(totalPrice, `Total baris item #${idx + 1}`);
    return {
      id: item.id || `item_${idx + 1}`,
      description: (item.description || "").trim(),
      quantity: qty,
      unit: (item.unit || "ls").trim(),
      unitPrice,
      totalPrice,
    };
  });

  const subTotal = validatedItems.reduce((sum, item) => sum + item.totalPrice, 0);
  assertSafeMoney(subTotal, "Subtotal penawaran");

  const discount = Math.min(subTotal, normalizeMoney(rawDiscount));
  const taxBase = Math.max(0, subTotal - discount);
  const taxPercentage = Math.max(0, Math.min(100, Number(rawTaxPercentage) || 0));
  const tax = Math.round((taxBase * taxPercentage) / 100);
  const grandTotal = taxBase + tax;
  assertSafeMoney(grandTotal, "Grand total penawaran");

  return {
    items: validatedItems,
    subTotal,
    discount,
    taxBase,
    taxPercentage,
    tax,
    grandTotal,
  };
}

// ----------------------------------------------------------------------
// INVOICE ENGINE
// ----------------------------------------------------------------------

export interface InvoiceCalculationResult {
  subTotal: number;
  discount: number;
  taxBase: number;
  taxPercentage: number;
  tax: number;
  grandTotal: number;
}

export function calculateInvoiceTotals(
  rawSubTotal: number,
  rawDiscount: number = 0,
  rawTaxPercentage: number = 0
): InvoiceCalculationResult {
  const subTotal = normalizeMoney(rawSubTotal);
  const discount = Math.min(subTotal, normalizeMoney(rawDiscount));
  const taxBase = Math.max(0, subTotal - discount);
  const taxPercentage = Math.max(0, Math.min(100, Number(rawTaxPercentage) || 0));
  const tax = Math.round((taxBase * taxPercentage) / 100);
  const grandTotal = taxBase + tax;
  assertSafeMoney(grandTotal, "Grand total invoice");

  return {
    subTotal,
    discount,
    taxBase,
    taxPercentage,
    tax,
    grandTotal,
  };
}

export interface PaymentSyncResult<TStatus = InvoiceStatus> {
  paidAmount: number;
  remainingAmount: number;
  status: TStatus;
}

/**
 * Authoritative synchronization of Invoice status based on confirmed payments.
 */
export function calculateInvoicePaymentSync(
  grandTotal: number,
  currentStatus: InvoiceStatus,
  confirmedPayments: Array<{ amount: number; status?: string }>,
  dueDate?: string
): PaymentSyncResult<InvoiceStatus> {
  const totalPaid = confirmedPayments
    .filter((p) => !p.status || p.status === "Confirmed")
    .reduce((sum, p) => sum + normalizeMoney(p.amount), 0);

  const normalizedGrandTotal = normalizeMoney(grandTotal);
  const remainingAmount = Math.max(0, normalizedGrandTotal - totalPaid);

  if (currentStatus === "Void" || currentStatus === "Cancelled") {
    return {
      paidAmount: totalPaid,
      remainingAmount,
      status: currentStatus,
    };
  }

  let status: InvoiceStatus = currentStatus;
  if (normalizedGrandTotal > 0 && totalPaid >= normalizedGrandTotal) {
    status = "Paid";
  } else if (totalPaid > 0 && totalPaid < normalizedGrandTotal) {
    status = "Partial Paid";
  } else {
    // totalPaid == 0
    if (dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(dueDate);
      due.setHours(0, 0, 0, 0);
      if (due.getTime() < today.getTime() && currentStatus !== "Draft") {
        status = "Overdue";
      } else if (currentStatus === "Paid" || currentStatus === "Partial Paid") {
        status = "Sent";
      }
    } else if (currentStatus === "Paid" || currentStatus === "Partial Paid") {
      status = "Sent";
    }
  }

  return {
    paidAmount: totalPaid,
    remainingAmount,
    status,
  };
}

/**
 * Validates a client payment against the invoice balance.
 */
export function validateClientPaymentMutation(
  paymentAmount: number,
  invoiceGrandTotal: number,
  alreadyPaidAmount: number,
  allowOverpayment: boolean = false
): { isValid: boolean; error?: string; remainingAfter: number } {
  const amount = normalizeMoney(paymentAmount);
  if (amount <= 0) {
    return { isValid: false, error: "Jumlah pembayaran harus lebih besar dari 0.", remainingAfter: 0 };
  }

  const grandTotal = normalizeMoney(invoiceGrandTotal);
  const currentPaid = normalizeMoney(alreadyPaidAmount);
  const outstanding = Math.max(0, grandTotal - currentPaid);

  if (!allowOverpayment && amount > outstanding) {
    return {
      isValid: false,
      error: `Jumlah pembayaran (Rp ${amount.toLocaleString("id-ID")}) melebihi sisa tagihan (Rp ${outstanding.toLocaleString("id-ID")}). Overpayment tidak diizinkan.`,
      remainingAfter: outstanding,
    };
  }

  return {
    isValid: true,
    remainingAfter: Math.max(0, outstanding - amount),
  };
}

// ----------------------------------------------------------------------
// VENDOR BILL & PAYMENT ENGINE
// ----------------------------------------------------------------------

export function calculateVendorBillPaymentSync(
  billAmount: number,
  currentStatus: VendorBillStatus,
  confirmedPayments: Array<{ amount: number; status?: string }>,
  dueDate?: string
): PaymentSyncResult<VendorBillStatus> {
  const totalPaid = confirmedPayments
    .filter((p) => !p.status || p.status === "Confirmed")
    .reduce((sum, p) => sum + normalizeMoney(p.amount), 0);

  const normalizedBillAmount = normalizeMoney(billAmount);
  const remainingAmount = Math.max(0, normalizedBillAmount - totalPaid);

  if (currentStatus === "Void" || currentStatus === "Cancelled") {
    return {
      paidAmount: totalPaid,
      remainingAmount,
      status: currentStatus,
    };
  }

  let status: VendorBillStatus = currentStatus;
  if (normalizedBillAmount > 0 && totalPaid >= normalizedBillAmount) {
    status = "Paid";
  } else if (totalPaid > 0 && totalPaid < normalizedBillAmount) {
    status = "Partial Paid";
  } else {
    if (dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(dueDate);
      due.setHours(0, 0, 0, 0);
      if (due.getTime() < today.getTime() && currentStatus !== "Draft") {
        status = "Overdue";
      } else if (currentStatus === "Paid" || currentStatus === "Partial Paid") {
        status = "Received";
      }
    } else if (currentStatus === "Paid" || currentStatus === "Partial Paid") {
      status = "Received";
    }
  }

  return {
    paidAmount: totalPaid,
    remainingAmount,
    status,
  };
}

export function validateVendorPaymentMutation(
  paymentAmount: number,
  billAmount: number,
  alreadyPaidAmount: number,
  allowOverpayment: boolean = false
): { isValid: boolean; error?: string; remainingAfter: number } {
  const amount = normalizeMoney(paymentAmount);
  if (amount <= 0) {
    return { isValid: false, error: "Jumlah pembayaran vendor harus lebih besar dari 0.", remainingAfter: 0 };
  }

  const billTotal = normalizeMoney(billAmount);
  const currentPaid = normalizeMoney(alreadyPaidAmount);
  const outstanding = Math.max(0, billTotal - currentPaid);

  if (!allowOverpayment && amount > outstanding) {
    return {
      isValid: false,
      error: `Jumlah pembayaran (Rp ${amount.toLocaleString("id-ID")}) melebihi sisa tagihan vendor (Rp ${outstanding.toLocaleString("id-ID")}).`,
      remainingAfter: outstanding,
    };
  }

  return {
    isValid: true,
    remainingAfter: Math.max(0, outstanding - amount),
  };
}

// ----------------------------------------------------------------------
// FINANCIAL REPORT & CASHFLOW AGGREGATIONS
// ----------------------------------------------------------------------

export interface ComprehensiveFinancialReport {
  // Client Accrual
  contractValue: number;
  totalInvoiced: number;
  totalReceived: number;
  totalReceivable: number;

  // Vendor Accrual
  vendorContracted: number;
  vendorBilled: number;
  vendorPaid: number;
  vendorPayable: number;

  // Expenses
  expensesAccrued: number;
  expensesPaid: number;

  // Cash Accounting
  actualCashIn: number;
  actualCashOut: number;
  netCashflow: number;

  // Profitability (Accrual based)
  grossProfitAccrual: number;
  netProfitAccrual: number;
  grossMarginAccrualPercentage: number;
  netMarginAccrualPercentage: number;

  // Profitability (Cash based)
  netProfitCash: number;
  netMarginCashPercentage: number;
}

export function calculateComprehensiveFinancialReport(params: {
  contractValue?: number;
  invoices: Array<{ grandTotal: number; status?: string }>;
  clientPayments: Array<{ amount: number; status?: string }>;
  projectVendors?: Array<{ contractValue: number }>;
  vendorBills: Array<{ amount: number; status?: string }>;
  vendorPayments: Array<{ amount: number; status?: string }>;
  expenses: Array<{ amount: number; status?: string }>;
}): ComprehensiveFinancialReport {
  const contractValue = normalizeMoney(params.contractValue);

  // Invoices (Exclude Void & Cancelled)
  const validInvoices = params.invoices.filter(
    (inv) => inv.status !== "Void" && inv.status !== "Cancelled"
  );
  const totalInvoiced = validInvoices.reduce((sum, inv) => sum + normalizeMoney(inv.grandTotal), 0);

  // Client Payments (Only Confirmed)
  const confirmedClientPayments = params.clientPayments.filter(
    (p) => !p.status || p.status === "Confirmed"
  );
  const totalReceived = confirmedClientPayments.reduce((sum, p) => sum + normalizeMoney(p.amount), 0);
  const totalReceivable = Math.max(0, totalInvoiced - totalReceived);

  // Vendor Contracts
  const vendorContracted = (params.projectVendors || []).reduce(
    (sum, v) => sum + normalizeMoney(v.contractValue),
    0
  );

  // Vendor Bills (Exclude Void & Cancelled)
  const validVendorBills = params.vendorBills.filter(
    (b) => b.status !== "Void" && b.status !== "Cancelled"
  );
  const vendorBilled = validVendorBills.reduce((sum, b) => sum + normalizeMoney(b.amount), 0);

  // Vendor Payments (Only Confirmed)
  const confirmedVendorPayments = params.vendorPayments.filter(
    (p) => !p.status || p.status === "Confirmed"
  );
  const vendorPaid = confirmedVendorPayments.reduce((sum, p) => sum + normalizeMoney(p.amount), 0);
  const vendorPayable = Math.max(0, vendorBilled - vendorPaid);

  // Expenses
  const validExpenses = params.expenses.filter((e) => e.status !== "Cancelled");
  const expensesAccrued = validExpenses.reduce((sum, e) => sum + normalizeMoney(e.amount), 0);
  const expensesPaid = validExpenses
    .filter((e) => e.status === "Paid" || !e.status)
    .reduce((sum, e) => sum + normalizeMoney(e.amount), 0);

  // Cash Accounting
  const actualCashIn = totalReceived;
  const actualCashOut = vendorPaid + expensesPaid;
  const netCashflow = actualCashIn - actualCashOut;

  // Accrual Profitability (Based on recognized Invoiced Revenue vs Recognized Costs)
  const recognizedRevenueAccrual = totalInvoiced > 0 ? totalInvoiced : contractValue;
  const recognizedCostAccrual = vendorBilled > 0 ? vendorBilled : vendorContracted;
  const grossProfitAccrual = recognizedRevenueAccrual - recognizedCostAccrual;
  const netProfitAccrual = grossProfitAccrual - expensesAccrued;

  const grossMarginAccrualPercentage =
    recognizedRevenueAccrual > 0
      ? Math.round((grossProfitAccrual / recognizedRevenueAccrual) * 1000) / 10
      : 0;

  const netMarginAccrualPercentage =
    recognizedRevenueAccrual > 0
      ? Math.round((netProfitAccrual / recognizedRevenueAccrual) * 1000) / 10
      : 0;

  // Cash Profitability
  const netProfitCash = actualCashIn - actualCashOut;
  const netMarginCashPercentage =
    actualCashIn > 0 ? Math.round((netProfitCash / actualCashIn) * 1000) / 10 : 0;

  return {
    contractValue,
    totalInvoiced,
    totalReceived,
    totalReceivable,
    vendorContracted,
    vendorBilled,
    vendorPaid,
    vendorPayable,
    expensesAccrued,
    expensesPaid,
    actualCashIn,
    actualCashOut,
    netCashflow,
    grossProfitAccrual,
    netProfitAccrual,
    grossMarginAccrualPercentage,
    netMarginAccrualPercentage,
    netProfitCash,
    netMarginCashPercentage,
  };
}

/**
 * Standard Indonesian Rupiah Currency Formatter for UI
 */
export function formatRupiah(amount: number | string | null | undefined): string {
  const norm = normalizeMoney(amount);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(norm);
}

export const formatIDR = formatRupiah;

