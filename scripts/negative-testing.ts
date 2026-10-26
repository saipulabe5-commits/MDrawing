import {
  QuotationItemSchema,
  QuotationFormSchema,
  FinanceTermSchema,
  ClientPaymentSchema,
  VendorContractSchema,
  VendorPaymentTermSchema,
  VendorBillSchema,
  VendorPaymentSchema,
  ProjectExpenseSchema,
  CashflowEntrySchema,
  ProjectContractSchema,
} from '../src/lib/validationSchemas';

console.log('====================================================');
console.log('🧪 RUNNING NEGATIVE TESTING SUITE FOR FINANCIAL DATA');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assertRejects(name: string, schema: any, input: any, expectedErrorSubstring?: string) {
  const result = schema.safeParse(input);
  if (result.success) {
    console.error(`❌ [FAIL] ${name} should have rejected invalid data, but PASSED:`, input);
    failCount++;
  } else {
    const errorMsg = result.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ');
    if (expectedErrorSubstring && !errorMsg.toLowerCase().includes(expectedErrorSubstring.toLowerCase())) {
      console.warn(`⚠️ [WARN] ${name} rejected, but error didn't match expected substring ("${expectedErrorSubstring}"). Got: ${errorMsg}`);
    }
    console.log(`✅ [PASS] ${name} correctly rejected: [${errorMsg}]`);
    passCount++;
  }
}

function assertAccepts(name: string, schema: any, input: any) {
  const result = schema.safeParse(input);
  if (!result.success) {
    console.error(`❌ [FAIL] ${name} should have accepted valid data, but FAILED:`, result.error.issues);
    failCount++;
  } else {
    console.log(`✅ [PASS] ${name} accepted valid data`);
    passCount++;
  }
}

// 1. QuotationItemSchema tests
console.log('--- 1. Testing QuotationItemSchema ---');
assertRejects('Quotation item with negative quantity', QuotationItemSchema, {
  itemNumber: 1,
  category: 'Arsitektur',
  description: 'Gambar Denah',
  quantity: -5,
  unit: 'Lembar',
  unitPrice: 500000,
  subTotal: -2500000,
}, 'positif');

assertRejects('Quotation item with negative unit price', QuotationItemSchema, {
  description: 'Gambar Denah',
  quantity: 5,
  unit: 'Lembar',
  unitPrice: -500000,
}, 'tidak boleh negatif');

assertRejects('Quotation item with NaN unit price', QuotationItemSchema, {
  description: 'Gambar Denah',
  quantity: 5,
  unit: 'Lembar',
  unitPrice: NaN,
});

assertAccepts('Quotation item with valid positive values', QuotationItemSchema, {
  description: 'Gambar Denah',
  quantity: 5,
  unit: 'Lembar',
  unitPrice: 500000,
});

// 2. QuotationFormSchema tests
console.log('\n--- 2. Testing QuotationFormSchema ---');
assertRejects('Quotation form with negative discount', QuotationFormSchema, {
  quotationNumber: 'Q-001',
  date: '2026-03-01',
  validUntil: '2026-03-31',
  items: [{ itemNumber: 1, category: 'Arsitektur', description: 'Item', quantity: 1, unit: 'ls', unitPrice: 1000, subTotal: 1000 }],
  discount: -50000,
  taxPercentage: 11,
  tax: 110,
  grandTotal: 1060,
}, 'negatif');

assertRejects('Quotation form with taxPercentage > 100', QuotationFormSchema, {
  quotationNumber: 'Q-001',
  date: '2026-03-01',
  validUntil: '2026-03-31',
  items: [{ itemNumber: 1, category: 'Arsitektur', description: 'Item', quantity: 1, unit: 'ls', unitPrice: 1000, subTotal: 1000 }],
  discount: 0,
  taxPercentage: 150,
  tax: 1500,
  grandTotal: 2500,
}, '100%');

assertRejects('Quotation form with empty items array', QuotationFormSchema, {
  quotationNumber: 'Q-001',
  date: '2026-03-01',
  validUntil: '2026-03-31',
  items: [],
  discount: 0,
  taxPercentage: 0,
  tax: 0,
  grandTotal: 0,
}, 'minimal 1 item');

// 3. FinanceTermSchema tests
console.log('\n--- 3. Testing FinanceTermSchema ---');
assertRejects('Finance term with percentage > 100', FinanceTermSchema, {
  termName: 'DP',
  triggerType: 'On Quotation Approved',
  amountType: 'Percentage',
  percentageValue: 120,
  nominalValue: 0,
}, '100%');

assertRejects('Finance term with negative nominal', FinanceTermSchema, {
  termName: 'Termin 1',
  triggerType: 'On Drawing Progress',
  amountType: 'Nominal',
  percentageValue: 0,
  nominalValue: -1000000,
}, 'negatif');

assertAccepts('Finance term with valid percentage', FinanceTermSchema, {
  termName: 'Uang Muka 30%',
  triggerType: 'On Quotation Approved',
  amountType: 'Percentage',
  percentageValue: 30,
  nominalValue: 0,
});

// 4. ClientPaymentSchema tests
console.log('\n--- 4. Testing ClientPaymentSchema ---');
assertRejects('Client payment with negative amount', ClientPaymentSchema, {
  invoiceId: 'INV-001',
  amount: -500000,
  paymentDate: '2026-03-01',
  paymentMethod: 'Transfer BCA',
}, 'positif');

assertRejects('Client payment with zero amount', ClientPaymentSchema, {
  invoiceId: 'INV-001',
  amount: 0,
  paymentDate: '2026-03-01',
  paymentMethod: 'Transfer BCA',
}, 'lebih besar dari 0');

assertRejects('Client payment with empty invoiceId', ClientPaymentSchema, {
  invoiceId: '',
  amount: 1000000,
  paymentDate: '2026-03-01',
  paymentMethod: 'Transfer BCA',
}, 'wajib dipilih');

assertAccepts('Client payment with valid inputs', ClientPaymentSchema, {
  invoiceId: 'INV-001',
  amount: 15000000,
  paymentDate: '2026-03-01',
  paymentMethod: 'Transfer BCA',
});

// 5. VendorContractSchema tests
console.log('\n--- 5. Testing VendorContractSchema ---');
assertRejects('Vendor contract with negative contract value', VendorContractSchema, {
  vendorName: 'CV Baja Mandiri',
  vendorType: 'Struktur',
  scopeOfWork: 'Pekerjaan Baja',
  contractValue: -10000000,
  workStatus: 'Belum Mulai',
}, 'positif');

assertRejects('Vendor contract with empty vendor name', VendorContractSchema, {
  vendorName: '',
  vendorType: 'Struktur',
  scopeOfWork: 'Pekerjaan Baja',
  contractValue: 50000000,
  workStatus: 'Belum Mulai',
}, 'wajib diisi');

// 6. VendorPaymentTermSchema tests
console.log('\n--- 6. Testing VendorPaymentTermSchema ---');
assertRejects('Vendor term with percentage > 100', VendorPaymentTermSchema, {
  projectVendorId: 'PV-001',
  termName: 'DP Vendor',
  triggerType: 'On Work Start',
  amountType: 'Percentage',
  percentageValue: 150,
  nominalValue: 0,
}, '100%');

assertRejects('Vendor term with nominal <= 0', VendorPaymentTermSchema, {
  projectVendorId: 'PV-001',
  termName: 'Termin Final',
  triggerType: 'On Work Completed',
  amountType: 'Nominal',
  percentageValue: 0,
  nominalValue: -5000,
}, 'negatif');

assertAccepts('Vendor term with valid percentage', VendorPaymentTermSchema, {
  projectVendorId: 'PV-001',
  termName: 'DP 30%',
  triggerType: 'On Work Start',
  amountType: 'Percentage',
  percentageValue: 30,
  nominalValue: 0,
});

// 7. VendorBillSchema tests
console.log('\n--- 7. Testing VendorBillSchema ---');
assertRejects('Vendor bill with negative amount', VendorBillSchema, {
  projectVendorId: 'PV-001',
  billNumber: 'BILL-001',
  billDate: '2026-03-01',
  dueDate: '2026-03-15',
  amount: -2500000,
}, 'lebih besar dari 0');

assertRejects('Vendor bill with zero amount', VendorBillSchema, {
  projectVendorId: 'PV-001',
  billNumber: 'BILL-001',
  billDate: '2026-03-01',
  dueDate: '2026-03-15',
  amount: 0,
}, 'lebih besar dari 0');

assertRejects('Vendor bill without projectVendorId', VendorBillSchema, {
  projectVendorId: '',
  billNumber: 'BILL-001',
  billDate: '2026-03-01',
  dueDate: '2026-03-15',
  amount: 5000000,
}, 'wajib dipilih');

// 8. VendorPaymentSchema tests
console.log('\n--- 8. Testing VendorPaymentSchema ---');
assertRejects('Vendor payment with negative amount', VendorPaymentSchema, {
  billId: 'BILL-001',
  amount: -100000,
  paymentDate: '2026-03-01',
  paymentMethod: 'Transfer',
  bankSource: 'BCA Operasional',
}, 'lebih besar dari 0');

assertRejects('Vendor payment without bank source', VendorPaymentSchema, {
  billId: 'BILL-001',
  amount: 5000000,
  paymentDate: '2026-03-01',
  paymentMethod: 'Transfer',
  bankSource: '',
}, 'wajib diisi');

// 9. ProjectExpenseSchema tests
console.log('\n--- 9. Testing ProjectExpenseSchema ---');
assertRejects('Project expense with negative amount', ProjectExpenseSchema, {
  expenseCategory: 'Transport',
  amount: -150000,
  expenseDate: '2026-03-01',
  description: 'Bensin Site Visit',
  paidTo: 'Driver',
  paymentMethod: 'Kas/Tunai',
}, 'positif');

assertRejects('Project expense with invalid category', ProjectExpenseSchema, {
  expenseCategory: 'Liburan' as any,
  amount: 150000,
  expenseDate: '2026-03-01',
  description: 'Bensin Site Visit',
  paidTo: 'Driver',
  paymentMethod: 'Kas/Tunai',
});

// 10. CashflowEntrySchema tests
console.log('\n--- 10. Testing CashflowEntrySchema ---');
assertRejects('Cashflow entry with zero amount', CashflowEntrySchema, {
  type: 'IN',
  category: 'Modal/Injeksi',
  amount: 0,
  date: '2026-03-01',
  description: 'Setoran modal',
}, 'lebih besar dari 0');

assertRejects('Cashflow entry with invalid type', CashflowEntrySchema, {
  type: 'TRANSFER' as any,
  category: 'Modal/Injeksi',
  amount: 5000000,
  date: '2026-03-01',
  description: 'Setoran modal',
});

// 11. ProjectContractSchema tests
console.log('\n--- 11. Testing ProjectContractSchema ---');
assertRejects('Project contract with negative value', ProjectContractSchema, {
  contractValue: -50000000,
}, 'negatif');

assertAccepts('Project contract with 0 or positive value', ProjectContractSchema, {
  contractValue: 150000000,
});

console.log('\n====================================================');
console.log(`📊 TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL NEGATIVE TEST CASES PASSED SUCCESSFULLY!');
}
