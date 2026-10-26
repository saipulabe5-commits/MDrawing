import type { Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { authenticateRequest } from './auth';
import { executeFinanceCommand, CommandError, capability, projectAccess } from './financeCommands';
import { listProjects,saveProject } from './projectService';
import { quotationCommand } from './quotationService';
import { sendProjectReminders } from './emailOutbox';
export function registerRepairRoutes(app:Express,db:any) {
  const protect=(handler:any)=>async(req:any,res:any)=>{
    try {const auth=await authenticateRequest(req,{checkRevoked:true});if(!auth.ok)return res.status(auth.status).json({error:auth.message,code:auth.code});if(!db)throw new CommandError(503,'Database server belum tersedia.');return await handler(req,res,auth.user);}
    catch(e:any){console.error('[COMMAND]',e.status||500,e.message);return res.status(e.status||500).json({error:e.status?e.message:'Operasi belum berhasil. Silakan coba dengan request yang sama.'});}
  };
  app.post('/api/finance/command',protect(async(req:any,res:any,user:any)=>res.json(await executeFinanceCommand(db,user,req.body))));
  app.post('/api/quotations/command',protect(async(req:any,res:any,user:any)=>res.json(await quotationCommand(db,user,req.body))));
  app.get('/api/quotations',protect(async(req:any,res:any,user:any)=>{
    if(!capability(user,'canViewFinance'))return res.json({quotations:[]});
    const found=new Map<string,any>();
    const collect=async(q:any)=>{const snap=await q.limit(2001).get();if(snap.size>2000)throw new CommandError(413,'Terlalu banyak penawaran; arsipkan/filter sebelum memuat.');snap.forEach((d:any)=>{if(!d.data().isArchived)found.set(d.id,{...d.data(),id:d.id});});};
    if(['OWNER','ADMIN'].includes(user.role))await collect(db.collection('quotations'));
    else{await collect(db.collection('quotations').where('createdBy','==',user.uid));const projects=await listProjects(db,user);const allowed=new Set(projects.map((p:any)=>p.id));for(const [id,q]of found)if(q.projectId&&!allowed.has(q.projectId))found.delete(id);for(let i=0;i<projects.length;i+=30)await collect(db.collection('quotations').where('projectId','in',projects.slice(i,i+30).map((p:any)=>p.id)));}
    res.json({quotations:[...found.values()].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))});
  }));
  app.get('/api/projects',protect(async(req:any,res:any,user:any)=>res.json({projects:await listProjects(db,user)})));
  app.post('/api/projects/command',protect(async(req:any,res:any,user:any)=>res.json(await saveProject(db,user,req.body))));
  app.post('/api/drawings/status',protect(async(req:any,res:any,user:any)=>{
    const {projectId,drawingId,newStatus,expectedUpdatedAt,requestId}=req.body;
    if(!capability(user,'canUpdateDrawingStatus'))throw new CommandError(403,'Izin status gambar diperlukan.');
    if(!/^[\w-]{1,128}$/.test(drawingId||'')||!/^[-\w]{8,128}$/.test(requestId||'')||!['Belum Mulai','Proses','Review','Revisi','Selesai','Hold'].includes(newStatus))throw new CommandError(400,'Parameter aksi gambar tidak valid.');
    const ref=db.collection('drawingItems').doc(drawingId),receipt=db.collection('commandReceipts').doc(user.uid+'-'+requestId);
    await db.runTransaction(async(tx:any)=>{const oldReceipt=await tx.get(receipt);if(oldReceipt.exists){const r=oldReceipt.data();if(r.projectId!==projectId||r.drawingId!==drawingId||r.newStatus!==newStatus)throw new CommandError(409,'Request ID telah digunakan untuk aksi lain.');return;}await projectAccess(db,user,projectId,tx);const s=await tx.get(ref);if(!s.exists||s.data().projectId!==projectId)throw new CommandError(403,'Gambar di luar proyek.');const d=s.data();if(d.isDeleted||d.updatedAt!==expectedUpdatedAt)throw new CommandError(409,'Data gambar berubah. Muat ulang sebelum konfirmasi.');if(user.role==='TEAM'&&d.picId&&d.picId!==user.uid)throw new CommandError(403,'Gambar ditugaskan ke PIC lain.');const now=new Date().toISOString();tx.update(ref,{status:newStatus,progress:newStatus==='Selesai'?100:newStatus==='Belum Mulai'?0:d.progress===100?99:d.progress,updatedAt:now});tx.create(db.collection('aiAuditLogs').doc(),{actorUid:user.uid,actorEmail:user.email,projectId,targetId:drawingId,tool:'updateDrawingStatus',confirmedByUser:true,success:true,timestamp:now,oldStatus:d.status,newStatus});tx.set(receipt,{actorUid:user.uid,projectId,drawingId,newStatus,createdAt:now});});res.json({success:true,message:'Status gambar dan audit berhasil disimpan.'});
  }));
  app.post('/api/send-email',protect(async()=>{throw new CommandError(403,'HTML email bebas dinonaktifkan; gunakan pengingat proyek.');}));
  app.post('/api/send-manual-reminder',protect(async(req:any,res:any,user:any)=>res.json(await sendProjectReminders(db,user,req.body))));
  app.post('/api/check-deadline-emails',protect(async(req:any,res:any,user:any)=>res.json(await sendProjectReminders(db,user,{projectId:req.body.projectId}))));
  app.get('/api/check-deadline-emails',(_req,res)=>res.status(405).json({error:'Gunakan POST dengan identitas service/pengguna dan projectId; secret URL tidak didukung.'}));
  app.post('/api/master/archive',protect(async(req:any,res:any,user:any)=>{
    if(!capability(user,'canEditFinance')||!['clients','vendors'].includes(req.body.collection))throw new CommandError(403,'Izin arsip master ditolak.');
    const {collection,id}=req.body;if(!/^[\w-]{1,128}$/.test(id||''))throw new CommandError(400,'ID tidak valid.');
    const ref=db.collection(collection).doc(id);
    await db.runTransaction(async(tx:any)=>{const snap=await tx.get(ref);if(!snap.exists)throw new CommandError(404,'Data tidak ditemukan.');tx.update(ref,{isArchived:true,updatedAt:new Date().toISOString()});tx.create(db.collection('activityLogs').doc(),{entityType:collection,entityId:id,action:'ARCHIVE',userId:user.uid,userName:user.email,createdAt:new Date().toISOString()});});res.json({id});
  }));
  app.post('/api/activity',protect(async(req:any,res:any,user:any)=>{
    const {projectId,entityId,entityType,action,details}=req.body;if(projectId)await projectAccess(db,user,projectId);
    if(!['CREATE','UPDATE','DELETE','STATUS_CHANGE','NOTIFY','ARCHIVE'].includes(action))throw new CommandError(400,'Jenis aktivitas tidak valid.');
    const ref=db.collection('activityLogs').doc();await ref.set({id:ref.id,projectId:projectId||null,entityId:String(entityId||'').slice(0,128),entityType:String(entityType||'').slice(0,60),action,details:String(details||'').slice(0,4000),userId:user.uid,userName:user.email,userRole:user.role,createdAt:new Date().toISOString()});res.json({id:ref.id});
  }));
  app.post('/api/files/upload',protect(async(req:any,res:any,user:any)=>{
    const {projectId,filename,mimeType,base64Data,category}=req.body;
    if(!filename||typeof filename!=='string')throw new CommandError(400,'Nama berkas wajib diisi.');
    if(!base64Data||typeof base64Data!=='string')throw new CommandError(400,'Data berkas (base64) wajib disertakan.');
    const cleanFilename=path.basename(filename).replace(/[^\w.-]/g,'_');
    const ext=path.extname(cleanFilename).toLowerCase();
    const allowedExts=['.dwg','.dxf','.pdf','.png','.jpg','.jpeg','.webp','.xlsx','.xls','.zip'];
    if(!allowedExts.includes(ext))throw new CommandError(400,`Format berkas "${ext}" tidak didukung. Format yang diizinkan: DWG, DXF, PDF, Gambar, Excel, ZIP.`);
    if(projectId)await projectAccess(db,user,projectId);
    const base64Clean=base64Data.replace(/^data:[^;]+;base64,/,'');
    const buffer=Buffer.from(base64Clean,'base64');
    if(buffer.length>50*1024*1024)throw new CommandError(400,'Ukuran berkas melebihi batas maksimum 50MB.');
    const fileId=randomUUID();
    const diskFilename=`${fileId}_${cleanFilename}`;
    const uploadsDir=path.join(process.cwd(),'uploads');
    if(!fs.existsSync(uploadsDir))fs.mkdirSync(uploadsDir,{recursive:true});
    fs.writeFileSync(path.join(uploadsDir,diskFilename),buffer);
    const fileRecord={id:fileId,projectId:projectId||null,originalName:filename,diskFilename,mimeType:mimeType||'application/octet-stream',sizeBytes:buffer.length,category:category||'GENERAL',fileUrl:`/api/files/download/${fileId}`,uploadedBy:user.uid,uploadedByEmail:user.email,createdAt:new Date().toISOString()};
    await db.collection('projectFiles').doc(fileId).set(fileRecord);
    res.json({success:true,file:fileRecord});
  }));
  app.get('/api/files/download/:fileId',async(req:any,res:any)=>{
    try{
      const fileId=req.params.fileId;
      if(!/^[\w-]{1,128}$/.test(fileId||''))return res.status(400).json({error:'ID berkas tidak valid.'});
      if(!db)return res.status(503).json({error:'Database belum siap.'});
      const docSnap=await db.collection('projectFiles').doc(fileId).get();
      if(!docSnap.exists)return res.status(404).json({error:'Berkas tidak ditemukan.'});
      const fileData=docSnap.data();
      const filePath=path.join(process.cwd(),'uploads',fileData.diskFilename);
      if(!fs.existsSync(filePath))return res.status(404).json({error:'Fisik berkas di server tidak ditemukan.'});
      res.setHeader('Content-Type',fileData.mimeType||'application/octet-stream');
      res.setHeader('Content-Disposition',`inline; filename="${encodeURIComponent(fileData.originalName)}"`);
      return res.sendFile(filePath);
    }catch(err:any){
      console.error('[FILE DOWNLOAD ERROR]',err);
      return res.status(500).json({error:'Gagal mengunduh berkas.'});
    }
  });
  app.get('/api/projects/:projectId/files',protect(async(req:any,res:any,user:any)=>{
    const {projectId}=req.params;
    await projectAccess(db,user,projectId);
    const snap=await db.collection('projectFiles').where('projectId','==',projectId).limit(100).get();
    const files=snap.docs.map((d:any)=>d.data());
    res.json({files});
  }));
  // Runs before ALL provider routes. Token reservations are atomic across instances.
  const aiGuard=async(req:any,res:any,next:any)=>{
    try {
      const auth=await authenticateRequest(req,{checkRevoked:true});if(!auth.ok)return res.status(auth.status).json({error:auth.message});
      if(!db)throw new CommandError(503,'Database quota belum tersedia.');
      const serverKey=process.env.UPSTAGE_API_KEY||process.env.SOLAR_API_KEY;
      if(req.path==='/config') return res.json({isConfigured:!!serverKey,model:'solar-pro',apiKey:''});
      if(process.env.AI_ENABLED!=='true')throw new CommandError(503,'AI belum diaktifkan operator pada server.');
      const limit=Number(process.env.AI_DAILY_TOKEN_LIMIT||0),budget=Number(process.env.AI_DAILY_BUDGET_IDR||0),rate=Number(process.env.AI_PRICE_CEILING_IDR_PER_MILLION_TOKENS||0);
      if(!Number.isSafeInteger(limit)||limit<=0||!Number.isSafeInteger(budget)||budget<=0||!Number.isFinite(rate)||rate<=0)throw new CommandError(503,'Batas token, budget harian dan batas atas harga provider wajib dikonfigurasi operator.');
      if(req.body?.apiKey||req.headers['x-solar-api-key'])throw new CommandError(400,'Kunci AI harus dikonfigurasi operator di server.');
      const projectId=req.body?.projectId||req.body?.projectContext?.id;
      if(JSON.stringify(req.body||{}).length>40000)throw new CommandError(413,'Input AI terlalu panjang.');
      if(projectId){
        const project=await projectAccess(db,auth.user,projectId);
        const drawings=await db.collection('drawingItems').where('projectId','==',projectId).where('isDeleted','==',false).limit(100).get();
        const context:any={project:{id:projectId,projectName:String(project.projectName||'').slice(0,300),projectCode:project.projectCode},drawings:drawings.docs.map((d:any)=>({id:d.id,drawingNumber:String(d.data().drawingNumber||'').slice(0,100),drawingName:String(d.data().drawingName||'').slice(0,300),status:d.data().status,deadline:d.data().deadline,progress:d.data().progress}))};
        if(capability(auth.user,'canViewFinance')){const inv=await db.collection('invoices').where('projectId','==',projectId).limit(100).get();context.invoices=inv.docs.map((d:any)=>({id:d.id,grandTotal:d.data().grandTotal,status:d.data().status,remainingAmount:d.data().remainingAmount}));}
        req.authorizedGrounding=JSON.stringify(context);req.body.contextString=req.authorizedGrounding;req.body.projectContext=context.project;
      }else{req.body.contextString='Tidak ada proyek dipilih; jangan mengasumsikan akses ke database.';req.body.projectContext=undefined;req.authorizedGrounding='Tidak ada proyek dipilih.';}
      // UTF-8 bytes provide a deliberately conservative token reservation, including server context.
      const reserve=Buffer.byteLength(JSON.stringify(req.body||{}),'utf8')+8192,cost=Math.ceil(reserve*rate/1000000),day=new Date().toISOString().slice(0,10),now=Date.now();
      await db.runTransaction(async(tx:any)=>{
        const org=db.collection('aiQuotas').doc('org-'+day),usr=db.collection('aiQuotas').doc(auth.user.uid+'-'+day),[o,u]=await Promise.all([tx.get(org),tx.get(usr)]);
        if((o.data()?.reservedTokens||0)+reserve>limit)throw new CommandError(429,'Batas token organisasi tercapai.');
        if((o.data()?.reservedCostIDR||0)+cost>budget)throw new CommandError(429,'Budget AI harian tercapai.');
        const ud=u.data()||{},window=now-(ud.windowStart||0)<60000,count=window?(ud.windowRequests||0):0;
        if(count>=10||(ud.requests||0)>=Number(process.env.AI_USER_DAILY_REQUEST_LIMIT||50))throw new CommandError(429,'Kuota pengguna tercapai.');
        tx.set(org,{reservedTokens:(o.data()?.reservedTokens||0)+reserve,reservedCostIDR:(o.data()?.reservedCostIDR||0)+cost,day});tx.set(usr,{requests:(ud.requests||0)+1,windowStart:window?ud.windowStart:now,windowRequests:count+1,reservedTokens:(ud.reservedTokens||0)+reserve,day});
      });
      req.authorizedUser=auth.user;req.authorizedProjectId=projectId;next();
    }catch(e:any){res.status(e.status||503).json({error:e.status?e.message:'Verifikasi AI tidak tersedia.'});}
  };
  app.use('/api/solar',aiGuard);app.use('/api/ai',aiGuard);
}
