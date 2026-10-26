import { apiRequest } from '../lib/commandClient';
import React, { useEffect, useState, useMemo } from 'react';
import { useProjects } from '../context/ProjectContext';
import { Card, Button, Badge } from '../components/ui';
import { Building2, FolderKanban, TrendingUp, Users, Plus, FileText, ArrowRight } from 'lucide-react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DrawingItem, Quotation, Client } from '../types';
import { calculateProjectProgress } from '../engine/projectProgressEngine';
import { useNavigate } from 'react-router-dom';

export function DashboardView() {
  const { projects, loadingProjects } = useProjects();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [clients, setClients] = useState<Record<string, Client>>({});
  const [loadingQuos, setLoadingQuos] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const qClients = query(collection(db, 'clients'));
    const unsubClients = onSnapshot(qClients, (snapshot) => {
      const clientMap: Record<string, Client> = {};
      snapshot.docs.forEach(doc => {
        clientMap[doc.id] = doc.data() as Client;
      });
      setClients(clientMap);
    }, (error) => {
      console.warn("Akses klien dibatasi untuk peran ini:", error.message);
    });

    const qQuos = query(collection(db, 'quotations'));
    const unsubQuos = onSnapshot(qQuos, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quotation));
      setQuotations(docs.filter(q => !q.isArchived));
      setLoadingQuos(false);
    }, async (error) => {
      console.warn("Client Firestore quotations limited, falling back to API:", error.message);
      try {
        const res = await apiRequest('/api/quotations');
        setQuotations((res.quotations || []).filter((q: Quotation) => !q.isArchived));
      } catch {
        setQuotations([]);
      } finally {
        setLoadingQuos(false);
      }
    });

    return () => {
      unsubClients();
      unsubQuos();
    };
  }, []);

  const stats = useMemo(() => {
    const activeProjects = projects.filter(p => p.status === 'Berjalan' || p.status === 'ACTIVE' || p.status === 'SETUP' || p.status === 'READY');
    
    const draftQuos = quotations.filter(q => q.status === 'DRAFT' || q.status === 'Draft');
    const negoQuos = quotations.filter(q => q.status === 'NEGOTIATION');
    const agreedQuos = quotations.filter(q => q.status === 'AGREED' || q.status === 'Approved');

    return {
      activeProjects,
      draftQuos,
      negoQuos,
      agreedQuos,
      totalClients: Object.keys(clients).length
    };
  }, [projects, quotations, clients]);

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">Command Center</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Ringkasan aktivitas komersial dan operasional Anda.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate('/clients')} className="gap-2">
            <Users className="w-4 h-4" />
            + Klien
          </Button>
          <Button onClick={() => navigate('/quotations/new')} className="gap-2">
            <FileText className="w-4 h-4" />
            + Penawaran
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* COMMERCIAL PIPELINE */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">PIPELINE KOMERSIAL</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/pipeline')} className="text-blue-600 gap-1 px-2">
              Lihat Semua <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <Card
              className="p-4 bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/10 cursor-pointer hover:border-slate-400 transition-all shadow-xs hover:shadow-sm"
              onClick={() => navigate('/pipeline')}
              title="Buka Pipeline Penawaran (Draft)"
            >
              <div className="text-3xl font-extrabold text-slate-800 dark:text-white">{stats.draftQuos.length}</div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">Draft</div>
            </Card>
            <Card
              className="p-4 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 cursor-pointer hover:border-amber-400 transition-all shadow-xs hover:shadow-sm"
              onClick={() => navigate('/pipeline')}
              title="Buka Pipeline Penawaran (Negosiasi)"
            >
              <div className="text-3xl font-extrabold text-amber-900 dark:text-amber-300">{stats.negoQuos.length}</div>
              <div className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mt-1">Negosiasi</div>
            </Card>
            <Card
              className="p-4 bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 cursor-pointer hover:border-emerald-400 transition-all shadow-xs hover:shadow-sm"
              onClick={() => navigate('/pipeline')}
              title="Buka Pipeline Penawaran (Disepakati)"
            >
              <div className="text-3xl font-extrabold text-emerald-900 dark:text-emerald-300">{stats.agreedQuos.length}</div>
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mt-1">Disepakati</div>
            </Card>
          </div>

          <div className="space-y-3 mt-4">
            {quotations.filter(q => q.status !== 'REJECTED' && q.status !== 'Cancelled').slice(0, 5).map(quo => (
              <Card key={quo.id} className="p-3.5 flex items-center justify-between cursor-pointer hover:border-[var(--color-accent-blue)] transition-colors bg-white dark:bg-[#0A0A0A]" onClick={() => navigate(`/quotations/${quo.id}`)}>
                <div>
                  <div className="font-semibold text-sm text-[var(--color-text-primary)]">{quo.projectName || 'Tanpa Nama Pekerjaan'}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">{clients[quo.clientId]?.companyName || 'Unknown Client'}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm text-[var(--color-text-primary)]">Rp {quo.grandTotal.toLocaleString('id-ID')}</div>
                  <Badge variant="outline" className="text-[11px] mt-1">{quo.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* ACTIVE PROJECTS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">PROYEK BERJALAN</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="text-indigo-600 gap-1 px-2 font-semibold">
              Lihat Semua <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card
              className="p-4 bg-indigo-50/80 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 cursor-pointer hover:border-indigo-400 transition-all shadow-xs hover:shadow-sm"
              onClick={() => navigate('/projects')}
              title="Lihat Semua Proyek Aktif"
            >
              <div className="text-3xl font-extrabold text-indigo-900 dark:text-indigo-300">{stats.activeProjects.length}</div>
              <div className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mt-1">Proyek Aktif</div>
            </Card>
            <Card
              className="p-4 bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 cursor-pointer hover:border-blue-400 transition-all shadow-xs hover:shadow-sm"
              onClick={() => navigate('/clients')}
              title="Lihat Daftar Klien"
            >
              <div className="text-3xl font-extrabold text-blue-900 dark:text-blue-300">{stats.totalClients}</div>
              <div className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mt-1">Total Klien</div>
            </Card>
          </div>

          <div className="space-y-3 mt-4">
            {stats.activeProjects.slice(0, 5).map(proj => (
              <Card key={proj.id} className="p-3.5 flex items-center justify-between cursor-pointer hover:border-[var(--color-accent-blue)] transition-colors bg-white dark:bg-[#0A0A0A]" onClick={() => navigate(`/projects/${proj.id}`)}>
                <div>
                  <div className="font-semibold text-sm text-[var(--color-text-primary)]">{proj.projectName}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">{proj.clientName}</div>
                </div>
                <Badge variant="info">{proj.status}</Badge>
              </Card>
            ))}
            {stats.activeProjects.length === 0 && (
              <div className="text-center py-8 text-sm text-[var(--color-text-secondary)] border-2 border-dashed border-[var(--color-border)] rounded-xl">
                Belum ada proyek yang sedang berjalan.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
