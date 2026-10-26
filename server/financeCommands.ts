import { createHash, randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { calculateInvoiceTotals, assertSafeMoney, MAX_SAFE_RUPIAH } from '../src/engine/financial/financialEngine';

export class CommandError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const financeCollections = ['financeTerms','invoices','clientPayments','projectVendors','vendorPaymentTerms','vendorBills','vendorPayments','projectExpenses','cashflowEntries'] as const;
const fields: Record<string,string[]> = {
  financeTerms:['termName','triggerType','triggerCondition','amountType','percentageValue','nominalValue','sortOrder'],
  vendorPaymentTerms:['projectVendorId','termName','triggerType','triggerCondition','amountType','percentageValue','nominalValue','sortOrder'],
  invoices:['clientId','termId','date','dueDate','subTotal','discount','taxPercentage','notes'],
  clientPayments:['clientId','invoiceId','paymentDate','amount','paymentMethod','referenceNumber','attachmentUrl','notes'],
  projectVendors:['vendorId','vendorName','vendorType','scopeOfWork','contractValue','workStatus','startDate','targetDate','completionDate','notes'],
  vendorBills:['projectVendorId','vendorId','termId','billDate','dueDate','amount','notes','attachmentUrl'],
  vendorPayments:['projectVendorId','vendorId','billId','paymentDate','amount','paymentMethod','referenceNumber','bankSource','attachmentUrl','notes'],
  projectExpenses:['expenseCategory','expenseDate','amount','description','paidTo','paymentMethod','attachmentUrl','isReimbursable'],
  cashflowEntries:['date','type','category','referenceType','referenceNumber','description','amount'],
};
export function requireMoney(value: unknown, positive = false): number {
  if (typeof value !== 'number') throw new CommandError(400,'Nominal wajib angka.');
  try { assertSafeMoney(value); } catch(e:any) { throw new CommandError(400,e.message); }
  if (positive && value <= 0) throw new CommandError(400,'Nominal wajib lebih besar dari nol.');
  return value;
}
export function cleanRecord(value: any): any {
  if(Array.isArray(value)) return value.map(cleanRecord);
  if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,cleanRecord(v)]));
  return value;
}
export function capability(user:any, name:string): boolean { return user.isActive===true && (user.role==='OWNER' || user.capabilities?.[name]===true); }
export async function projectAccess(db:any,user:any,projectId:string,tx?:any): Promise<any> {
  if(!projectId || !/^[\w-]{1,128}$/.test(projectId)) throw new CommandError(400,'ID proyek tidak valid.');
  const ref=db.collection('projects').doc(projectId), snap=tx?await tx.get(ref):await ref.get();
  if(!snap.exists) throw new CommandError(404,'Proyek tidak ditemukan.');
  const p=snap.data();
  if(!['OWNER','ADMIN'].includes(user.role) && !(user.assignedProjects||[]).includes(projectId) && p.projectLeaderId!==user.uid && !(p.members||[]).includes(user.uid) && !(user.token?.email_verified && (p.projectLeaderEmail===user.email || (p.members||[]).includes(user.email)))) throw new CommandError(403,'Akses proyek ditolak.');
  return p;
}
function pick(collection:string,data:any) { return Object.fromEntries(fields[collection].filter(k=>data[k]!==undefined).map(k=>[k,data[k]])); }
function validate(collection:string,d:any) {
  if(['clientPayments','vendorPayments','vendorBills','projectExpenses','cashflowEntries'].includes(collection)) requireMoney(d.amount,true);
  if(collection==='projectVendors') { requireMoney(d.contractValue); if(!d.vendorId) throw new CommandError(400,'Vendor wajib dipilih.'); }
  if(collection==='invoices') { requireMoney(d.subTotal,true); requireMoney(d.discount??0); if(!Number.isFinite(d.taxPercentage??0)||(d.taxPercentage??0)<0||(d.taxPercentage??0)>100) throw new CommandError(400,'Persentase pajak tidak valid.'); }
  if(collection.endsWith('Terms')) {
    if(!d.termName?.trim()) throw new CommandError(400,'Nama termin wajib diisi.');
    if(d.amountType==='Percentage') { if(!Number.isFinite(d.percentageValue)||d.percentageValue<=0||d.percentageValue>100) throw new CommandError(400,'Persentase termin tidak valid.'); }
    else if(d.amountType==='Nominal') requireMoney(d.nominalValue,true);
    else throw new CommandError(400,'Jenis termin tidak valid.');
  }
  if(collection==='cashflowEntries' && (!['IN','OUT'].includes(d.type)||d.referenceType && d.referenceType!=='Manual')) throw new CommandError(400,'Arus kas manual tidak valid.');
  for(const [key,val] of Object.entries(d)) {
    if(typeof val==='number'&&!Number.isFinite(val)) throw new CommandError(400,`${key} tidak finite.`);
    if(typeof val==='string'&&val.length>10000) throw new CommandError(400,`${key} terlalu panjang.`);
    if(/Date$/.test(key)||['date','dueDate'].includes(key)) { if(val && (typeof val!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(val)||Number.isNaN(Date.parse(val))||new Date(val as string).toISOString().slice(0,10)!==val)) throw new CommandError(400,`${key} tidak valid.`); }
  }
}
const PREFIX:Record<string,string>={invoices:'INV',clientPayments:'KWT',vendorBills:'VB',vendorPayments:'VP',projectExpenses:'EXP'};
const NUMBER_FIELD:Record<string,string>={invoices:'invoiceNumber',clientPayments:'paymentNumber',vendorBills:'billNumber',vendorPayments:'paymentNumber',projectExpenses:'expenseNumber'};

/** The only writer of posted financial balances. Every read precedes every write. */
export async function executeFinanceCommand(db:Firestore,user:any,input:any) {
  const {collection,action,id,data={},requestId,reason=''}=input||{};
  if(!financeCollections.includes(collection)||!['create','update','status','delete'].includes(action)) throw new CommandError(400,'Command tidak dikenal.');
  if(!capability(user,'canEditFinance')) throw new CommandError(403,'Izin edit keuangan diperlukan.');
  if(typeof requestId!=='string'||!/^[-\w]{8,128}$/.test(requestId)) throw new CommandError(400,'Idempotency key wajib.');
  if(action!=='create'&&(!id||!/^[\w-]{1,128}$/.test(id))) throw new CommandError(400,'ID record tidak valid.');
  const commandKey=createHash('sha256').update(user.uid+':'+requestId).digest('hex');
  const fingerprint=createHash('sha256').update(JSON.stringify(cleanRecord({collection,action,id,data,reason}))).digest('hex');
  const commandRef=db.collection('commandReceipts').doc(commandKey),ref=db.collection(collection).doc(action==='create'?randomUUID():id);
  const now=new Date().toISOString();
  return db.runTransaction(async tx=>{
    const receipt=await tx.get(commandRef);
    if(receipt.exists) { if(receipt.data()!.fingerprint!==fingerprint) throw new CommandError(409,'Idempotency key dipakai payload berbeda.'); return receipt.data()!.result; }
    const oldSnap=action==='create'?null:await tx.get(ref),old=oldSnap?.data();
    if(action!=='create'&&!oldSnap?.exists) throw new CommandError(404,'Record tidak ditemukan.');
    const projectId=old?.projectId||data.projectId;
    if(old && data.projectId && data.projectId!==old.projectId) throw new CommandError(403,'Proyek tidak dapat diubah.');
    const project=await projectAccess(db,user,projectId,tx);
    if(action==='update' && ['invoices','vendorBills'].includes(collection))throw new CommandError(409,'Arsipkan draft lalu buat ulang tagihan agar nilai termin tetap konsisten.');
    if(project.isArchived && action==='create') throw new CommandError(409,'Proyek diarsipkan.');
    const isPayment=['clientPayments','vendorPayments'].includes(collection), isInvoice=['invoices','vendorBills'].includes(collection);
    let next:any=cleanRecord({...old,...pick(collection,data),id:ref.id,projectId,createdBy:old?.createdBy||user.uid,createdAt:old?.createdAt||now,updatedAt:now});
    if(collection==='cashflowEntries'&&action==='create'&&!capability(user,'canApproveFinance'))throw new CommandError(403,'Pencatatan kas manual memerlukan izin approval.');
    if(action==='create') next.status=isPayment||isInvoice||collection==='projectExpenses'?'Draft':collection==='cashflowEntries'?'Posted':undefined;
    const writes:Array<()=>void>=[];
    if(action==='status') {
      const allowed=isPayment?['Confirmed','Cancelled']:isInvoice?['Sent','Received','Void','Cancelled']:collection==='projectExpenses'?['Approved','Paid','Cancelled']:[];
      if(!allowed.includes(data.status)) throw new CommandError(400,'Transisi status tidak valid.');
      if(isPayment && data.status==='Confirmed' && old?.status!=='Draft') throw new CommandError(409,'Hanya draft dapat dikonfirmasi.');
      if(collection==='projectExpenses' && data.status==='Approved' && old?.status!=='Draft') throw new CommandError(409,'Hanya draft dapat disetujui.');
      if(collection==='projectExpenses' && data.status==='Paid' && old?.status!=='Approved') throw new CommandError(409,'Biaya wajib disetujui sebelum dibayar.');
      if(isInvoice && ['Sent','Received'].includes(data.status) && old?.status!=='Draft') throw new CommandError(409,'Hanya draft yang dapat diterbitkan.');
      if(['Void','Cancelled'].includes(old?.status)) throw new CommandError(409,'Transaksi sudah dibatalkan.');
      if(data.status===old?.status) throw new CommandError(409,'Status sudah diterapkan.');
      if(['Confirmed','Approved','Paid'].includes(data.status)) {
        if(!capability(user,'canApproveFinance')) throw new CommandError(403,'Izin approval diperlukan.');
        const isMaker = (old?.createdBy === user.uid);
        const isAdminOrDirector = ['OWNER', 'ADMIN', 'DIRECTOR'].includes(user.role);
        if(isMaker && !isAdminOrDirector) throw new CommandError(403,'Pembuat tidak boleh menyetujui transaksi sendiri. Gunakan pemeriksa lain.');
        next.approvedBy=user.uid; next.approvedAt=now;
        if(isMaker && isAdminOrDirector) next.approvalOverrideReason = 'Disetujui mandiri oleh Admin/Direktur (Admin Override)';
      }
      if(['Cancelled','Void'].includes(data.status)) {
        if(!capability(user,'canVoidFinanceTransaction')||!reason.trim()) throw new CommandError(403,'Pembatalan memerlukan izin void dan alasan.');
        next.reversalReason=reason; next.reversedBy=user.uid; next.reversedAt=now;
      }
      next.status=data.status;
    }
    if(action==='update' && (old?.status && old.status!=='Draft' || collection==='cashflowEntries')) throw new CommandError(409,'Transaksi posted tidak dapat diedit; gunakan reversal.');
    if(action==='delete') {
      if(collection==='cashflowEntries'&&(!capability(user,'canVoidFinanceTransaction')||!reason.trim()))throw new CommandError(403,'Pembatalan kas memerlukan izin void dan alasan.');
      if(!collection.endsWith('Terms') && !['projectVendors','cashflowEntries'].includes(collection) && old?.status!=='Draft') throw new CommandError(409,'Hanya draft yang dapat diarsipkan.');
      next={...old,status:'Cancelled',updatedAt:now,archivedAt:now,reversalReason:reason,reversedBy:user.uid};
    }
    validate(collection,next);
    if(collection==='vendorPaymentTerms'||collection==='vendorBills'||collection==='projectVendors') {
      if(collection!=='projectVendors') { const parent=await tx.get(db.collection('projectVendors').doc(next.projectVendorId||'_missing')); if(!parent.exists||parent.data()!.projectId!==projectId) throw new CommandError(400,'Kontrak vendor tidak sesuai proyek.'); if(next.vendorId&&next.vendorId!==parent.data()!.vendorId) throw new CommandError(400,'Vendor tidak cocok dengan kontrak.'); }
      else { const vendor=await tx.get(db.collection('vendors').doc(next.vendorId)); if(!vendor.exists||vendor.data()!.isArchived) throw new CommandError(400,'Vendor tidak tersedia.'); }
    }
    if(isInvoice) {
      const isClient=collection==='invoices',termCollection=isClient?'financeTerms':'vendorPaymentTerms';
      if(action==='create') {
        if(!next.termId) throw new CommandError(400,'Invoice/tagihan wajib memiliki termin.');
        const termRef=db.collection(termCollection).doc(next.termId),term=await tx.get(termRef);
        if(!term.exists||term.data()!.projectId!==projectId||['Cancelled','Void'].includes(term.data()!.status)) throw new CommandError(400,'Termin tidak sesuai proyek.');
        if(!isClient && term.data()!.projectVendorId!==next.projectVendorId)throw new CommandError(400,'Termin bukan milik kontrak vendor ini.');
        let contract=0;
        if(isClient) {
          const q=await tx.get(db.collection('quotations').where('projectId','==',projectId).where('status','==','AGREED'));
          if(q.empty) throw new CommandError(409,'Penawaran proyek belum disepakati.');
          const selected=q.docs.find(d=>d.id===project.quotationId)||q.docs[0]; contract=requireMoney(selected.data().grandTotal,true);
          if(next.clientId!==selected.data().clientId) throw new CommandError(400,'Klien tidak cocok dengan penawaran.');
          Object.assign(next,calculateInvoiceTotals(next.subTotal,next.discount??0,next.taxPercentage??0));
        } else {
          const pv=await tx.get(db.collection('projectVendors').doc(next.projectVendorId)); contract=requireMoney(pv.data()!.contractValue);
        }
        const t=term.data()!,limit=t.amountType==='Percentage'?Math.round(contract*t.percentageValue/100):requireMoney(t.nominalValue,true);
        const amount=isClient?next.grandTotal:next.amount,current=requireMoney(t.invoicedAmount??0);
        if(current+amount>limit) throw new CommandError(409,'Tagihan melebihi sisa nilai termin.');
        const allocation=db.collection('financeAllocations').doc(isClient?'client-'+projectId:'vendor-'+next.projectVendorId);await tx.get(allocation);
        const existing=await tx.get(db.collection(collection).where(isClient?'projectId':'projectVendorId','==',isClient?projectId:next.projectVendorId));
        const allocated=existing.docs.filter(d=>!['Cancelled','Void'].includes(d.data().status)).reduce((sum,d)=>sum+requireMoney(isClient?d.data().grandTotal:d.data().amount),0);
        if(allocated+amount>contract)throw new CommandError(409,'Jumlah tagihan melampaui nilai kontrak.');
        writes.push(()=>tx.set(allocation,{projectId,reserved:allocated+amount,updatedAt:now}));
        next.paidAmount=0;next.amountPaid=0;next.remainingAmount=amount;
        writes.push(()=>tx.update(termRef,{invoicedAmount:current+amount,updatedAt:now}));
      }
      if(['Void','Cancelled'].includes(next.status)&&!['Void','Cancelled'].includes(old?.status)) {
        if((old?.paidAmount??old?.amountPaid??0)>0) throw new CommandError(409,'Balikkan pembayaran sebelum membatalkan invoice/tagihan.');
        if(old?.termId) { const tr=db.collection(termCollection).doc(old.termId),ts=await tx.get(tr); if(ts.exists) writes.push(()=>tx.update(tr,{invoicedAmount:Math.max(0,(ts.data()!.invoicedAmount||0)-(isClient?old.grandTotal:old.amount)),updatedAt:now})); }
      }
    }
    if(isPayment) {
      const client=collection==='clientPayments',parentId=client?next.invoiceId:next.billId;
      if(!parentId) throw new CommandError(400,'Invoice/tagihan wajib dipilih.');
      const parentRef=db.collection(client?'invoices':'vendorBills').doc(parentId),ps=await tx.get(parentRef);
      if(!ps.exists||ps.data()!.projectId!==projectId) throw new CommandError(400,'Invoice/tagihan tidak sesuai proyek.');
      const parent=ps.data()!;
      if(parent.status==='Draft'||['Void','Cancelled'].includes(parent.status)) throw new CommandError(409,'Status invoice/tagihan tidak menerima pembayaran.');
      const partyField=client?'clientId':'vendorId';
      if(next[partyField] && parent[partyField] && next[partyField]!==parent[partyField]) throw new CommandError(400,'Pihak pembayaran tidak sesuai tagihan.');
      next[partyField]=parent[partyField]||next[partyField]||'';
      if(!client) next.projectVendorId=parent.projectVendorId;
      const confirmed=await tx.get(db.collection(collection).where(client?'invoiceId':'billId','==',parentId).where('status','==','Confirmed'));
      let paid=0;for(const d of confirmed.docs) if(d.id!==ref.id) paid+=requireMoney(d.data().amount,true);
      const total=requireMoney(client?parent.grandTotal:parent.amount,true);
      if(next.status==='Confirmed') paid+=next.amount;
      if(paid>total||paid>MAX_SAFE_RUPIAH) throw new CommandError(409,'Pembayaran melebihi saldo tagihan.');
      if(action==='create'&&next.amount>total-paid) throw new CommandError(409,'Draft melebihi saldo tagihan saat ini.');
      writes.push(()=>tx.update(parentRef,{paidAmount:paid,amountPaid:paid,remainingAmount:total-paid,status:paid===total?'Paid':paid>0?'Partial Paid':client?'Sent':'Received',updatedAt:now}));
    }
    if(collection.endsWith('Terms')&&action!=='delete'&&next.amountType==='Percentage'){const guard=db.collection('financeTermLocks').doc(collection+'-'+projectId+(next.projectVendorId||''));await tx.get(guard);writes.push(()=>tx.set(guard,{updatedAt:now}));const others=await tx.get(db.collection(collection).where('projectId','==',projectId));const total=others.docs.filter(d=>d.id!==ref.id&&d.data().status!=='Cancelled'&&(collection==='financeTerms'||d.data().projectVendorId===next.projectVendorId)&&d.data().amountType==='Percentage').reduce((n,d)=>n+d.data().percentageValue,0)+next.percentageValue;if(total>100)throw new CommandError(409,'Total persentase termin melebihi 100%.');}
    if(collection.endsWith('Terms')&&action!=='create'&&(old?.invoicedAmount||0)>0) throw new CommandError(409,'Termin yang sudah ditagih tidak dapat diubah/dihapus.');
    if(collection==='projectVendors'&&['delete','update'].includes(action)) {
      const refs=await tx.get(db.collection('vendorBills').where('projectVendorId','==',ref.id));
      if(refs.docs.some(d=>!['Cancelled','Void'].includes(d.data().status))) throw new CommandError(409,'Selesaikan atau balikkan tagihan kontrak sebelum mengarsipkan.');
      if(action==='delete')next.isArchived=true;
    }
    if(action==='create'&&PREFIX[collection]) {
      const key=PREFIX[collection]+'-'+now.slice(0,7),counter=db.collection('documentCounters').doc(key),cs=await tx.get(counter);
      const sequence=(cs.data()?.sequence||0)+1;
      next[NUMBER_FIELD[collection]]=key+'-'+String(sequence).padStart(5,'0');
      writes.push(()=>tx.set(counter,{sequence,updatedAt:now}));
    }
    next=cleanRecord(next);
    for(const write of writes) write();
    tx.set(ref,next);
    tx.set(db.collection('financialAuditLogs').doc(commandKey),{id:commandKey,projectId,transactionType:({clientPayments:'ClientPayment',vendorPayments:'VendorPayment',invoices:'Invoice',vendorBills:'VendorBill',projectExpenses:'Expense',cashflowEntries:'CashflowEntry',projectVendors:'ProjectVendor',financeTerms:'FinanceTerm',vendorPaymentTerms:'VendorPaymentTerm'} as any)[collection],transactionId:ref.id,action:action==='create'?'CREATE':next.status==='Cancelled'||next.status==='Void'?'CANCEL':'UPDATE',userId:user.uid,userName:user.email,userRole:user.role,oldValue:old||null,newValue:next,reason,createdAt:now});
    const result={id:ref.id,status:next.status||null};
    tx.set(commandRef,{fingerprint,result,actorUid:user.uid,createdAt:now});
    return result;
  });
}
