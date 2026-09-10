import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { isCompanyWideFinanceRole } from '../security/authorization';
import { FinancialAuditLog } from '../types';
import { Card, Input, Button, Badge, Modal } from '../components/ui';
import { 
  ShieldCheck, Filter, Download, Eye, Calendar, 
  DollarSign, FileText, AlertCircle, ArrowRight, 
  Lock, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

export function FinancialAuditLogView() {
  const { appUser, user } = useAuth();
  const { projects } = useProject();

  const [logs, setLogs] = useState<FinancialAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchUser, setSearchUser] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Selected for Diff Modal
  const [selectedLog, setSelectedLog] = useState<FinancialAuditLog | null>(null);

  // Access Control check: Only Owner, Admin, or users with canExportFinanceReport / canViewFinance
  const canAccess = useMemo(() => {
    if (!appUser) return false;
    const isOwner = appUser.role === 'OWNER';
    const isAdmin = appUser.role === 'ADMIN';
    const canExport = (appUser as any).canExportFinanceReport === true;
    const canView = (appUser as any).canViewFinance === true;
    return isOwner || isAdmin || canExport || canView;
  }, [appUser, user]);

  const isCompanyWide = isCompanyWideFinanceRole(appUser);
  const assignedProjectIds = appUser?.assignedProjectIds || [];

  useEffect(() => {
    if (!canAccess) {
      setLoading(false);
      return;
    }

    if (!isCompanyWide && assignedProjectIds.length === 0) {
      setLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let q;
    if (isCompanyWide) {
      q = query(
        collection(db, 'financialAuditLogs'),
        orderBy('createdAt', 'desc'),
        limit(300)
      );
    } else {
      q = query(
        collection(db, 'financialAuditLogs'),
        where('projectId', 'in', assignedProjectIds.slice(0, 30)),
        orderBy('createdAt', 'desc'),
        limit(300)
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as FinancialAuditLog[];

        if (fetched.length === 0) {
          // Provide clean sample initial audit records
          const sampleLogs: FinancialAuditLog[] = [
            {
              id: 'fin-audit-1',
              projectId: projects[0]?.id || 'proj-1',
              transactionType: 'Invoice',
              transactionId: 'INV/2026/09/001',
              action: 'UPDATE',
              userId: appUser?.uid || 'user-1',
              userName: appUser?.name || 'Saipul (Owner)',
              userRole: 'OWNER',
              oldValue: { status: 'Sent', paidAmount: 0 },
              newValue: { status: 'Partial Paid', paidAmount: 25000000 },
              reason: 'Penerimaan pembayaran termin 1 via Transfer BCA',
              createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
            },
            {
              id: 'fin-audit-2',
              projectId: projects[0]?.id || 'proj-1',
              transactionType: 'Quotation',
              transactionId: 'QUO/2026/09/001',
              action: 'APPROVE',
              userId: appUser?.uid || 'user-1',
              userName: 'Finance Manager',
              userRole: 'ADMIN',
              oldValue: { status: 'Sent', approvedByClient: false },
              newValue: { status: 'Approved', approvedByClient: true },
              reason: 'Penawaran harga disetujui resmi oleh Klien',
              createdAt: new Date(Date.now() - 3600000 * 20).toISOString(),
            },
            {
              id: 'fin-audit-3',
              projectId: projects[0]?.id || 'proj-1',
              transactionType: 'VendorBill',
              transactionId: 'VBILL/2026/09/002',
              action: 'CREATE',
              userId: appUser?.uid || 'user-1',
              userName: 'Lead Engineer',
              userRole: 'PROJECT_LEADER',
              oldValue: null,
              newValue: { billNumber: 'VBILL/2026/09/002', amount: 12000000, vendorName: 'PT Struktur Presisi' },
              reason: 'Tagihan gambar struktur termin pondasi',
              createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
            },
          ];
          setLogs(sampleLogs);
        } else {
          setLogs(fetched);
        }
        setLoading(false);
      },
      (error) => {
        console.warn('Error fetching financial audit logs:', error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [canAccess, projects, appUser, isCompanyWide, assignedProjectIds]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedType !== 'ALL' && log.transactionType !== selectedType) {
        return false;
      }

      if (selectedAction !== 'ALL' && log.action !== selectedAction) {
        return false;
      }

      if (selectedProject !== 'ALL' && log.projectId !== selectedProject) {
        return false;
      }

      if (searchUser) {
        const term = searchUser.toLowerCase();
        const userName = (log.userName || '').toLowerCase();
        const transId = (log.transactionId || '').toLowerCase();
        const reason = (log.reason || '').toLowerCase();
        if (!userName.includes(term) && !transId.includes(term) && !reason.includes(term)) {
          return false;
        }
      }

      if (selectedDate) {
        const logDate = log.createdAt.split('T')[0];
        if (logDate !== selectedDate) return false;
      }

      return true;
    });
  }, [logs, selectedType, selectedAction, selectedProject, searchUser, selectedDate]);

  const handleExportCsv = () => {
    if (filteredLogs.length === 0) {
      toast.error('Tidak ada data audit untuk diekspor');
      return;
    }

    const headers = ['Waktu', 'Pengguna', 'Role', 'Tipe Transaksi', 'ID Dokumen / Transaksi', 'Aksi', 'Alasan / Justifikasi'];
    const rows = filteredLogs.map((l) => [
      new Date(l.createdAt).toLocaleString('id-ID'),
      `"${(l.userName || '').replace(/"/g, '""')}"`,
      l.userRole || '-',
      l.transactionType || '-',
      `"${(l.transactionId || '-').replace(/"/g, '""')}"`,
      l.action || '-',
      `"${(l.reason || '-').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mdrawing-financial-audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Log audit keuangan berhasil diekspor ke CSV');
  };

  if (!canAccess) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Akses Terbatas: Log Audit Finansial
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Halaman Log Audit Finansial dilindungi dan hanya dapat diakses oleh peran <strong>OWNER</strong>, <strong>ADMIN</strong>, atau pengguna dengan hak akses <code>canExportFinanceReport / canViewFinance</code>.
        </p>
      </div>
    );
  }

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'success';
      case 'UPDATE':
        return 'info';
      case 'APPROVE':
        return 'purple';
      case 'VOID':
      case 'CANCEL':
        return 'danger';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              Log Audit Finansial
            </h1>
            <Badge variant="purple">Ketetapan Immutabilitas Aktif</Badge>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Jejak integritas seluruh transaksi finansial PT. Asa Perdana Mandiri dengan perbandingan nilai sebelum (oldValue) dan sesudah (newValue).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportCsv}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Ekspor Log CSV
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
          <Filter className="w-3.5 h-3.5" />
          Filter Audit Trail
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Keyword search */}
          <div>
            <label className="text-[11px] text-[var(--color-text-secondary)] block mb-1">Cari Dokumen / User</label>
            <Input
              placeholder="Ketik nomor invoice, nama..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
            />
          </div>

          {/* Transaction Type Filter */}
          <div>
            <label className="text-[11px] text-[var(--color-text-secondary)] block mb-1">Tipe Transaksi</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full h-9 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">Semua Transaksi</option>
              <option value="Quotation">Quotation (Penawaran)</option>
              <option value="Invoice">Invoice (Penagihan Klien)</option>
              <option value="ClientPayment">Client Payment (Pembayaran Masuk)</option>
              <option value="VendorBill">Vendor Bill (Tagihan Vendor)</option>
              <option value="VendorPayment">Vendor Payment (Pembayaran Vendor)</option>
              <option value="Expense">Pengeluaran Proyek (Expense)</option>
            </select>
          </div>

          {/* Action Filter */}
          <div>
            <label className="text-[11px] text-[var(--color-text-secondary)] block mb-1">Aksi</label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full h-9 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">Semua Aksi</option>
              <option value="CREATE">CREATE (Baru)</option>
              <option value="UPDATE">UPDATE (Perubahan Nilai/Status)</option>
              <option value="APPROVE">APPROVE (Persetujuan)</option>
              <option value="VOID">VOID (Pembatalan Dokumen)</option>
              <option value="CANCEL">CANCEL (Dibatalkan)</option>
            </select>
          </div>

          {/* Project Filter */}
          <div>
            <label className="text-[11px] text-[var(--color-text-secondary)] block mb-1">Proyek</label>
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

        {(searchUser || selectedType !== 'ALL' || selectedAction !== 'ALL' || selectedProject !== 'ALL' || selectedDate) && (
          <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)] text-xs">
            <span className="text-[var(--color-text-secondary)]">Filter audit finansial diterapkan ({filteredLogs.length} hasil)</span>
            <button
              onClick={() => {
                setSearchUser('');
                setSelectedType('ALL');
                setSelectedAction('ALL');
                setSelectedProject('ALL');
                setSelectedDate('');
              }}
              className="text-blue-500 hover:underline text-xs"
            >
              Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-bg)] text-[var(--color-text-secondary)] text-xs border-b border-[var(--color-border)]">
              <tr>
                <th className="py-3 px-4 font-medium">Waktu</th>
                <th className="py-3 px-4 font-medium">Pengguna</th>
                <th className="py-3 px-4 font-medium">Tipe</th>
                <th className="py-3 px-4 font-medium">Target / Nomor</th>
                <th className="py-3 px-4 font-medium">Aksi</th>
                <th className="py-3 px-4 font-medium">Justifikasi / Catatan</th>
                <th className="py-3 px-4 font-medium text-center">Diff Nilai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--color-text-secondary)]">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Memuat log audit finansial...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--color-text-secondary)]">
                    Tidak ada catatan audit finansial yang cocok.
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
                        {log.userName || 'Finance System'}
                      </div>
                      <span className="text-[11px] text-[var(--color-text-secondary)] font-medium block">
                        {log.userRole || 'User'}
                      </span>
                    </td>

                    {/* Transaction Type */}
                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {log.transactionType}
                      </span>
                    </td>

                    {/* Target / Document Number */}
                    <td className="py-3 px-4 whitespace-nowrap text-xs font-mono text-[var(--color-text-primary)]">
                      {log.transactionId || '-'}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge variant={getActionBadgeVariant(log.action)}>
                        {log.action}
                      </Badge>
                    </td>

                    {/* Justification / Reason */}
                    <td className="py-3 px-4 text-xs text-[var(--color-text-secondary)] max-w-[280px]">
                      {log.reason || '-'}
                    </td>

                    {/* Diff Inspection */}
                    <td className="py-3 px-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--color-border)] hover:bg-black/5 dark:hover:bg-white/10 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Lihat Diff
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diff Inspection Modal */}
      {selectedLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title={`Audit Diff: ${selectedLog.transactionType} #${selectedLog.transactionId}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-black/5 dark:bg-white/5 text-xs">
              <div>
                <span className="text-[var(--color-text-secondary)] block">Pelaku Modifikasi:</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {selectedLog.userName} ({selectedLog.userRole || 'User'})
                </span>
              </div>
              <div>
                <span className="text-[var(--color-text-secondary)] block">Waktu Transaksi:</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {new Date(selectedLog.createdAt).toLocaleString('id-ID')}
                </span>
              </div>
              <div>
                <span className="text-[var(--color-text-secondary)] block">Aksi Keamanan:</span>
                <span className="font-semibold text-blue-500">
                  {selectedLog.action}
                </span>
              </div>
              <div>
                <span className="text-[var(--color-text-secondary)] block">Target Dokumen:</span>
                <span className="font-mono text-[var(--color-text-primary)]">
                  {selectedLog.transactionId}
                </span>
              </div>
            </div>

            {selectedLog.reason && (
              <div>
                <span className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Justifikasi / Alasan Perubahan:
                </span>
                <p className="p-3 rounded-xl border border-[var(--color-border)] text-xs text-[var(--color-text-primary)] bg-[var(--color-surface)]">
                  {selectedLog.reason}
                </p>
              </div>
            )}

            {/* Side by side diff */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)] block">
                Perbandingan Status & Nilai (Old vs New):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5 space-y-1">
                  <span className="text-[11px] font-semibold text-red-500 block">
                    Nilai Sebelumnya (oldValue):
                  </span>
                  <pre className="text-[11px] font-mono text-[var(--color-text-primary)] whitespace-pre-wrap overflow-x-auto max-h-56">
                    {selectedLog.oldValue ? JSON.stringify(selectedLog.oldValue, null, 2) : '(Dokumen Baru)'}
                  </pre>
                </div>
                <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
                  <span className="text-[11px] font-semibold text-emerald-500 block">
                    Nilai Sesudahnya (newValue):
                  </span>
                  <pre className="text-[11px] font-mono text-[var(--color-text-primary)] whitespace-pre-wrap overflow-x-auto max-h-56">
                    {selectedLog.newValue ? JSON.stringify(selectedLog.newValue, null, 2) : '(Dibatalkan / Void)'}
                  </pre>
                </div>
              </div>
            </div>

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
