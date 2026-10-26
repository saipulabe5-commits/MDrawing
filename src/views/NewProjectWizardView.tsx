import { apiRequest } from '../lib/commandClient';
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { 
  Building, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, 
  Save, Users, FileText, Calendar, Plus, Trash2 
} from 'lucide-react';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { Project, Quotation, Client, DrawingItem } from '../types';
import { doc, getDoc, collection, getDocs, query, where, orderBy, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Button, Card, Input } from '../components/ui';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { getPublicUserDirectory } from '../security/userDirectory';

export function NewProjectWizardView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quoId=searchParams.get('quoId');const {id:resumeId}=useParams();
  const storageKey='mdrawing-wizard-'+(resumeId||quoId||'new');
  const [stableId]=useState(()=>{const id=resumeId||sessionStorage.getItem(storageKey)||uuidv4();sessionStorage.setItem(storageKey,id);return id;});
  const { appUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [projectCode, setProjectCode] = useState('');
  
  // Wizard States
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Info
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState('Arsitektur');
  const [location, setLocation] = useState('');
  
  // Step 2: Team
  const [projectLeaderId, setProjectLeaderId] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Step 3: Drawings
  const [drawingItems, setDrawingItems] = useState<DrawingItem[]>([]);

  // Step 4: Timeline
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split('T')[0];
  });

  useEffect(()=>{let live=true;const load=async()=>{setLoading(true);try{
    const data=await apiRequest('/api/projects');const existing=data.projects.find((p:any)=>p.id===(resumeId||stableId));
    let qid=quoId||existing?.quotationId;
    if(!qid&&!existing)throw new Error('Pilih penawaran yang disepakati dari Pipeline untuk membuat proyek.');
    if(existing){setProjectName(existing.projectName||'');setProjectCode(existing.projectCode||'');setProjectType(existing.projectType||'Arsitektur');setLocation(existing.location||'');setStartDate(existing.startDate||'');setTargetDate(existing.targetDate||'');setProjectLeaderId(existing.projectLeaderId||'');setSelectedMembers(existing.members||[]);if(existing.clientId){const c=await getDoc(doc(db,'clients',existing.clientId));if(c.exists())setClient({...c.data(),id:c.id} as any);}const drawings=await getDocs(query(collection(db,'drawingItems'),where('projectId','==',existing.id)));setDrawingItems(drawings.docs.map(d=>({...d.data(),id:d.id} as any)));}
    if(qid){const q=await getDoc(doc(db,'quotations',qid));if(!q.exists())throw new Error('Penawaran tidak tersedia.');const quotation={...q.data(),id:q.id} as Quotation;if(quotation.status!=='AGREED')throw new Error('Penawaran belum disepakati.');if(quotation.projectId&&quotation.projectId!==stableId){navigate('/projects/'+quotation.projectId+'/wizard',{replace:true});return;}setQuotation(quotation);if(!existing){setProjectName(quotation.projectName||'');setProjectCode('PRJ-'+new Date().getFullYear()+'-'+stableId.slice(0,8).toUpperCase());}if(quotation.clientId){const c=await getDoc(doc(db,'clients',quotation.clientId));if(c.exists())setClient({...c.data(),id:c.id} as any);}}
    const users=await getPublicUserDirectory();if(live)setAvailableUsers(users);
  }catch(e:any){toast.error(e.message||'Setup tidak dapat dimuat.');}finally{if(live)setLoading(false);}};load();return()=>{live=false;};},[quoId,resumeId,stableId,navigate]);

  const addDrawingItem = () => {
    setDrawingItems([
      ...drawingItems, 
      { id: uuidv4(), drawingNumber: '', drawingName: '', scale: '', picId: '', picName: '', status: 'Belum Mulai', progress: 0, priority: 'Normal', notes: '', revisionCount: 0, projectId: '', groupId: null, deadline: null, isDeleted: false, sortOrder: 0, createdBy: appUser?.uid || '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ]);
  };

  const handleFinish = async()=>{setIsSubmitting(true);try{if(!quotation)throw new Error('Hubungkan penawaran AGREED terlebih dahulu melalui Pipeline.');
const data={projectName,projectCode,projectType,location,startDate,targetDate,projectLeaderId,members:selectedMembers,quotationId:quotation.id,clientId:client?.id||quotation.clientId,clientName:client?.companyName||client?.clientName||'',contractValue:quotation.grandTotal};
const all=await apiRequest('/api/projects');const exists=all.projects.some((p:any)=>p.id===stableId);
await apiRequest('/api/projects/command',{action:exists?'save':'create',id:stableId,requestId:stableId,data,drawings:exists?undefined:drawingItems.filter(i=>i.drawingName)});
await apiRequest('/api/projects/command',{action:'activate',id:stableId,data:{}});sessionStorage.removeItem(storageKey);window.dispatchEvent(new Event('mdrawing-projects-changed'));toast.success('Proyek diaktifkan setelah validasi server.');navigate('/projects/'+stableId);
}catch(e:any){toast.error(e.message||'Aktivasi belum berhasil; draft tetap dapat dilanjutkan.');}finally{setIsSubmitting(false);}};

  if (loading) return <div>Loading...</div>;

  const steps = [
    { title: "Info Proyek", icon: Building },
    { title: "Tim", icon: Users },
    { title: "Drawing Register", icon: FileText },
    { title: "Timeline", icon: Calendar },
    { title: "Final Check", icon: CheckCircle2 }
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="px-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Setup Proyek Operasional</h1>
          <p className="text-[var(--color-text-secondary)] text-sm">Berdasarkan Kesepakatan: {quotation?.quotationNumber}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center justify-between relative mb-8">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 dark:bg-slate-800 -z-10 rounded-full"></div>
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-600 -z-10 rounded-full transition-all duration-300"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        ></div>
        
        {steps.map((step, idx) => (
          <div key={idx} className="flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 bg-[var(--color-surface)] transition-colors ${
              idx === currentStep ? 'border-blue-600 text-blue-600' :
              idx < currentStep ? 'border-blue-600 bg-blue-600 text-white' :
              'border-slate-300 text-slate-400'
            }`}>
              <step.icon className="w-5 h-5" />
            </div>
            <span className={`text-xs font-semibold ${idx === currentStep ? 'text-blue-600' : 'text-slate-500'}`}>
              {step.title}
            </span>
          </div>
        ))}
      </div>

      <Card className="p-6">
        {currentStep === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold border-b pb-2 mb-4">Informasi Proyek</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Proyek</label>
                <Input value={projectName} onChange={e => setProjectName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Kode Proyek</label>
                <Input value={projectCode} onChange={e => setProjectCode(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Klien (Dari Penawaran)</label>
                <Input value={client?.companyName || client?.clientName || ''} disabled readOnly />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Lokasi Proyek</label>
                <Input value={location} onChange={e => setLocation(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold border-b pb-2 mb-4">Tim Proyek</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Project Leader</label>
              <select className="w-full h-10 px-3 border rounded-xl" value={projectLeaderId} onChange={e => setProjectLeaderId(e.target.value)}>
                <option value="">-- Pilih Leader --</option>
                {availableUsers.map(u => <option key={u.uid} value={u.uid}>{u.name}</option>)}
              </select>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2 mb-4">
              <h2 className="text-lg font-bold">Drawing Register (Awal)</h2>
              <Button size="sm" onClick={addDrawingItem} className="gap-2"><Plus className="w-4 h-4"/>Tambah</Button>
            </div>
            {drawingItems.map((item, idx) => (
              <div key={item.id} className="flex gap-2 items-center">
                <Input placeholder="No Gambar" value={item.drawingNumber} onChange={e => {
                  const newItems = [...drawingItems];
                  newItems[idx].drawingNumber = e.target.value;
                  setDrawingItems(newItems);
                }} className="w-1/4" />
                <Input placeholder="Judul Gambar" value={item.drawingName} onChange={e => {
                  const newItems = [...drawingItems];
                  newItems[idx].drawingName = e.target.value;
                  setDrawingItems(newItems);
                }} className="flex-1" />
                <Button variant="ghost" onClick={() => {
                  setDrawingItems(drawingItems.filter((_, i) => i !== idx));
                }}><Trash2 className="w-4 h-4 text-rose-500" /></Button>
              </div>
            ))}
            {drawingItems.length === 0 && <p className="text-sm text-slate-500">Belum ada gambar ditambahkan. Anda dapat menambahkan nanti.</p>}
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold border-b pb-2 mb-4">Timeline Proyek</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tanggal Mulai</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Target Selesai</label>
                <Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold border-b pb-2 mb-4">Final Check</h2>
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4 rounded-xl space-y-2 text-sm">
              <p><strong>Nama Proyek:</strong> {projectName}</p>
              <p><strong>Klien:</strong> {client?.companyName || client?.clientName}</p>
              <p><strong>Nilai Kontrak:</strong> Rp {quotation?.grandTotal?.toLocaleString('id-ID')}</p>
              <p><strong>Jumlah Gambar Awal:</strong> {drawingItems.length}</p>
              <p><strong>Durasi:</strong> {startDate} s/d {targetDate}</p>
            </div>
            <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl flex gap-3 items-start border border-emerald-200">
              <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
              <p className="text-sm font-medium">Proyek siap diaktifkan dan dikerjakan. Baseline komersial akan dikunci ke proyek ini.</p>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-8 pt-4 border-t border-[var(--color-border)]">
          <Button variant="secondary" onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0 || isSubmitting}>
            Kembali
          </Button>
          {currentStep < steps.length - 1 ? (
            <Button onClick={() => setCurrentStep(currentStep + 1)}>
              Lanjut <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleFinish} disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan...' : 'Mulai Kerja'} <CheckCircle2 className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
