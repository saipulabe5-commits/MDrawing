import { collection,getDocs,query,where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { dueNotifications } from '../engine/notificationEngine';
import { hasCapability } from '../security/authorization';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Badge } from '../components/ui';
import { 
  Bell, 
  Clock, 
  AlertTriangle, 
  FileText, 
  DollarSign, 
  Building2, 
  CheckCircle2, 
  ArrowRight,
  Filter,
  Check
} from 'lucide-react';

interface ActionNotification {
  id: string;
  type: 'DRAWING_OVERDUE' | 'INVOICE_UNPAID' | 'VENDOR_BILL_DUE' | 'STAGE_SETUP';
  title: string;
  description: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  severity: 'high' | 'medium' | 'info';
  actionUrl: string;
  actionLabel: string;
  date: string;
}

export function NotificationsView() {
  const { projects } = useProjects();
  const { appUser } = useAuth();
  const [filter, setFilter] = useState<'all' | 'action_required' | 'info'>('all');
  const [clearedIds, setClearedIds] = useState<string[]>([]);

  const [notifications,setNotifications]=useState<ActionNotification[]>([]);
  useEffect(()=>{let live=true;setNotifications([]);setClearedIds([]);if(!appUser)return;try{setClearedIds(JSON.parse(localStorage.getItem('mdrawing-notifications-'+appUser.uid)||'[]'));}catch{}
  const load=async()=>{const list:any[]=[];for(const p of projects){const drawing=await getDocs(query(collection(db,'drawingItems'),where('projectId','==',p.id)));let invoices:any[]=[],bills:any[]=[];if(hasCapability(appUser,'canViewFinance')){const [i,b]=await Promise.all([getDocs(query(collection(db,'invoices'),where('projectId','==',p.id))),getDocs(query(collection(db,'vendorBills'),where('projectId','==',p.id)))]);invoices=i.docs.map(d=>({...d.data(),id:d.id}));bills=b.docs.map(d=>({...d.data(),id:d.id}));}list.push(...dueNotifications(p,drawing.docs.map(d=>({...d.data(),id:d.id})),invoices,bills,hasCapability(appUser,'canViewFinance')));}if(live)setNotifications(list);};load().catch(e=>console.error('Notifications unavailable',e));const t=setInterval(()=>load().catch(console.error),60000);return()=>{live=false;clearInterval(t);};},[projects,appUser]);
  const visibleNotifications = notifications
    .filter((n) => !clearedIds.includes(n.id))
    .filter((n) => {
      if (filter === 'action_required') return n.severity === 'high' || n.severity === 'medium';
      if (filter === 'info') return n.severity === 'info';
      return true;
    });

  const handleMarkAsDone = (id:string)=>{setClearedIds(prev=>{const next=[...new Set([...prev,id])];if(appUser)localStorage.setItem('mdrawing-notifications-'+appUser.uid,JSON.stringify(next));return next;});};

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--color-surface)] p-5 rounded-2xl border border-[var(--color-border)] shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Pusat Notifikasi & Tindakan</h1>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Daftar aksi penting dan pengingat jatuh tempo proyek yang membutuhkan perhatian Anda.
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-[var(--color-bg-secondary)] dark:bg-white/10 rounded-xl border border-[var(--color-border)]">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'all'
                ? 'bg-white dark:bg-white/20 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Semua ({notifications.length - clearedIds.length})
          </button>
          <button
            onClick={() => setFilter('action_required')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'action_required'
                ? 'bg-white dark:bg-white/20 text-amber-700 dark:text-amber-400 border border-slate-200 dark:border-white/10 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Perlu Tindakan
          </button>
          <button
            onClick={() => setFilter('info')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'info'
                ? 'bg-white dark:bg-white/20 text-blue-700 dark:text-blue-400 border border-slate-200 dark:border-white/10 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Informasi
          </button>
        </div>
      </div>

      {/* Notifications List */}
      {visibleNotifications.length === 0 ? (
        <div className="text-center py-16 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-8">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[var(--color-text-primary)]">Semua Tugas Sudah Selesai</h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-sm mx-auto">
            Tidak ada notifikasi atau tindakan tertunda yang membutuhkan perhatian mendesak saat ini.
          </p>
          <Link to="/projects">
            <Button size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              Lihat Daftar Proyek
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleNotifications.map((item) => (
            <div
              key={item.id}
              className={`p-4.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                item.severity === 'high'
                  ? 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/30'
                  : item.severity === 'medium'
                  ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)]'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    item.severity === 'high'
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      : item.severity === 'medium'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {item.type === 'DRAWING_OVERDUE' ? (
                    <Clock className="w-5 h-5" />
                  ) : item.type === 'INVOICE_UNPAID' ? (
                    <DollarSign className="w-5 h-5" />
                  ) : item.type === 'VENDOR_BILL_DUE' ? (
                    <Building2 className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-[var(--color-border)]">
                      {item.projectCode}
                    </span>
                    <span className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                      {item.projectName}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      &bull; {item.date}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-[var(--color-text-primary)]">{item.title}</h4>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{item.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  onClick={() => handleMarkAsDone(item.id)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Tandai Selesai"
                >
                  <Check className="w-4 h-4" />
                </button>
                <Link to={item.actionUrl}>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 shadow-xs">
                    <span>{item.actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
