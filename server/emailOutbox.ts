import { createHash } from 'node:crypto';
import { CommandError,projectAccess } from './financeCommands';
import { getTransporter,generateDeadlineEmailHtml,isValidEmail } from './mailer';
export function jakartaDay(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export async function sendProjectReminders(db:any,user:any,input:any,transportFactory:any=getTransporter){
  if(!['OWNER','ADMIN','PROJECT_LEADER'].includes(user.role))throw new CommandError(403,'Izin pengiriman pengingat diperlukan.');
  const project=await projectAccess(db,user,input.projectId),today=jakartaDay();
  const items=await db.collection('drawingItems').where('projectId','==',input.projectId).where('isDeleted','==',false).get();
  const results:any[]=[];
  const simulated=process.env.MAIL_PREVIEW==='true'&&process.env.NODE_ENV!=='production';
  // Validate configuration before reserving an outbox item; never create Ethereal accounts.
  const transport=await transportFactory();
  for(const snap of items.docs){const item={id:snap.id,...snap.data()};
    if(input.drawingId&&input.drawingId!==item.id)continue;
    let type='MANUAL';
    if(!input.drawingId){if(!item.deadline||['Selesai','Hold'].includes(item.status))continue;const delta=Math.round((Date.parse(item.deadline+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);if(delta!==0&&delta!==3)continue;type=delta===0?'H-0':'H-3';}
    const targetEmail = (input.recipientEmail && isValidEmail(input.recipientEmail)) ? input.recipientEmail : item.picEmail;
    if(!isValidEmail(targetEmail)){results.push({itemId:item.id,status:'SKIPPED',error:'Email penerima tidak valid.'});continue;}
    const key=createHash('sha256').update([input.projectId,item.id,type,today,targetEmail].join(':')).digest('hex'),ref=db.collection('emailOutbox').doc(key),quota=db.collection('emailQuotas').doc(input.projectId+'-'+today);
    const claimed=await db.runTransaction(async(tx:any)=>{const [old,q]=await Promise.all([tx.get(ref),tx.get(quota)]);if(old.exists)return false;if((q.data()?.count||0)>=100)throw new CommandError(429,'Kuota pengingat harian proyek tercapai.');tx.set(quota,{count:(q.data()?.count||0)+1});tx.set(ref,{id:key,projectId:input.projectId,itemId:item.id,type,to:targetEmail,actorUid:user.uid,status:'PENDING',createdAt:new Date().toISOString()});return true;});
    if(!claimed){results.push({itemId:item.id,status:'SKIPPED',error:'Pengingat sudah diproses atau status pengiriman belum pasti; periksa outbox.'});continue;}
    try{
      const html=generateDeadlineEmailHtml({recipientName:input.recipientName||item.picName||'PIC',drawingNumber:item.drawingNumber||'',drawingName:item.drawingName||'',projectName:project.projectName,deadlineDate:item.deadline||'-',type:type as any,progress:item.progress||0,status:item.status||'',customNote:String(input.customNote||'').slice(0,2000),senderName:user.email});
      const info=await transport.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:targetEmail,subject:`[MDrawing ${type}] ${String(item.drawingNumber||'').replace(/[\r\n]/g,' ')}`,html,messageId:`<${key}@mdrawing.local>`});
      const status=simulated?'SIMULATED':'ACCEPTED_BY_SMTP';
      if(!simulated&&(!info.accepted||!info.accepted.includes(targetEmail)))throw Error('Penerima belum diterima SMTP.');
      await ref.update({status,messageId:info.messageId||key,updatedAt:new Date().toISOString()});results.push({itemId:item.id,status});
    }catch(e:any){await ref.update({status:'UNKNOWN',error:String(e.message).slice(0,500),updatedAt:new Date().toISOString()});results.push({itemId:item.id,status:'UNKNOWN',error:'Pengiriman belum pasti; tidak diulang otomatis.'});}
  }
  if(input.drawingId&&!items.docs.some((d:any)=>d.id===input.drawingId))throw new CommandError(404,'Gambar proyek tidak ditemukan.');
  const sentCount=results.filter(r=>r.status==='ACCEPTED_BY_SMTP').length;
  return{success:true,totalChecked:items.size,processedCount:results.length,sentCount,isSimulated:simulated,mode:simulated?'SIMULATOR':'REAL_SMTP',message:simulated?'SIMULASI: tidak ada email dikirim.':`${sentCount} pesan diterima SMTP; belum merupakan bukti delivered.`,results,timestamp:new Date().toISOString()};
}
