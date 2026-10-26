import { quotationCommand } from '../server/quotationService';
import { sendProjectReminders } from '../server/emailOutbox';
import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import { initializeTestEnvironment,assertFails,assertSucceeds } from '@firebase/rules-unit-testing';
import { doc,setDoc,updateDoc,getDoc,deleteDoc,collection,getDocs } from 'firebase/firestore';
import { initializeApp,deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import express from 'express';
import { executeFinanceCommand } from '../server/financeCommands';
import { setServerAuthDependencies } from '../server/auth';
import { registerRepairRoutes } from '../server/repairRoutes';
import { saveProject,listProjects } from '../server/projectService';
import { calculateQuotationTotals,assertSafeMoney,formatRupiah } from '../src/engine/financial/financialEngine';
import { projectReport } from '../src/engine/financial/reportModel';
import { dueNotifications } from '../src/engine/notificationEngine';

const projectId='demo-mdrawing-repair';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8888')throw Error('Tests require the local emulator explicitly; production is forbidden.');
const app=initializeApp({projectId},'repair-tests'),db=getFirestore(app);
let env:any,server:any,url:string;
const capabilities=Object.fromEntries(['canViewFinance','canEditFinance','canApproveFinance','canVoidFinanceTransaction','canViewProfit','canCreateProject','canEditProject','canDeleteProject'].map(k=>[k,true]));
const maker={uid:'maker',email:'maker@test.invalid',role:'FINANCE',isActive:true,assignedProjects:['pA'],capabilities};
const checker={...maker,uid:'checker',email:'checker@test.invalid'};
const owner={...maker,uid:'owner',email:'owner@test.invalid',role:'OWNER'};
let sequence=0;
const command=(u:any,collection:string,action:string,data:any,id?:string,reason='')=>executeFinanceCommand(db,u,{collection,action,data,id,reason,requestId:'test-request-'+(++sequence)});
beforeAll(async()=>{
  env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8888,rules:readFileSync('firestore.rules','utf8')}});await env.clearFirestore();
  const now=new Date().toISOString();
  for(const u of [maker,checker,owner,{...maker,uid:'team',role:'TEAM',capabilities:{}}])await db.collection('users').doc(u.uid).set({uid:u.uid,role:u.role,email:u.email,isActive:true,assignedProjectIds:['pA'],...u.capabilities,createdAt:now,updatedAt:now});
  for(const p of ['pA','pB'])await db.collection('projects').doc(p).set({id:p,projectName:'Project '+p,projectCode:'PRJ-2026-'+p,projectType:'Arsitektur',clientName:'Test Client',clientId:'client',projectLeaderId:'owner',members:[],startDate:'2026-10-01',targetDate:'2026-12-01',status:'Planning',createdAt:now});
  await db.collection('clients').doc('client').set({clientName:'Test Client'});
  await db.collection('vendors').doc('vendor').set({vendorName:'Test Vendor'});
  await db.collection('quotations').doc('quote').set({id:'quote',projectId:'pA',clientId:'client',status:'AGREED',grandTotal:1000});
  await db.collection('drawingItems').doc('drawing').set({id:'drawing',projectId:'pA',drawingNumber:'AR-01',drawingName:'Private Drawing',progress:0,status:'Belum Mulai',isDeleted:false});
  setServerAuthDependencies({adminDb:db,authInstance:{verifyIdToken:async(token:string)=>({uid:token,email:token+'@test.invalid',email_verified:true,role:'OWNER'}) as any} as any});
  const web=express();web.use(express.json());registerRepairRoutes(web,db);web.post('/api/solar/chat',(_req,res)=>res.json({reachedUpstream:true}));
  server=await new Promise<any>(resolve=>{const s=web.listen(0,'127.0.0.1',()=>resolve(s));});url='http://127.0.0.1:'+server.address().port;
},30000);
afterAll(async()=>{await new Promise<void>(r=>server?.close(()=>r()));await env?.cleanup();await db.terminate();await deleteApp(app);});
describe('repaired domain and real Firestore command transactions',()=>{
  it('preserves fractional quantities and rejects invalid rupiah',()=>{expect(calculateQuotationTotals([{description:'area',quantity:.5,unitPrice:100}]).grandTotal).toBe(50);expect(calculateQuotationTotals([{description:'area',quantity:1.4,unitPrice:100}]).grandTotal).toBe(140);expect(()=>assertSafeMoney(1.5)).toThrow();expect(formatRupiah(-500)).toContain('-');});
  it('creates serializable terms, enforces invoice limit and posts only on checker confirmation',async()=>{
    const term=await command(maker,'financeTerms','create',{projectId:'pA',termName:'Full',amountType:'Percentage',percentageValue:100,nominalValue:undefined});
    const invoice=await command(maker,'invoices','create',{projectId:'pA',clientId:'client',termId:term.id,subTotal:100,discount:0,taxPercentage:0});
    expect((await db.collection('invoices').doc(invoice.id).get()).data()?.status).toBe('Draft');
    await command(maker,'invoices','status',{status:'Sent'},invoice.id);
    const payment=await command(maker,'clientPayments','create',{projectId:'pA',invoiceId:invoice.id,amount:40});
    expect(payment.status).toBe('Draft');expect((await db.collection('invoices').doc(invoice.id).get()).data()?.paidAmount).toBe(0);
    await expect(command(maker,'clientPayments','status',{status:'Confirmed'},payment.id)).rejects.toThrow('Pembuat');
    await command(checker,'clientPayments','status',{status:'Confirmed'},payment.id);
    expect((await db.collection('invoices').doc(invoice.id).get()).data()?.paidAmount).toBe(40);
    const logs=await db.collection('financialAuditLogs').where('transactionId','==',payment.id).get();expect(logs.size).toBe(2);
  });
  it('rejects cross-project, malformed, inactive and client-written totals',async()=>{
    await db.collection('invoices').doc('other').set({projectId:'pB',status:'Sent',grandTotal:100});
    await expect(command(maker,'clientPayments','create',{projectId:'pA',invoiceId:'other',amount:10})).rejects.toThrow('sesuai proyek');
    await expect(command(maker,'clientPayments','create',{projectId:'pA',invoiceId:'other',amount:1.5})).rejects.toThrow();
    await expect(command({...maker,isActive:false},'clientPayments','create',{projectId:'pA',amount:10})).rejects.toThrow('Izin');
    await db.collection('invoices').doc('void').set({projectId:'pA',status:'Void',grandTotal:100});
    await expect(command(maker,'clientPayments','create',{projectId:'pA',invoiceId:'void',amount:10})).rejects.toThrow('Status');
  });
  it('does not double-post on retry and forbids reuse of a key for different content',async()=>{
    await db.collection('invoices').doc('retry-invoice').set({projectId:'pA',status:'Sent',grandTotal:100,paidAmount:0});
    const input={collection:'clientPayments',action:'create',data:{projectId:'pA',invoiceId:'retry-invoice',amount:30},requestId:'retry-key-0001'};
    const [a,b]=await Promise.all([executeFinanceCommand(db,maker,input),executeFinanceCommand(db,maker,input)]);expect(a.id).toBe(b.id);
    await expect(executeFinanceCommand(db,maker,{...input,data:{...input.data,amount:31}})).rejects.toThrow('berbeda');
  });
  it('two concurrent draft confirmations cannot exceed the outstanding balance',async()=>{
    await db.collection('invoices').doc('race').set({projectId:'pA',status:'Sent',grandTotal:100,paidAmount:0});
    const a=await command(maker,'clientPayments','create',{projectId:'pA',invoiceId:'race',amount:80});
    const b=await command(maker,'clientPayments','create',{projectId:'pA',invoiceId:'race',amount:80});
    const results=await Promise.allSettled([command(checker,'clientPayments','status',{status:'Confirmed'},a.id),command(checker,'clientPayments','status',{status:'Confirmed'},b.id)]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((await db.collection('invoices').doc('race').get()).data()?.paidAmount).toBe(80);
  });
  it('reversal is permissioned and recalculates the invoice atomically',async()=>{
    const snap=await db.collection('clientPayments').where('invoiceId','==','race').where('status','==','Confirmed').get(),id=snap.docs[0].id;
    await expect(command({...checker,capabilities:{...capabilities,canVoidFinanceTransaction:false}},'clientPayments','status',{status:'Cancelled'},id,'reason')).rejects.toThrow('izin');
    await command(checker,'clientPayments','status',{status:'Cancelled'},id,'synthetic reversal');expect((await db.collection('invoices').doc('race').get()).data()?.paidAmount).toBe(0);
    await expect(command(checker,'clientPayments','status',{status:'Confirmed'},id)).rejects.toThrow('draft');
  });
  it('uses the same confirmed/paid/manual basis in every cashflow calculation',()=>{
    const m=projectReport({contractValue:1000},[],[],[{id:'c',status:'Confirmed',amount:50},{id:'d',status:'Draft',amount:100}],[],[],[],[{id:'a',status:'Approved',amount:30},{id:'p',status:'Paid',amount:20}],[{id:'m',date:'2026-10-01',type:'IN',amount:10,referenceType:'Manual'}]);
    expect(m.totalPaid).toBe(50);expect(m.totalCashIn).toBe(60);expect(m.totalCashOut).toBe(20);expect(m.netCash).toBe(40);expect(m.netProfitAccrual).toBe(-50);
  });
});
describe('actual repaired rules, routes and project isolation',()=>{
  it('denies financial writes even to OWNER clients and prevents moving drawings',async()=>{
    const finance=env.authenticatedContext('maker').firestore(),ownerClient=env.authenticatedContext('owner').firestore(),team=env.authenticatedContext('team').firestore();
    await assertFails(setDoc(doc(finance,'clientPayments','fake'),{projectId:'pA',invoiceId:'race',amount:1000,status:'Confirmed'}));
    await assertFails(updateDoc(doc(ownerClient,'invoices','race'),{paidAmount:100,status:'Paid'}));
    await assertFails(updateDoc(doc(ownerClient,'drawingItems','drawing'),{projectId:'pB'}));
    await assertFails(updateDoc(doc(team,'drawingItems','drawing'),{progress:500,status:'ARBITRARY'}));
    await assertSucceeds(updateDoc(doc(team,'drawingItems','drawing'),{progress:25,status:'Proses'}));
    await assertSucceeds(getDoc(doc(finance,'invoices','race')));
    await assertFails(setDoc(doc(team,'financialAuditLogs','forged'),{projectId:'pA',userId:'owner'}));
  });
  it('protects legacy project finances and returns redacted projects through the server reader',async()=>{
    await db.collection('projects').doc('pA').update({contractValue:999,expectedProfit:900});
    const team=env.authenticatedContext('team').firestore();await assertFails(getDoc(doc(team,'projects','pA')));
    const projects=await listProjects(db,{uid:'team',role:'TEAM',isActive:true,assignedProjects:['pA'],capabilities:{}});
    expect(projects).toHaveLength(1);expect(projects[0]).not.toHaveProperty('contractValue');expect(projects[0]).not.toHaveProperty('expectedProfit');
  });
  it('requires real server authorization for Solar before provider/DB data handling',async()=>{
    expect((await fetch(url+'/api/solar/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status).toBe(401);
    process.env.AI_ENABLED='false';expect((await fetch(url+'/api/solar/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer maker'},body:'{}'})).status).toBe(503);
    const denied=await fetch(url+'/api/projects',{headers:{Authorization:'Bearer nonexistent'}});expect(denied.status).toBe(401);
  });
  it('resume keeps project identity and activation enforces the server preflight gate',async()=>{
    const r=await saveProject(db,owner,{action:'save',id:'pA',data:{projectName:'Resumed Project'}});expect(r.id).toBe('pA');
    await saveProject(db,owner,{action:'activate',id:'pA',data:{}});expect((await db.collection('projects').doc('pA').get()).data()?.workflowStage).toBe('ACTIVE');
    await expect(saveProject(db,owner,{action:'activate',id:'pB',data:{}})).rejects.toThrow('Penawaran');
  });
  it('creates no fake overdue notification and observes date-only boundaries',()=>{
    const p={id:'pA',projectName:'A',projectCode:'A'};
    expect(dueNotifications(p,[{id:'d',deadline:'2026-10-26',status:'Proses'}],[],[],false,'2026-10-26')).toHaveLength(0);
    expect(dueNotifications(p,[{id:'d',deadline:'2026-10-25',status:'Proses'}],[],[],false,'2026-10-26')).toHaveLength(1);
  });
});

describe('regressions for revision, vendor, setup, outbox and AI budgets',()=>{
 it('locks agreed quotations and binds creation retries to the actor and content',async()=>{
   const input={action:'create',id:'new-quote',data:{clientId:'client',projectName:'Synthetic',items:[{description:'area',quantity:.5,unitPrice:100}]}};
   await quotationCommand(db,maker,input);await quotationCommand(db,maker,input);
   await expect(quotationCommand(db,checker,input)).rejects.toThrow('digunakan');
   await expect(quotationCommand(db,maker,{...input,data:{...input.data,projectName:'Changed'}})).rejects.toThrow('digunakan');
   await quotationCommand(db,maker,{action:'update',id:input.id,data:{status:'AGREED'}});
   await expect(quotationCommand(db,maker,{action:'update',id:input.id,data:{discount:1}})).rejects.toThrow('dikunci');
   await assertFails(setDoc(doc(env.authenticatedContext('owner').firestore(),'quotations','bypass'),input.data));
 });
 it('posts vendor payments through checker approval and rejects foreign contract terms',async()=>{
   const pv=await command(maker,'projectVendors','create',{projectId:'pA',vendorId:'vendor',contractValue:200});
   const pv2=await command(maker,'projectVendors','create',{projectId:'pA',vendorId:'vendor',contractValue:200});
   const term=await command(maker,'vendorPaymentTerms','create',{projectId:'pA',projectVendorId:pv.id,termName:'Full',amountType:'Percentage',percentageValue:100});
   await expect(command(maker,'vendorBills','create',{projectId:'pA',projectVendorId:pv2.id,vendorId:'vendor',termId:term.id,amount:50})).rejects.toThrow('Termin');
   const bill=await command(maker,'vendorBills','create',{projectId:'pA',projectVendorId:pv.id,vendorId:'vendor',termId:term.id,amount:50});
   await expect(command(maker,'vendorBills','update',{amount:60},bill.id)).rejects.toThrow('buat ulang');
   await command(maker,'vendorBills','status',{status:'Received'},bill.id);
   const payment=await command(maker,'vendorPayments','create',{projectId:'pA',billId:bill.id,amount:30});
   await command(checker,'vendorPayments','status',{status:'Confirmed'},payment.id);
   expect((await db.collection('vendorBills').doc(bill.id).get()).data()?.paidAmount).toBe(30);
   await expect(command(maker,'projectVendors','update',{contractValue:1},pv.id)).rejects.toThrow('tagihan');
 });
 it('never rewrites progressed drawings on setup retry and resumes a saved failed job',async()=>{
   const input={action:'create',id:'setup-project',requestId:'setup-project-key',data:{projectName:'Setup synthetic',projectCode:'SETUP-001'},drawings:[{id:'source-1',drawingName:'Drawing one'}]};
   await saveProject(db,owner,input);
   const ds=await db.collection('drawingItems').where('projectId','==',input.id).get();expect(ds.size).toBe(1);await ds.docs[0].ref.update({status:'Proses',progress:30});
   await saveProject(db,owner,input);expect((await ds.docs[0].ref.get()).data()?.progress).toBe(30);
   const jobs=await db.collection('setupJobs').where('projectId','==',input.id).get();await jobs.docs[0].ref.update({status:'FAILED'});
   await expect(saveProject(db,owner,{action:'activate',id:input.id,data:{}})).rejects.toThrow('Setup');
   await saveProject(db,owner,{action:'save',id:input.id,data:{}});
   expect((await jobs.docs[0].ref.get()).data()?.status).toBe('COMPLETE');expect((await ds.docs[0].ref.get()).data()?.progress).toBe(30);
 });
 it('deduplicates concurrent reminder attempts and records uncertain SMTP without automatic retry',async()=>{
   process.env.MAIL_PREVIEW='false';let calls=0;
   await db.collection('drawingItems').doc('mail-drawing').set({projectId:'pA',drawingName:'<script>x</script>',picEmail:'pic@test.invalid',deadline:'2026-10-01',isDeleted:false,status:'Proses'});
   const factory=async()=>({sendMail:async(message:any)=>{calls++;expect(message.html).not.toContain('<script>x</script>');return{accepted:['pic@test.invalid'],messageId:'synthetic'};}});
   const input={projectId:'pA',drawingId:'mail-drawing'};
   const r=await Promise.all([sendProjectReminders(db,owner,input,factory),sendProjectReminders(db,owner,input,factory)]);
   expect(calls).toBe(1);expect(r.reduce((s,x)=>s+x.sentCount,0)).toBe(1);
   await db.collection('drawingItems').doc('mail-unknown').set({projectId:'pA',drawingName:'Unknown',picEmail:'pic@test.invalid',isDeleted:false});let failures=0;
   const failing=async()=>({sendMail:async()=>{failures++;throw Error('synthetic disconnect');}});
   const unknown=await sendProjectReminders(db,owner,{projectId:'pA',drawingId:'mail-unknown'},failing);expect(unknown.results[0].status).toBe('UNKNOWN');
   await sendProjectReminders(db,owner,{projectId:'pA',drawingId:'mail-unknown'},failing);expect(failures).toBe(1);
 });
 it('enforces atomic AI budget reservations before the mocked upstream',async()=>{
   process.env.AI_ENABLED='true';process.env.AI_DAILY_TOKEN_LIMIT='100000';process.env.AI_DAILY_BUDGET_IDR='1';process.env.AI_PRICE_CEILING_IDR_PER_MILLION_TOKENS='1000000';
   const post=(body:any)=>fetch(url+'/api/solar/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer maker'},body:JSON.stringify(body)});
   expect((await post({})).status).toBe(429);
   process.env.AI_DAILY_BUDGET_IDR='1000000';
   expect((await post({projectId:'pB'})).status).toBe(403);expect((await post({apiKey:'forbidden'})).status).toBe(400);
   expect((await post({projectId:'pA'})).status).toBe(200);
   const quotas=await db.collection('aiQuotas').get();expect(quotas.size).toBe(2);
   process.env.AI_ENABLED='false';
 });
});

it('rejects counter tampering and percentage over-allocation',async()=>{
 await assertFails(setDoc(doc(env.authenticatedContext('owner').firestore(),'documentCounters','INV-2026-10'),{sequence:0}));
 await expect(command(maker,'financeTerms','create',{projectId:'pA',termName:'Over',amountType:'Percentage',percentageValue:1})).rejects.toThrow('100%');
});

it('reserves invoice creation once on retry and caps aggregate billing at contract value',async()=>{
 const terms=await db.collection('financeTerms').where('projectId','==','pA').get();const term=terms.docs.find(d=>d.data().amountType==='Percentage')!;
 const input={collection:'invoices',action:'create',requestId:'invoice-retry-key-0001',data:{projectId:'pA',clientId:'client',termId:term.id,subTotal:50,discount:0,taxPercentage:0}};
 const [a,b]=await Promise.all([executeFinanceCommand(db,maker,input),executeFinanceCommand(db,maker,input)]);expect(a.id).toBe(b.id);
 const nominal=await command(maker,'financeTerms','create',{projectId:'pA',termName:'Nominal large',amountType:'Nominal',nominalValue:10000});
 await expect(command(maker,'invoices','create',{projectId:'pA',clientId:'client',termId:nominal.id,subTotal:1000})).rejects.toThrow('kontrak');
});
