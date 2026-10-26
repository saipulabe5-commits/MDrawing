import { auth } from './firebase';
import toast from 'react-hot-toast';
const pending=new Map<string,string>();
/** Same key is retained after an uncertain network outcome; discarded only after a definitive response. */
export async function apiRequest(path:string,body?:any,method=body?'POST':'GET'):Promise<any> {
  const user=auth.currentUser;if(!user) throw new Error('Sesi login diperlukan.');
  let token = await user.getIdToken();
  let response = await fetch(path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if (response.status === 401) {
    try {
      token = await user.getIdToken(true);
      response = await fetch(path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    } catch {
      // Continue to error parsing below
    }
  }
  const result=await response.json().catch(()=>({error:'Respons server tidak valid.'}));
  if(!response.ok) throw new Error(result.error||`Server HTTP ${response.status}`);
  return result;
}
export async function financeCommand(collection:string,action:string,data:any={},id?:string,reason='') {
  if((action==='status'&&['Cancelled','Void'].includes(data.status)||action==='delete'&&collection==='cashflowEntries')&&!reason.trim()){
    reason=window.prompt('Alasan pembatalan transaksi (wajib):')||'';
    if(!reason.trim())throw new Error('Pembatalan belum dilakukan: alasan wajib diisi.');
  }
  const payload=JSON.parse(JSON.stringify({collection,action,data,id,reason}));
  const key=JSON.stringify(payload),requestId=pending.get(key)||crypto.randomUUID();pending.set(key,requestId);
  try { const result=await apiRequest('/api/finance/command',{...payload,requestId});pending.delete(key);return result; }
  catch(error:any){toast.error(error.message||'Transaksi belum berhasil.');throw error;}
}
export async function uploadProjectFile(file: File, options?: { projectId?: string; category?: string }): Promise<any> {
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const res = await apiRequest('/api/files/upload', {
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    base64Data,
    projectId: options?.projectId,
    category: options?.category || 'GENERAL'
  });
  return res.file;
}
