import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { initializeApp,getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if(!getApps().length)initializeApp();
// Must match firebase-applet-config.json; deployment preflight checks this value.
const database=process.env.MDRAWING_FIRESTORE_DATABASE_ID || 'default';
const db=database==='(default)'?getFirestore():getFirestore(database);
/** Finance is deliberately NOT rewritten by asynchronous triggers. Commands own ledger/balances. */
export const syncClientProjects = onDocumentWritten({document:'clients/{clientId}',database},async event=>{
  const after=event.data?.after;if(!after?.exists)return;
  const before=event.data?.before.data(),data=after.data();
  if(!data)return;
  if(before?.clientName===data.clientName&&before?.email===data.email)return;
  const projects=await db.collection('projects').where('clientId','==',event.params.clientId).get();
  for(let i=0;i<projects.docs.length;i+=200){const batch=db.batch();for(const p of projects.docs.slice(i,i+200))batch.update(p.ref,{clientName:data.clientName||'',clientEmail:data.email||'',updatedAt:new Date().toISOString()});await batch.commit();}
});
export const syncPublicDirectory = onDocumentWritten({document:'users/{uid}',database},async event=>{
  const after=event.data?.after,ref=db.collection('userDirectory').doc(event.params.uid);
  if(!after?.exists){await ref.delete();return;}
  const u=after.data();if(!u)return;await ref.set({uid:event.params.uid,name:u.name||'',email:u.email||'',role:u.role||'VIEWER',isActive:u.isActive===true,updatedAt:new Date().toISOString()});
});
