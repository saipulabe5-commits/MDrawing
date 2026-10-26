import { calculateComprehensiveFinancialReport } from './financialEngine';
export function buildCashflowEntries(clientPayments:any[],vendorPayments:any[],expenses:any[],manual:any[]=[]) {
  let runningBalance=0;
  return [
    ...clientPayments.filter(p=>p.status==='Confirmed').map(p=>({id:'cp-'+p.id,date:p.paymentDate,type:'IN',category:'Pembayaran Klien',referenceType:'Kwitansi Klien',referenceNumber:p.paymentNumber,description:p.notes||'Pembayaran klien',amount:p.amount,isManual:false})),
    ...vendorPayments.filter(p=>p.status==='Confirmed').map(p=>({id:'vp-'+p.id,date:p.paymentDate,type:'OUT',category:'Pembayaran Vendor',referenceType:'Kas Keluar Vendor',referenceNumber:p.paymentNumber,description:p.notes||'Pembayaran vendor',amount:p.amount,isManual:false})),
    ...expenses.filter(e=>e.status==='Paid').map(e=>({id:'exp-'+e.id,date:e.expenseDate,type:'OUT',category:e.expenseCategory,referenceType:'Pengeluaran Proyek',referenceNumber:e.expenseNumber,description:e.description,amount:e.amount,isManual:false})),
    ...manual.filter(e=>!e.status||e.status==='Posted').map(e=>({...e,isManual:true}))
  ].sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(e=>({...e,runningBalance:(runningBalance+=e.type==='IN'?e.amount:-e.amount)}));
}
export function projectReport(project:any,quotations:any[],invoices:any[],clientPayments:any[],projectVendors:any[],vendorBills:any[],vendorPayments:any[],expenses:any[],cashflowEntries:any[]=[]){
  const contract=project?.contractValue??quotations.find(q=>q.status==='AGREED')?.grandTotal??0;
  const base=calculateComprehensiveFinancialReport({contractValue:contract,invoices,clientPayments,projectVendors,vendorBills,vendorPayments,expenses});
  const entries=buildCashflowEntries(clientPayments,vendorPayments,expenses,cashflowEntries);
  const totalCashIn=entries.filter(e=>e.type==='IN').reduce((s,e)=>s+e.amount,0),totalCashOut=entries.filter(e=>e.type==='OUT').reduce((s,e)=>s+e.amount,0);
  const projectedProfit=contract-base.vendorBilled-base.expensesAccrued;
  return {...base,entries,totalContract:contract,totalPaid:base.totalReceived,totalExpenseVal:base.expensesPaid,totalVendorPaidVal:base.vendorPaid,totalAllOut:totalCashOut,totalCashIn,totalCashOut,netCash:totalCashIn-totalCashOut,netCashflow:totalCashIn-totalCashOut,projectedProfit,profitMargin:contract?projectedProfit/contract*100:0,sisaPiutang:base.totalReceivable};
}
