import * as store from 'firebase/firestore';
import { apiRequest } from './commandClient';
import { db } from './firebase';
const requests=new Map<string,string>();
async function command(action:string,id:string,data:any={}) {return apiRequest('/api/quotations/command',{action,id,data:JSON.parse(JSON.stringify(data))});}
export async function addDoc(ref:any,data:any):Promise<any>{if(ref.id!=='quotations')return store.addDoc(ref,data);const key=JSON.stringify(data),id=requests.get(key)||crypto.randomUUID();requests.set(key,id);await command('create',id,data);requests.delete(key);return store.doc(db,'quotations',id);}
export async function setDoc(ref:any,data:any,...options:any[]):Promise<void>{if(ref.parent?.id!=='quotations')return(store.setDoc as any)(ref,data,...options);await command('create',ref.id,data);}
export async function updateDoc(ref:any,data:any):Promise<void>{if(ref.parent?.id!=='quotations')return store.updateDoc(ref,data);await command('update',ref.id,data);}
export async function deleteDoc(ref:any):Promise<void>{if(ref.parent?.id!=='quotations')return store.deleteDoc(ref);await command('delete',ref.id);}
