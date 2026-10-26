import { apiRequest } from '../lib/commandClient';
import { deleteDoc } from '../lib/quotationWrites';
import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, orderBy, doc} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Quotation, Client } from '../types';
import { Card, Badge, Button, ConfirmModal } from '../components/ui';
import { Plus, FileText, ArrowRight, CheckCircle2, Clock, Trash2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import toast from 'react-hot-toast';

export function PipelineView() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [clients, setClients] = useState<Record<string, Client>>({});
  const [loading, setLoading] = useState(true);
  const [quoToDelete, setQuoToDelete] = useState<Quotation | null>(null);
  const navigate = useNavigate();
  const { canViewFinance, canDeleteQuotation, canCreateQuotation } = usePermissions();

  useEffect(() => {
    // 1. Fetch all clients to map client names
    const qClients = query(collection(db, 'clients'));
    const unsubClients = onSnapshot(
      qClients, 
      (snapshot) => {
        const clientMap: Record<string, Client> = {};
        snapshot.docs.forEach(doc => {
          clientMap[doc.id] = doc.data() as Client;
        });
        setClients(clientMap);
      },
      (err) => {
        console.warn("[PIPELINE] Client subscription note:", err.message);
      }
    );

    // 2. Fetch quotations directly via real-time Firestore listener with fallback
    let live = true;
    const qQuotations = query(collection(db, 'quotations'), orderBy('createdAt', 'desc'));
    const unsubQuotations = onSnapshot(
      qQuotations,
      (snapshot) => {
        if (!live) return;
        const list = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as Quotation))
          .filter(q => !q.isArchived);
        setQuotations(list);
        setLoading(false);
      },
      async (firestoreErr) => {
        console.warn("[PIPELINE] Firestore listener fallback to API:", firestoreErr.message);
        try {
          const r = await apiRequest('/api/quotations');
          if (live) {
            setQuotations(r.quotations || []);
            setLoading(false);
          }
        } catch (apiErr: any) {
          if (live) {
            setQuotations([]);
            setLoading(false);
          }
        }
      }
    );

    return () => {
      live = false;
      unsubClients();
      unsubQuotations();
    };
  }, []);

  const handleDelete = async () => {
    if (!quoToDelete) return;

    // Defense-in-depth: Frontend authorization guard (AUD-08)
    if (!canDeleteQuotation(quoToDelete)) {
      toast.error('Akses ditolak: Anda tidak memiliki izin untuk menghapus penawaran ini.');
      setQuoToDelete(null);
      return;
    }

    try {
      await deleteDoc(doc(db, 'quotations', quoToDelete.id));
      toast.success('Penawaran berhasil dihapus');
      setQuoToDelete(null);
    } catch (e: any) {
      toast.error('Gagal menghapus penawaran: ' + (e.message || e));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AGREED':
      case 'Approved': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'NEGOTIATION': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'DRAFT': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'SENT': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'REJECTED':
      case 'Cancelled': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const hasFinanceCapability = canViewFinance();

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {!hasFinanceCapability && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-3 text-amber-800 dark:text-amber-200 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Akses Terbatas: Akun Anda tidak memiliki kapabilitas keuangan (canViewFinance). Rincian nilai dan harga penawaran disembunyikan untuk menjaga kerahasiaan komersial.</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">Pipeline Penawaran</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Kelola prospek dan negosiasi komersial.</p>
        </div>
        {canCreateQuotation({}) && (
          <Button onClick={() => navigate('/quotations/new')} className="gap-2">
            <Plus className="w-4 h-4" />
            Penawaran Baru
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Stages columns */}
        {[
          { key: 'DRAFT', label: 'Draft', color: 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300' },
          { key: 'SENT', label: 'Terkirim', color: 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300' },
          { key: 'NEGOTIATION', label: 'Negosiasi', color: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' },
          { key: 'AGREED', label: 'Disetujui', color: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' }
        ].map(stage => {
          const stageQuotations = quotations.filter(q => q.status === stage.key || (stage.key === 'DRAFT' && q.status === 'Draft') || (stage.key === 'SENT' && q.status === 'Sent') || (stage.key === 'AGREED' && q.status === 'Approved'));
          return (
            <div key={stage.key} className="bg-[var(--color-surface)]/70 dark:bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 flex flex-col min-h-[520px] shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--color-border)]">
                <span className="font-bold text-xs uppercase tracking-wider text-[var(--color-text-primary)]">{stage.label}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border border-black/5 dark:border-white/10 ${stage.color}`}>
                  {stageQuotations.length}
                </span>
              </div>
              
              <div className="flex-1 space-y-3">
                {stageQuotations.length > 0 ? (
                  stageQuotations.map(quo => (
                    <Card key={quo.id} className="p-3.5 cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 transition-all relative group shadow-xs hover:shadow-sm" onClick={() => navigate(`/quotations/${quo.id}`)}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-sm text-[var(--color-text-primary)]">{quo.quotationNumber}</span>
                        <div className="flex items-center gap-1.5">
                          {/* Only show delete button if authorized (AUD-08) */}
                          {canDeleteQuotation(quo) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuoToDelete(quo);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                              title="Hapus Penawaran"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <Badge className={getStatusColor(quo.status)}>{quo.status}</Badge>
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-[var(--color-text-primary)] mb-1 truncate">
                        {clients[quo.clientId]?.companyName || clients[quo.clientId]?.clientName || 'Unknown Client'}
                      </div>
                      <div className="text-[11px] text-[var(--color-text-secondary)] mb-3 line-clamp-2">
                        {quo.projectName || 'Tanpa Nama Pekerjaan'}
                      </div>
                      <div className="flex justify-between items-center pt-2.5 border-t border-[var(--color-border)]">
                        <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">Total</span>
                        <span className="font-bold text-xs text-[var(--color-text-primary)]">
                          {/* Price masked for users without finance permission (AUD-07) */}
                          {hasFinanceCapability ? `Rp ${quo.grandTotal.toLocaleString('id-ID')}` : 'Rp •••••••'}
                        </span>
                      </div>
                    </Card>
                  ))
                ) : (
                  <div className="h-full min-h-[220px] flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text-tertiary)]">
                    <FileText className="w-7 h-7 opacity-30 mb-2" />
                    <span className="font-medium">Belum ada penawaran</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmModal
        isOpen={!!quoToDelete}
        title="Hapus Penawaran"
        message={`Apakah Anda yakin ingin menghapus penawaran ${quoToDelete?.quotationNumber}? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleDelete}
        onClose={() => setQuoToDelete(null)}
      />
    </div>
  );
}
