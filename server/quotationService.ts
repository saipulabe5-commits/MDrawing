import { randomUUID,createHash } from 'node:crypto';
import { capability,CommandError,cleanRecord,projectAccess } from './financeCommands';
import { calculateQuotationTotals } from '../src/engine/financial/financialEngine';
export async function quotationCommand(db:any,user:any,input:any){
  const {action,id,data={}}=input;
  if(!['create','update','delete'].includes(action))throw new CommandError(400,'Aksi tidak valid.');
  const fingerprint=createHash('sha256').update(JSON.stringify(cleanRecord(data))).digest('hex');
  if(!capability(user,'canEditFinance'))throw new CommandError(403,'Izin keuangan diperlukan.');
  const ref=db.collection('quotations').doc(id||randomUUID());
  if(!/^[\w-]{1,128}$/.test(ref.id))throw new CommandError(400,'ID tidak valid.');
  return db.runTransaction(async(tx:any)=>{
    const snap=await tx.get(ref),old=snap.data();
    if(action!=='create'&&!snap.exists)throw new CommandError(404,'Penawaran tidak ditemukan.');
    if(action==='create'&&snap.exists){if(old.createdBy!==user.uid||old.creationFingerprint!==fingerprint)throw new CommandError(409,'ID penawaran sudah digunakan untuk permintaan lain.');return{id:ref.id};}
    if(old&&['AGREED','SUPERSEDED','CANCELLED'].includes(old.status))throw new CommandError(409,'Penawaran final dikunci. Buat revisi baru untuk perubahan.');
    const projectId=old?.projectId||data.projectId||'';
    if(projectId)await projectAccess(db,user,projectId,tx);
    else if(old?.createdBy!==user.uid&&!['OWNER','ADMIN'].includes(user.role)&&action!=='create')throw new CommandError(403,'Penawaran bukan milik pengguna.');
    if(old&&data.projectId!==undefined&&data.projectId!==(old.projectId||''))throw new CommandError(403,'Gunakan pengelolaan proyek untuk menghubungkan penawaran.');
    const keys=['clientId','quotationNumber','date','validUntil','projectName','location','revisionNumber','parentQuotationId','originalQuotationId','items','discount','taxPercentage','notes','scopeOfWork','exclusions','termsAndConditions','paymentTerms','dpPercentage','status'];
    let next:any={...old,...Object.fromEntries(keys.filter(k=>data[k]!==undefined).map(k=>[k,data[k]]))};
    const now=new Date().toISOString();
    if(action==='create'){next.status='DRAFT';next.creationFingerprint=fingerprint;next.createdBy=user.uid;next.createdAt=now;}
    if(action==='delete'){if(!['DRAFT','Draft'].includes(old.status))throw new CommandError(409,'Hanya draft dapat diarsipkan.');next.status='CANCELLED';next.isArchived=true;}
    if(!['DRAFT','NEGOTIATION','AGREED','REVISED','CANCELLED','Draft','Sent','Approved','Cancelled','SUPERSEDED'].includes(next.status))throw new CommandError(400,'Status penawaran tidak valid.');
    if(!Array.isArray(next.items)||next.items.length===0||next.items.length>1000)throw new CommandError(400,'Minimal satu item pekerjaan diperlukan.');
    if(next.clientId){const client=await tx.get(db.collection('clients').doc(next.clientId));if(!client.exists||client.data().isArchived)throw new CommandError(400,'Klien tidak tersedia.');}
    const totals=calculateQuotationTotals(next.items,next.discount??0,next.taxPercentage??0);
    Object.assign(next,totals);
    if(next.dpPercentage!==undefined){if(!Number.isFinite(next.dpPercentage)||next.dpPercentage<0||next.dpPercentage>100)throw new CommandError(400,'DP tidak valid.');next.dpAmount=Math.round(totals.grandTotal*next.dpPercentage/100);}
    if(next.status==='AGREED'&&(!next.clientId||!next.quotationNumber))throw new CommandError(400,'Klien dan nomor penawaran wajib sebelum kesepakatan.');
    if(next.status==='AGREED'&&old?.status!=='AGREED'){
      const isMaker = (old?.createdBy === user.uid);
      const isAdminOrDirector = ['OWNER', 'ADMIN', 'DIRECTOR'].includes(user.role);
      if(isMaker && !isAdminOrDirector) throw new CommandError(403,'Pemisahan tugas (Maker-Checker): Pembuat penawaran dilarang menyetujui penawarannya sendiri.');
      next.agreedAt=now;
      next.agreedBy=user.uid;
      if(isMaker && isAdminOrDirector) next.approvalOverrideNote = 'Disetujui mandiri oleh Admin/Direktur (Admin Override)';
    }
    let numbering:any=null;
    if(action==='create'){const key='QUO-'+now.slice(0,7),counter=db.collection('documentCounters').doc(key),c=await tx.get(counter);numbering={counter,sequence:(c.data()?.sequence||0)+1};next.quotationNumber=key+'-'+String(numbering.sequence).padStart(5,'0');}
    else if(data.quotationNumber&&data.quotationNumber!==old.quotationNumber)throw new CommandError(409,'Nomor dokumen dikendalikan server.');
    const event={id:randomUUID(),eventType:action==='create'?'CREATED':'UPDATED',timestamp:now,userId:user.uid,userName:user.email,revisionNumber:next.revisionNumber||0,snapshotTotal:totals.grandTotal};
    next=cleanRecord({...next,id:ref.id,projectId,updatedAt:now,history:[...(old?.history||[]).slice(-100),event]});
    if(numbering)tx.set(numbering.counter,{sequence:numbering.sequence,updatedAt:now});tx.set(ref,next);tx.create(db.collection('financialAuditLogs').doc(),{projectId:projectId||null,transactionType:'Quotation',transactionId:ref.id,action:action==='create'?'CREATE':'UPDATE',userId:user.uid,userName:user.email,userRole:user.role,oldValue:old||null,newValue:next,reason:action,createdAt:now});
    return{id:ref.id};
  });
}
