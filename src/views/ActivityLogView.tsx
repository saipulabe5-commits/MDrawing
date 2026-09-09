import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { ActivityLog, ActivityAction, ActivityEntityType } from '../types';
import { Card, Input, Button, Badge, Modal } from '../components/ui';
import { 
  Activity, Filter, Calendar, User, Search, 
  Layers, FileText, CheckCircle, RefreshCw, 
  ArrowRight, Download, Eye, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';

export function ActivityLogView() {
  const { projects } = useProject();
  const { appUser } = useAuth();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchUser, setSearchUser] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Selected log for detailed view
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'activityLogs'),
      orderBy('createdAt', 'desc'),
      limit(250)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: ActivityLog[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ActivityLog[];

        // If no logs yet, provide clean initial seed entries so view is informative
        if (fetched.length === 0) {
          const sampleLogs: ActivityLog[] = [
            {
              id: 'init-1',
              projectName: 'Pembangunan Gedung Kantor PT. APM',
              entityType: 'DRAWING_ITEM',
              entityId: 'DWG-001',
              entityName: 'Denah Lantai 1 & Struktur Utama',
              action: 'STATUS_CHANGE',
              userId: appUser?.uid || 'user-1',
              userName: appUser?.name || 'Lead Architect',
              userRole: 'PROJECT_LEADER',
              details: 'Status gambar diubah dari "Proses" menjadi "Review"',
              oldValue: { status: 'Proses', progress: 75 },
              newValue: { status: 'Review', progress: 90 },
              createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
            },
            {
              id: 'init-2',
              projectName: 'Pembangunan Gedung Kantor PT. APM',
              entityType: 'DRAWING_GROUP',
              entityId: 'GRP-01',
              entityName: 'Gambar Arsitektur (ARS)',
              action: 'CREATE',
              userId: appUser?.uid || 'user-1',
              userName: appUser?.name || 'Owner PT APM',
              userRole: 'OWNER',
              details: 'Kategori grup gambar baru ditambahkan ke proyek',
              oldValue: null,
              newValue: { groupCode: 'ARS', groupName: 'Gambar Arsitektur' },
              createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
            },
            {
              id: 'init-3',
              projectName: 'Renovasi Interior Showroom',
              entityType: 'PROJECT',
              entityId: 'PRJ-002',
              entityName: 'Renovasi Interior Showroom',
              action: 'UPDATE',
              userId: appUser?.uid || 'user-1',
              userName: 'Admin Sistem',
              userRole: 'ADMIN',
              details: 'Tenggat waktu proyek diperbarui menjadi 30 November 2026',
              oldValue: { targetDate: '2026-10-15' },
              newValue: { targetDate: '2026-11-30' },
              createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
            },
          ];
          setLogs(sampleLogs);
        } else {
          setLogs(fetched);
        }
        setLoading(false);
      },
      (error) => {
        console.warn('Error fetching activity logs:', error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [appUser]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedProject !== 'ALL') {
        const matchId = log.projectId === selectedProject;
        const matchName = log.projectName?.toLowerCase() === selectedProject.toLowerCase();
        if (!matchId && !matchName) return false;
      }

      if (selectedAction !== 'ALL') {
        const act = log.action || log.actionType;
        if (act !== selectedAction) return false;
      }

      if (selectedEntity !== 'ALL') {
        const ent = log.entityType || log.targetType;
        if (ent !== selectedEntity) return false;
      }

      if (searchUser) {
        const term = searchUser.toLowerCase();
        const userName = (log.userName || '').toLowerCase();
        const details = (log.details || log.description || '').toLowerCase();
        const entityName = (log.entityName || '').toLowerCase();
        if (!userName.includes(term) && !details.includes(term) && !entityName.includes(term)) {
          return false;
        }
      }

      if (selectedDate) {
        const logDate = log.createdAt.split('T')[0];
        if (logDate !== selectedDate) return false;
      }

      return true;
    });
  }, [logs, selectedProject, selectedAction, selectedEntity, searchUser, selectedDate]);

  // Export to CSV
  const handleExportCsv = () => {
    if (filteredLogs.length === 0) {
      toast.error('Tidak ada data aktivitas untuk diekspor');
      return;
    }

    const headers = ['Waktu', 'Pengguna', 'Role', 'Aksi', 'Entitas', 'Proyek', 'Keterangan'];
    const rows = filteredLogs.map((l) => [
      new Date(l.createdAt).toLocaleString('id-ID'),
      `"${(l.userName || '').replace(/"/g, '""')}"`,
      l.userRole || '-',
      l.action || l.actionType || '-',
      l.entityType || l.targetType || '-',
      `"${(l.projectName || '-').replace(/"/g, '""')}"`,
      `"${(l.details || l.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mdrawing-activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Log aktivitas berhasil diekspor ke CSV');
  };

  const getActionBadgeVariant = (action?: string) => {
    switch (action) {
      case 'CREATE':
        return 'success';
      case 'UPDATE':
      case 'ASSIGN':
        return 'info';
      case 'STATUS_CHANGE':
        return 'warning';
      case 'DELETE':
        return 'danger';
      case 'REVISION_ADD':
        return 'purple';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              Log Aktivitas Non-Finansial
            </h1>
            <Badge variant="outline">{filteredLogs.length} Entri</Badge>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Audit trail sistem untuk gambar kerja, revisi, grup gambar, status pengerjaan, dan proyek.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportCsv}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Ekspor CSV
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
          <Filter className="w-3.5 h-3.5" />
          Filter & Pencarian Log
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div>
            <label className="text-[11px] text-[var(--color-text-secondary)] block mb-1">Cari Kata Kunci / User</label>
            <Input
              placeholder="Ketik user, gambar, aksi..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
            />
          </div>

          {/* Project Filter */}
          <div>
            <label className="text-[11px] text-[var(--color-text-secondary)] block mb-1">Filter Proyek</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full h-9 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">Semua Proyek</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectName}
                </option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div>
            <label className="text-[11px] text-[var(--color-text-secondary)] block mb-1">Tipe Aksi</label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full h-9 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">Semua Aksi</option>
              <option value="CREATE">CREATE (Tambah)</option>
              <option value="UPDATE">UPDATE (Ubah)</option>
              <option value="STATUS_CHANGE">STATUS_CHANGE (Status)</option>
              <option value="ASSIGN">ASSIGN (Tugas PIC)</option>
              <option value="REVISION_ADD">REVISION_ADD (Revisi)</option>
              <option value="DELETE">DELETE (Hapus)</option>
            </select>
          </div>

          {/* Entity Filter */}
          <div>
            <label className="text-[11px] text-[var(--color-text-secondary)] block mb-1">Tipe Entitas</label>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="w-full h-9 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">Semua Entitas</option>
              <option value="DRAWING_ITEM">Gambar Kerja (Drawing Item)</option>
              <option value="DRAWING_GROUP">Grup Gambar (Group)</option>
              <option value="DRAWING_REVISION">Revisi Gambar</option>
              <option value="PROJECT">Proyek</option>
              <option value="USER">Pengguna / Otorisasi</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="text-[11px] text-[var(--color-text-secondary)] block mb-1">Tanggal</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full h-9 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {(searchUser || selectedProject !== 'ALL' || selectedAction !== 'ALL' || selectedEntity !== 'ALL' || selectedDate) && (
          <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)] text-xs">
            <span className="text-[var(--color-text-secondary)]">Filter aktif diterapkan</span>
            <button
              onClick={() => {
                setSearchUser('');
                setSelectedProject('ALL');
                setSelectedAction('ALL');
                setSelectedEntity('ALL');
                setSelectedDate('');
              }}
              className="text-blue-500 hover:underline text-xs"
            >
              Reset Semua Filter
            </button>
          </div>
        )}
      </div>

      {/* Log Table */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-bg)] text-[var(--color-text-secondary)] text-xs border-b border-[var(--color-border)]">
              <tr>
                <th className="py-3 px-4 font-medium">Waktu</th>
                <th className="py-3 px-4 font-medium">Pengguna</th>
                <th className="py-3 px-4 font-medium">Aksi</th>
                <th className="py-3 px-4 font-medium">Entitas</th>
                <th className="py-3 px-4 font-medium">Proyek</th>
                <th className="py-3 px-4 font-medium">Rincian Aktivitas</th>
                <th className="py-3 px-4 font-medium text-center">Diff / Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--color-text-secondary)]">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Memuat log aktivitas...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--color-text-secondary)]">
                    Tidak ada aktivitas yang sesuai dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-[var(--color-text-secondary)] font-mono">
                      {new Date(log.createdAt).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    {/* User */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-xs text-[var(--color-text-primary)]">
                        {log.userName || 'Sistem'}
                      </div>
                      {log.userRole && (
                        <span className="text-[11px] text-[var(--color-text-secondary)] font-medium block">
                          {log.userRole}
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge variant={getActionBadgeVariant(log.action || log.actionType)}>
                        {log.action || log.actionType || 'UPDATE'}
                      </Badge>
                    </td>

                    {/* Entity */}
                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {log.entityType || log.targetType || 'ITEM'}
                      </span>
                      {log.entityName && (
                        <span className="text-[11px] text-[var(--color-text-secondary)] block truncate max-w-[140px]">
                          {log.entityName}
                        </span>
                      )}
                    </td>

                    {/* Project */}
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-[var(--color-text-secondary)] max-w-[160px] truncate">
                      {log.projectName || '-'}
                    </td>

                    {/* Details */}
                    <td className="py-3 px-4 text-xs text-[var(--color-text-primary)] max-w-[300px]">
                      {log.details || log.description || '-'}
                    </td>

                    {/* Inspect Diff Button */}
                    <td className="py-3 px-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--color-border)] hover:bg-black/5 dark:hover:bg-white/10 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Rincian
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detail Diff */}
      {selectedLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title="Rincian Audit Log Aktivitas"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-black/5 dark:bg-white/5 text-xs">
              <div>
                <span className="text-[var(--color-text-secondary)] block">Waktu Kejadian:</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {new Date(selectedLog.createdAt).toLocaleString('id-ID')}
                </span>
              </div>
              <div>
                <span className="text-[var(--color-text-secondary)] block">Pelaku (User):</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {selectedLog.userName} ({selectedLog.userRole || 'User'})
                </span>
              </div>
              <div>
                <span className="text-[var(--color-text-secondary)] block">Tipe Entitas:</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {selectedLog.entityType || selectedLog.targetType}
                </span>
              </div>
              <div>
                <span className="text-[var(--color-text-secondary)] block">Proyek:</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {selectedLog.projectName || '-'}
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                Keterangan Aktivitas:
              </span>
              <p className="p-3 rounded-xl border border-[var(--color-border)] text-xs text-[var(--color-text-primary)] bg-[var(--color-surface)]">
                {selectedLog.details || selectedLog.description || '-'}
              </p>
            </div>

            {/* Diff View */}
            {(selectedLog.oldValue || selectedLog.newValue) && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[var(--color-text-secondary)] block">
                  Perbandingan Nilai (Diff):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5 space-y-1">
                    <span className="text-[11px] font-semibold text-red-500 block">Nilai Sebelumnya (Old Value):</span>
                    <pre className="text-[11px] font-mono text-[var(--color-text-primary)] whitespace-pre-wrap overflow-x-auto">
                      {selectedLog.oldValue ? JSON.stringify(selectedLog.oldValue, null, 2) : '(Tidak ada / Baru)'}
                    </pre>
                  </div>
                  <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
                    <span className="text-[11px] font-semibold text-emerald-500 block">Nilai Sesudahnya (New Value):</span>
                    <pre className="text-[11px] font-mono text-[var(--color-text-primary)] whitespace-pre-wrap overflow-x-auto">
                      {selectedLog.newValue ? JSON.stringify(selectedLog.newValue, null, 2) : '(Dihapus)'}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedLog(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
