import React, { useMemo, useState } from 'react';
import { useDrawings } from '../../context/DrawingContext';
import { Card, Badge, Button } from '../../components/ui';
import { getDeadlineLabel } from '../../lib/businessRules';
import { Calendar, AlertCircle, Mail, Send, BellRing, CheckCircle2, Clock } from 'lucide-react';
import { EmailReminderModal } from '../../components/EmailReminderModal';
import { triggerDeadlineCheck } from '../../lib/emailService';
import { usePermissions } from '../../hooks/usePermissions';
import { DrawingItem } from '../../types';
import toast from 'react-hot-toast';

export function ProjectDeadlineView({ 
  search, 
  projectName = 'Proyek' 
}: { 
  search: string; 
  projectName?: string;
}) {
  const { items } = useDrawings();
  const { canManageProjects } = usePermissions();
  const [selectedItemForEmail, setSelectedItemForEmail] = useState<DrawingItem | null>(null);
  const [checkingDeadline, setCheckingDeadline] = useState(false);

  const groupedByLabel = useMemo(() => {
    const filtered = items.filter(i => 
      i.drawingName.toLowerCase().includes(search.toLowerCase()) || 
      i.drawingNumber.toLowerCase().includes(search.toLowerCase())
    );

    const result = {
      'Overdue': [] as typeof items,
      'Due Soon': [] as typeof items,
      'Aman': [] as typeof items,
      'Hold': [] as typeof items,
    };

    filtered.forEach(item => {
      const label = getDeadlineLabel(item.deadline, item.status) as keyof typeof result;
      if (result[label]) {
        result[label].push(item);
      }
    });

    // Sort items inside by deadline
    Object.keys(result).forEach(key => {
      result[key as keyof typeof result].sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
    });

    return result;
  }, [items, search]);

  const overdueCount = groupedByLabel['Overdue'].length;
  const dueSoonCount = groupedByLabel['Due Soon'].length;

  const handleBatchDeadlineCheck = async () => {
    if (!canManageProjects()) {
      toast.error('Akses terbatas: Memerlukan izin Kelola Proyek.');
      return;
    }

    setCheckingDeadline(true);
    try {
      const res = await triggerDeadlineCheck(items, false);
      if (res.success) {
        if (res.processedCount === 0) {
          toast('Tidak ada gambar dengan email PIC valid yang memenuhi kriteria H-3 atau Overdue.', {
            icon: 'ℹ️'
          });
        } else {
          toast.success(`Berhasil mengirim ${res.processedCount} email pengingat deadline ke PIC!`);
        }
      } else {
        toast.error(res.message || 'Gagal memeriksa notifikasi deadline');
      }
    } catch (err: any) {
      toast.error('Gagal menjalankan notifikasi deadline: ' + err.message);
    } finally {
      setCheckingDeadline(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Batch Notification Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-blue-50/70 via-slate-50 to-amber-50/50 dark:from-blue-950/20 dark:via-zinc-900/40 dark:to-amber-950/20 border border-slate-200/80 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Monitoring Deadline & Notifikasi PIC
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Terdapat <strong className="text-red-600">{overdueCount} terlambat</strong> dan{' '}
              <strong className="text-amber-600">{dueSoonCount} jatuh tempo segera</strong>.
            </p>
          </div>
        </div>

        {canManageProjects() && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleBatchDeadlineCheck}
            disabled={checkingDeadline || (overdueCount === 0 && dueSoonCount === 0)}
            className="gap-2 shrink-0 self-start sm:self-auto"
            title="Kirim email pemberitahuan otomatis untuk semua gambar H-3 dan Overdue yang memiliki PIC"
          >
            <Send className={`w-3.5 h-3.5 ${checkingDeadline ? 'animate-spin' : ''}`} />
            {checkingDeadline ? 'Memproses Email...' : 'Kirim Email Deadline (H-3 & H-0)'}
          </Button>
        )}
      </div>

      {/* Kanban-style 3 Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Overdue */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-red-600 dark:text-red-400 mb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-semibold text-sm">Overdue ({overdueCount})</h3>
            </div>
            <span className="text-xs bg-red-100 dark:bg-red-950/50 px-2 py-0.5 rounded-full font-medium">
              Lewat Batas
            </span>
          </div>
          {overdueCount === 0 ? (
            <div className="p-6 text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1 opacity-70" />
              <p className="text-xs text-slate-500">Tidak ada gambar yang overdue.</p>
            </div>
          ) : (
            groupedByLabel['Overdue'].map(item => (
              <DeadlineCard 
                key={item.id} 
                item={item} 
                onSendEmail={() => setSelectedItemForEmail(item)}
              />
            ))
          )}
        </div>

        {/* Due Soon */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <h3 className="font-semibold text-sm">Jatuh Tempo Dekat ({dueSoonCount})</h3>
            </div>
            <span className="text-xs bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 rounded-full font-medium">
              H-3 s.d Hari-H
            </span>
          </div>
          {dueSoonCount === 0 ? (
            <div className="p-6 text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1 opacity-70" />
              <p className="text-xs text-slate-500">Tidak ada gambar yang jatuh tempo dalam 3 hari.</p>
            </div>
          ) : (
            groupedByLabel['Due Soon'].map(item => (
              <DeadlineCard 
                key={item.id} 
                item={item} 
                onSendEmail={() => setSelectedItemForEmail(item)}
              />
            ))
          )}
        </div>

        {/* Aman */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              <h3 className="font-semibold text-sm">Aman ({groupedByLabel['Aman'].length})</h3>
            </div>
            <span className="text-xs bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full font-medium">
              &gt; 3 Hari
            </span>
          </div>
          {groupedByLabel['Aman'].length === 0 ? (
            <div className="p-6 text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
              <p className="text-xs text-slate-500">Tidak ada gambar berstatus aman.</p>
            </div>
          ) : (
            groupedByLabel['Aman'].map(item => (
              <DeadlineCard 
                key={item.id} 
                item={item} 
                onSendEmail={() => setSelectedItemForEmail(item)}
              />
            ))
          )}
        </div>
      </div>

      {/* Manual Reminder Email Modal */}
      {selectedItemForEmail && (
        <EmailReminderModal
          isOpen={Boolean(selectedItemForEmail)}
          onClose={() => setSelectedItemForEmail(null)}
          item={selectedItemForEmail}
          projectName={projectName}
        />
      )}
    </div>
  );
}

function DeadlineCard({ 
  item, 
  onSendEmail 
}: { 
  item: DrawingItem; 
  onSendEmail: () => void; 
}) {
  const isOverdue = item.deadline && new Date(item.deadline).getTime() < new Date().setHours(0, 0, 0, 0);

  return (
    <Card 
      className="p-4 border-l-4 transition-all hover:shadow-md group" 
      style={{ 
        borderLeftColor: item.status === 'Hold' 
          ? 'var(--color-border)' 
          : isOverdue 
          ? 'var(--color-accent-red)' 
          : 'var(--color-accent-blue)' 
      }}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded">
          {item.drawingNumber}
        </span>
        <Badge variant={item.status === 'Revisi' ? 'danger' : item.status === 'Selesai' ? 'success' : 'default'}>
          {item.status}
        </Badge>
      </div>

      <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">
        {item.drawingName}
      </h4>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-zinc-800">
        <div>
          <span>PIC: </span>
          <strong className="text-slate-700 dark:text-slate-200">{item.picName || '-'}</strong>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {item.deadline ? new Date(item.deadline).toLocaleDateString('id-ID') : 'Tanpa Deadline'}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSendEmail();
            }}
            title={item.picName ? `Kirim email pengingat ke ${item.picName}` : 'Kirim email pengingat'}
            className="p-1 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}
