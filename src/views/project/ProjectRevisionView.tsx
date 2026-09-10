import React, { useMemo, useState } from 'react';
import { useDrawings } from '../../context/DrawingContext';
import { Card, Button, Modal, SegmentedControl } from '../../components/ui';
import { 
  Clock, History, ShieldCheck, Grid, List, AlertTriangle, 
  CheckCircle2, FileText, User, Calendar, Flame, Eye 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { DrawingItem, DrawingRevision } from '../../types';

interface ProjectRevisionViewProps {
  search: string;
}

export function ProjectRevisionView({ search }: ProjectRevisionViewProps) {
  const { items, revisions, groups } = useDrawings();
  const [subView, setSubView] = useState<'matrix' | 'log'>('matrix');
  const [selectedRevisionModal, setSelectedRevisionModal] = useState<{
    revision: DrawingRevision;
    item: DrawingItem;
    revLabel: string;
  } | null>(null);

  const activeItems = useMemo(() => {
    return items.filter(i => !i.isDeleted);
  }, [items]);

  // Filtered items based on search
  const filteredItems = useMemo(() => {
    if (!search.trim()) return activeItems;
    const q = search.toLowerCase();
    return activeItems.filter(item => 
      item.drawingName.toLowerCase().includes(q) || 
      item.drawingNumber.toLowerCase().includes(q) ||
      item.notes.toLowerCase().includes(q)
    );
  }, [activeItems, search]);

  // Revisions per item mapped by itemId, sorted ascending by createdAt
  const itemRevisionsMap = useMemo(() => {
    const map = new Map<string, DrawingRevision[]>();
    revisions.forEach(rev => {
      const list = map.get(rev.itemId) || [];
      list.push(rev);
      map.set(rev.itemId, list);
    });
    // Sort each item's revisions chronologically ascending
    map.forEach((list) => {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });
    return map;
  }, [revisions]);

  // Maximum revision count across all items to determine dynamic columns
  const maxRevisionLevel = useMemo(() => {
    let max = 1;
    activeItems.forEach(item => {
      const count = item.revisionCount || 0;
      if (count > max) max = count;
    });
    return Math.max(max, 3); // At least show up to Rev 3 for a clear matrix layout
  }, [activeItems]);

  // Column definitions for dynamic revision steps (Rev 1, Rev 2, ...)
  const revisionColumns = useMemo(() => {
    const cols = [];
    for (let i = 1; i <= maxRevisionLevel; i++) {
      cols.push({
        label: `Rev ${i}`,
        index: i,
      });
    }
    return cols;
  }, [maxRevisionLevel]);

  // Summary statistics
  const stats = useMemo(() => {
    const totalRevisions = revisions.length;
    const revisedItems = activeItems.filter(i => (i.revisionCount || 0) > 0);
    const unrevisedItems = activeItems.filter(i => (i.revisionCount || 0) === 0);
    
    let mostRevisedItem: DrawingItem | null = null;
    activeItems.forEach(item => {
      if (!mostRevisedItem || (item.revisionCount || 0) > (mostRevisedItem.revisionCount || 0)) {
        if ((item.revisionCount || 0) > 0) {
          mostRevisedItem = item;
        }
      }
    });

    const percentRevised = activeItems.length > 0 
      ? Math.round((revisedItems.length / activeItems.length) * 100) 
      : 0;

    return {
      totalRevisions,
      revisedCount: revisedItems.length,
      unrevisedCount: unrevisedItems.length,
      percentRevised,
      mostRevisedItem,
    };
  }, [activeItems, revisions]);

  // Filtered log revisions
  const filteredRevisions = useMemo(() => {
    return revisions.filter(rev => {
      const item = items.find(i => i.id === rev.itemId);
      if (!item) return false;
      return item.drawingName.toLowerCase().includes(search.toLowerCase()) || 
             item.drawingNumber.toLowerCase().includes(search.toLowerCase()) ||
             rev.notes.toLowerCase().includes(search.toLowerCase());
    });
  }, [revisions, items, search]);

  const getGroupName = (groupId: string | null) => {
    if (!groupId) return "Umum";
    const g = groups.find(x => x.id === groupId);
    return g ? g.groupName : "Umum";
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-Tab Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)] flex items-center gap-2">
            <History className="w-5 h-5 text-[var(--color-accent-orange)]" />
            Audit & Riwayat Revisi Gambar
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Pelacakan siklus hidup revisi gambar kerja dan matriks komparasi status berkas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <SegmentedControl
            options={[
              { label: 'Matriks Revisi', value: 'matrix' },
              { label: 'Daftar Log (Arsip)', value: 'log' },
            ]}
            value={subView}
            onChange={(v) => setSubView(v as 'matrix' | 'log')}
          />
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-black/[0.02] to-black/[0.05] dark:from-white/[0.02] dark:to-white/[0.05]">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] font-medium mb-1">
            <span>Total Revisi Proyek</span>
            <History className="w-4 h-4 text-[var(--color-accent-orange)]" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            {stats.totalRevisions}
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
            Perubahan tercatat di database audit
          </p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-black/[0.02] to-black/[0.05] dark:from-white/[0.02] dark:to-white/[0.05]">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] font-medium mb-1">
            <span>Pernah Direvisi</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            {stats.revisedCount} <span className="text-xs font-normal text-[var(--color-text-secondary)]">({stats.percentRevised}%)</span>
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
            Dari total {activeItems.length} gambar kerja aktif
          </p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-black/[0.02] to-black/[0.05] dark:from-white/[0.02] dark:to-white/[0.05]">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] font-medium mb-1">
            <span>Stabil (Rev 0)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            {stats.unrevisedCount}
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
            Gambar tanpa riwayat perubahan desain
          </p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-black/[0.02] to-black/[0.05] dark:from-white/[0.02] dark:to-white/[0.05]">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] font-medium mb-1">
            <span>Paling Sering Direvisi</span>
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          {stats.mostRevisedItem ? (
            <div>
              <div className="text-base font-bold tracking-tight text-rose-600 dark:text-rose-400 truncate">
                {stats.mostRevisedItem.drawingNumber}
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                {stats.mostRevisedItem.revisionCount}x Revisi &middot; {stats.mostRevisedItem.drawingName}
              </p>
            </div>
          ) : (
            <div>
              <div className="text-sm font-semibold text-[var(--color-text-secondary)]">-</div>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">Belum ada item direvisi</p>
            </div>
          )}
        </Card>
      </div>

      {/* VIEW MODE 1: MATRIKS REVISI */}
      {subView === 'matrix' && (
        <Card className="overflow-hidden border border-[var(--color-border)] shadow-sm">
          <div className="p-4 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-black/[0.01] dark:bg-white/[0.01]">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <Grid className="w-4 h-4 text-[var(--color-accent-blue)]" />
                Matriks Perjalanan Revisi Per Berkas
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Klik pada kotak tanggal revisi untuk membaca rincian catatan revisi dan pelaku pembaruan.
              </p>
            </div>
            <div className="text-xs text-[var(--color-text-secondary)]">
              Menampilkan <span className="font-semibold text-[var(--color-text-primary)]">{filteredItems.length}</span> berkas
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-black/5 dark:bg-white/5 font-semibold text-[var(--color-text-secondary)]">
                  <th className="p-3 w-10 text-center">No</th>
                  <th className="p-3 min-w-[140px]">Nomor Gambar</th>
                  <th className="p-3 min-w-[200px]">Judul Gambar Kerja</th>
                  <th className="p-3 min-w-[120px]">Kategori</th>
                  
                  {/* Base Release Rev 0 */}
                  <th className="p-3 text-center min-w-[100px] bg-black/[0.02] dark:bg-white/[0.02]">
                    <div className="font-bold text-[var(--color-text-primary)]">Rev 0</div>
                    <div className="text-[11px] font-normal text-[var(--color-text-secondary)]">Penerbitan Awal</div>
                  </th>

                  {/* Dynamic Revision Columns */}
                  {revisionColumns.map(col => (
                    <th key={col.label} className="p-3 text-center min-w-[105px]">
                      <div className="font-bold text-[var(--color-text-primary)]">{col.label}</div>
                      <div className="text-[11px] font-normal text-[var(--color-text-secondary)]">Tahap {col.index}</div>
                    </th>
                  ))}

                  <th className="p-3 text-center min-w-[110px]">Status Terkini</th>
                  <th className="p-3 text-center min-w-[90px]">Total Revisi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6 + revisionColumns.length} className="p-8 text-center text-xs text-[var(--color-text-secondary)]">
                      Tidak ada data gambar kerja yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => {
                    const itemRevs = itemRevisionsMap.get(item.id) || [];
                    const revCount = item.revisionCount || 0;

                    return (
                      <tr key={item.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="p-3 text-center text-[var(--color-text-secondary)] font-mono">{idx + 1}</td>
                        <td className="p-3 font-mono font-semibold text-[var(--color-text-primary)]">
                          {item.drawingNumber}
                        </td>
                        <td className="p-3 text-[var(--color-text-primary)] font-medium">
                          {item.drawingName}
                        </td>
                        <td className="p-3 text-[var(--color-text-secondary)]">
                          <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-xs font-medium">
                            {getGroupName(item.groupId)}
                          </span>
                        </td>

                        {/* Rev 0 Cell (Baseline) */}
                        <td className="p-3 text-center bg-black/[0.02] dark:bg-white/[0.02]">
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Baseline
                            </span>
                            <span className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 font-mono">
                              {new Date(item.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                            </span>
                          </div>
                        </td>

                        {/* Dynamic Revision Step Cells */}
                        {revisionColumns.map((col, colIdx) => {
                          const revAtStep = itemRevs[colIdx];
                          if (revAtStep) {
                            return (
                              <td key={col.label} className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedRevisionModal({
                                    revision: revAtStep,
                                    item,
                                    revLabel: col.label,
                                  })}
                                  className="inline-flex flex-col items-center p-1 px-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 transition-all cursor-pointer group"
                                  title="Klik untuk melihat rincian catatan revisi ini"
                                >
                                  <span className="font-semibold text-xs group-hover:underline">
                                    {col.label}
                                  </span>
                                  <span className="text-[11px] text-[var(--color-text-secondary)] font-mono">
                                    {new Date(revAtStep.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                  </span>
                                </button>
                              </td>
                            );
                          }

                          return (
                            <td key={col.label} className="p-3 text-center text-[var(--color-text-secondary)] opacity-40">
                              &mdash;
                            </td>
                          );
                        })}

                        {/* Current Status */}
                        <td className="p-3 text-center">
                          <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-medium bg-black/5 dark:bg-white/5 text-[var(--color-text-primary)]">
                            {item.status}
                          </span>
                        </td>

                        {/* Total Revision Badge */}
                        <td className="p-3 text-center">
                          <span className={`inline-block font-mono text-xs font-bold px-2 py-0.5 rounded-full ${
                            revCount === 0 
                              ? 'bg-black/5 text-[var(--color-text-secondary)]' 
                              : revCount < 3 
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' 
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}>
                            {revCount}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* VIEW MODE 2: LOG RIWAYAT REVISI (ARSIP AUDIT LENGKAP) */}
      {subView === 'log' && (
        <div className="space-y-4 w-full">
          <div className="flex justify-between items-center px-1">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <List className="w-4 h-4 text-[var(--color-accent-blue)]" />
                Log Kronologis Riwayat Revisi
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Arsip catatan audit per item gambar yang tidak dapat diubah (immutable record).
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-accent-green)]" />
              <span>Audit Log Terproteksi</span>
            </div>
          </div>

          {filteredRevisions.length === 0 ? (
            <Card className="p-8 text-center border-dashed border-2">
              <p className="text-xs text-[var(--color-text-secondary)]">Tidak ada log revisi yang tercatat.</p>
            </Card>
          ) : (
            filteredRevisions.map(rev => {
              const item = items.find(i => i.id === rev.itemId);
              if (!item) return null;

              return (
                <Card key={rev.id} className="p-4 flex gap-4 transition-all hover:shadow-sm">
                  <div className="shrink-0 mt-1">
                    <div className="w-10 h-10 bg-[var(--color-accent-orange)]/10 text-[var(--color-accent-orange)] rounded-xl flex items-center justify-center">
                      <History className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{item.drawingName}</h4>
                        <p className="text-xs text-[var(--color-text-secondary)] font-mono">{item.drawingNumber}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(rev.createdAt), { addSuffix: true, locale: id })}
                      </div>
                    </div>
                    <div className="text-xs text-[var(--color-text-primary)] mt-2.5 p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-[var(--color-border)] leading-relaxed">
                      {rev.notes}
                    </div>
                    <div className="mt-2 text-xs text-[var(--color-text-secondary)] flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-[var(--color-text-secondary)]" />
                        Oleh: <span className="font-medium text-[var(--color-text-primary)]">{rev.createdByName}</span>
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3 text-[var(--color-text-secondary)]" />
                        {new Date(rev.createdAt).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Modal Detail Catatan Revisi dari Matriks */}
      {selectedRevisionModal && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedRevisionModal(null)}
          title={`Detail Catatan ${selectedRevisionModal.revLabel}`}
        >
          <div className="space-y-4">
            <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-[var(--color-border)]">
              <div className="text-xs text-[var(--color-text-secondary)]">Berkas Gambar</div>
              <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                {selectedRevisionModal.item.drawingName}
              </div>
              <div className="text-xs font-mono text-[var(--color-accent-blue)]">
                {selectedRevisionModal.item.drawingNumber}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">
                Uraian Perubahan Desain / Revisi
              </label>
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-sans">
                {selectedRevisionModal.revision.notes}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg border border-[var(--color-border)] bg-black/[0.02] dark:bg-white/[0.02]">
                <span className="text-[var(--color-text-secondary)] block">Diinput Oleh</span>
                <span className="font-semibold text-[var(--color-text-primary)] mt-0.5 block">
                  {selectedRevisionModal.revision.createdByName}
                </span>
              </div>
              <div className="p-2.5 rounded-lg border border-[var(--color-border)] bg-black/[0.02] dark:bg-white/[0.02]">
                <span className="text-[var(--color-text-secondary)] block">Waktu Pencatatan</span>
                <span className="font-semibold text-[var(--color-text-primary)] mt-0.5 block font-mono">
                  {new Date(selectedRevisionModal.revision.createdAt).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedRevisionModal(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
