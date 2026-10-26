import { randomUUID,createHash } from 'node:crypto';
import { capability, cleanRecord, CommandError, projectAccess,requireMoney } from './financeCommands';
import { evaluatePreFlightInspection } from '../src/engine/workflow/projectWorkflow';
export const FINANCIAL_PROJECT_FIELDS=['contractValue','expectedProfit','budgetOtherExpenses','clientEstimate','vendorBudget','taxPolicy','discountPolicy','targetProfitPercentage'];
export function redactProject(p:any,user:any) { const result={...p}; if(!capability(user,'canViewFinance')) for(const k of FINANCIAL_PROJECT_FIELDS) delete result[k]; if(!capability(user,'canViewProfit')) for(const k of ['expectedProfit','targetProfitPercentage']) delete result[k];return result; }
export async function listProjects(db:any,user:any) {
  const docs=new Map<string,any>();
  if(['OWNER','ADMIN'].includes(user.role)) { const s=await db.collection('projects').limit(2001).get();if(s.size>2000) throw new CommandError(413,'Daftar melebihi 2000 proyek. Gunakan arsip/filter server sebelum memuat.');s.forEach((d:any)=>docs.set(d.id,{...d.data(),id:d.id})); }
  else {
    for(const id of user.assignedProjects||[]) { const d=await db.collection('projects').doc(id).get();if(d.exists)docs.set(id,{...d.data(),id}); }
    const queries=[db.collection('projects').where('projectLeaderId','==',user.uid),db.collection('projects').where('members','array-contains',user.uid)];
    if(user.token?.email_verified) queries.push(db.collection('projects').where('projectLeaderEmail','==',user.email),db.collection('projects').where('members','array-contains',user.email));
    for(const q of queries) { const s=await q.limit(2001).get();if(s.size>2000)throw new CommandError(413,'Terlalu banyak proyek.');s.forEach((d:any)=>docs.set(d.id,{...d.data(),id:d.id})); }
  }
  const result=[];
  for(const p of docs.values()) {
    if(capability(user,'canViewFinance')) { const f=await db.collection('projectFinancials').doc(p.id).get();if(f.exists) Object.assign(p,f.data()); }
    result.push(redactProject(p,user));
  }
  return result.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
}
export async function saveProject(db:any,user:any,input:any) {
  let {action='save',data={},id:requestedId,requestId,templateId,drawings}=input;
  if(!['create','save','activate','archive'].includes(action))throw new CommandError(400,'Aksi proyek tidak valid.');
  if(!capability(user,action==='create'?'canCreateProject':'canEditProject'))throw new CommandError(403,'Izin pengelolaan proyek diperlukan.');
  const id=requestedId||randomUUID();if(!/^[\w-]{1,128}$/.test(id))throw new CommandError(400,'ID proyek tidak valid.');
  const ref=db.collection('projects').doc(id),old=await ref.get();
  if(old.exists){if(!capability(user,'canEditProject'))throw new CommandError(403,'Izin edit proyek diperlukan.');await projectAccess(db,user,id);}
  else if(action!=='create')throw new CommandError(404,'Proyek tidak ditemukan.');
  if(action==='archive') {
    if(!capability(user,'canDeleteProject'))throw new CommandError(403,'Izin arsip proyek diperlukan.');
    await db.runTransaction(async(tx:any)=>{const current=await tx.get(ref);tx.update(ref,{isArchived:true,status:'Hold',updatedAt:new Date().toISOString()});tx.create(db.collection('activityLogs').doc(),{projectId:id,entityType:'PROJECT',entityId:id,action:'ARCHIVE',userId:user.uid,userName:user.email,createdAt:new Date().toISOString()});});return{id};
  }
  const allowed=['projectName','projectCode','projectType','clientId','clientName','clientEmail','quotationId','location','startDate','targetDate','description','members','projectLeaderId','projectLeaderName','projectLeaderEmail'];
  const updates:any=Object.fromEntries(allowed.filter(k=>data[k]!==undefined).map(k=>[k,data[k]]));
  const money:any={};for(const k of FINANCIAL_PROJECT_FIELDS)if(data[k]!==undefined){if(!capability(user,'canEditFinance'))throw new CommandError(403,'Izin keuangan diperlukan.');money[k]=data[k];}
  for(const k of ['contractValue','budgetOtherExpenses','clientEstimate','vendorBudget']) if(money[k]!==undefined)requireMoney(money[k]);
  const combined={...old.data(),...updates,...money,id};
  if(!combined.projectName?.trim()||!combined.projectCode?.trim())throw new CommandError(400,'Nama dan kode proyek wajib.');
  if(updates.members && (!Array.isArray(updates.members)||updates.members.length>200))throw new CommandError(400,'Daftar anggota tidak valid.');
  // Resume the exact saved setup payload before allowing activation; never infer completion from partial drawings.
  const pending=await db.collection('setupJobs').where('projectId','==',id).get();
  const incomplete=pending.docs.find((d:any)=>d.data().status!=='COMPLETE');
  if(incomplete){const j=incomplete.data();if(action==='activate')throw new CommandError(409,'Setup gambar belum selesai. Simpan/lanjutkan setup terlebih dahulu.');requestId=j.requestId;templateId=j.templateId;drawings=j.drawings;}
  if(drawings&&(!Array.isArray(drawings)||drawings.length>10000||drawings.some((d:any)=>typeof d.drawingName!=='string'||!d.drawingName.trim())))throw new CommandError(400,'Setup maksimal 10000 gambar dengan judul valid.');
  const stage=old.data()?.workflowStage||'PROJECT_SETUP',now=new Date().toISOString();
  if(action==='activate') {
    if(!['OWNER','ADMIN'].includes(user.role))throw new CommandError(403,'Aktivasi hanya Owner/Admin.');
    const q=await db.collection('quotations').where('projectId','==',id).where('status','==','AGREED').get();
    if(q.empty)throw new CommandError(409,'Penawaran wajib disepakati sebelum aktivasi.');
    const [f,ds,ts]=await Promise.all([db.collection('projectFinancials').doc(id).get(),db.collection('drawingItems').where('projectId','==',id).get(),db.collection('financeTerms').where('projectId','==',id).get()]);
    const check=evaluatePreFlightInspection({project:{...combined,...f.data(),contractValue:q.docs[0].data().grandTotal},drawingItems:ds.docs.map((d:any)=>d.data()),financeTerms:ts.docs.map((d:any)=>d.data())} as any);
    if(!check.isReady)throw new CommandError(409,check.blockingReasons.join('; '));
    updates.status='Berjalan';updates.workflowStage='ACTIVE';updates.activatedAt=now;updates.activatedBy=user.uid;
    money.contractValue=q.docs[0].data().grandTotal;
  } else if(!old.exists) {updates.status='Planning';updates.workflowStage='PROJECT_SETUP';updates.createdAt=now;updates.createdBy=user.uid;}
  if(data.workflowStage&&action!=='activate'&&stage!=='ACTIVE')updates.workflowStage=stage;
  const setupKey=typeof requestId==='string'?requestId:id;
  const jobId=createHash('sha256').update(id+':'+setupKey).digest('hex');
  // Reserve the unique code and initial project atomically. No destructive migration of legacy fields.
  await db.runTransaction(async(tx:any)=>{
    const current=await tx.get(ref),codeRef=db.collection('projectCodes').doc(createHash('sha256').update(combined.projectCode.toUpperCase()).digest('hex')),code=await tx.get(codeRef);
    const quoteRef=combined.quotationId?db.collection('quotations').doc(combined.quotationId):null;
    const quote=quoteRef?await tx.get(quoteRef):null;
    const jobRef=db.collection('setupJobs').doc(jobId),priorJob=await tx.get(jobRef);
    const payload=JSON.stringify(cleanRecord({templateId,drawings})),fingerprint=createHash('sha256').update(payload).digest('hex');
    if((templateId||drawings?.length)&&priorJob.exists&&priorJob.data().fingerprint!==fingerprint)throw new CommandError(409,'Permintaan setup yang sama berisi gambar berbeda.');
    if(action==='activate'){
      const [q,f,ds,ts,jobs]=await Promise.all([tx.get(db.collection('quotations').where('projectId','==',id).where('status','==','AGREED')),tx.get(db.collection('projectFinancials').doc(id)),tx.get(db.collection('drawingItems').where('projectId','==',id)),tx.get(db.collection('financeTerms').where('projectId','==',id)),tx.get(db.collection('setupJobs').where('projectId','==',id))]);
      if(q.empty||jobs.docs.some((j:any)=>j.data().status!=='COMPLETE'))throw new CommandError(409,'Penawaran/setup belum siap.');
      const check=evaluatePreFlightInspection({project:{...current.data(),...updates,...f.data(),contractValue:q.docs[0].data().grandTotal},drawingItems:ds.docs.map((d:any)=>d.data()),financeTerms:ts.docs.map((d:any)=>d.data())} as any);
      if(!check.isReady)throw new CommandError(409,check.blockingReasons.join('; '));
    }
    if((templateId||drawings?.length)&&!priorJob.exists)tx.set(jobRef,cleanRecord({projectId:id,status:'RUNNING',requestId:setupKey,templateId,drawings,fingerprint,createdAt:now}));
    if(quoteRef){
      if(!quote?.exists||quote.data().status!=='AGREED')throw new CommandError(409,'Penawaran proyek belum disepakati.');
      if(quote.data().projectId && quote.data().projectId!==id)throw new CommandError(409,'Penawaran sudah terhubung ke proyek lain.');
      if(!['OWNER','ADMIN'].includes(user.role)&&quote.data().createdBy!==user.uid)throw new CommandError(403,'Penawaran bukan milik pengguna.');
    }
    if(code.exists&&code.data().projectId!==id)throw new CommandError(409,'Kode proyek telah digunakan.');
    tx.set(codeRef,{projectId:id});
    tx.set(ref,cleanRecord({...updates,id,updatedAt:now}),{merge:true});
    if(quoteRef)tx.update(quoteRef,{projectId:id,updatedAt:now});
    if(Object.keys(money).length)tx.set(db.collection('projectFinancials').doc(id),{...money,projectId:id,updatedAt:now},{merge:true});
    tx.set(db.collection('activityLogs').doc(),{projectId:id,entityType:'PROJECT',entityId:id,action:action==='activate'?'STATUS_CHANGE':'UPDATE',userId:user.uid,userName:user.email,createdAt:now});
  });
  let groups:any[]=[],items:any[]=[];
  if(templateId) {
    const [g,i]=await Promise.all([db.collection('drawingTemplateGroups').where('templateId','==',templateId).get(),db.collection('drawingTemplateItems').where('templateId','==',templateId).get()]);
    groups=g.docs.map((d:any)=>({...d.data(),sourceId:d.id}));items=i.docs.map((d:any)=>({...d.data(),sourceId:d.id}));
  } else if(drawings) {if(!Array.isArray(drawings)||drawings.length>10000)throw new CommandError(400,'Batas setup 10000 gambar.');items=drawings.map((d:any,i:number)=>({...d,sourceId:d.id||String(i)}));}
  if(items.length||groups.length){
    const job=db.collection('setupJobs').doc(jobId);if((await job.get()).data()?.status==='COMPLETE')return{id};await job.set({projectId:id,status:'RUNNING',updatedAt:now},{merge:true});
    const stable=(type:string,source:string)=>createHash('sha256').update(jobId+type+source).digest('hex').slice(0,32);
    const ops:any[]=[];
    for(const g of groups)ops.push([db.collection('drawingGroups').doc(stable('group',g.sourceId)),{id:stable('group',g.sourceId),projectId:id,groupName:g.groupName,groupCode:g.groupCode||'GRP',sortOrder:g.sortOrder||0,createdAt:now,updatedAt:now}]);
    for(const [i,d] of items.entries()){
      if(!d.drawingName?.trim())throw new CommandError(400,'Judul gambar wajib.');
      const itemId=stable('item',d.sourceId);
      ops.push([db.collection('drawingItems').doc(itemId),cleanRecord({id:itemId,projectId:id,groupId:d.groupId&&groups.length?stable('group',d.groupId):null,drawingNumber:d.drawingNumber||'',drawingName:d.drawingName,scale:d.scale||'1:100',picId:d.picId||'',picName:d.picName||'',picEmail:d.picEmail||'',deadline:d.deadline||null,status:'Belum Mulai',progress:0,priority:d.priority||'Normal',notes:d.notes||'',revisionCount:0,isDeleted:false,sortOrder:i,createdAt:now,updatedAt:now,createdBy:user.uid})]);
    }
    try {for(let i=0;i<ops.length;i+=200){await db.runTransaction(async(tx:any)=>{const chunk=ops.slice(i,i+200),existing=await Promise.all(chunk.map(([r]:any)=>tx.get(r)));for(let n=0;n<chunk.length;n++)if(!existing[n].exists)tx.create(chunk[n][0],chunk[n][1]);tx.set(job,{projectId:id,status:'RUNNING',completed:Math.min(i+200,ops.length),total:ops.length,updatedAt:now},{merge:true});});}await job.set({status:'COMPLETE',updatedAt:new Date().toISOString()},{merge:true});}
    catch(error){await job.set({status:'FAILED',updatedAt:new Date().toISOString()},{merge:true});throw error;}
  }
  return{id};
}
