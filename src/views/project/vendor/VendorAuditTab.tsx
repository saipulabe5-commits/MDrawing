import React, { useState } from 'react';
import { useVendor } from '../../../context/VendorContext';
import { FinancialAuditLog } from '../../../types';
import { Badge, Modal, Card } from '../../../components/ui';
import { ShieldCheck, Eye, Clock, User } from 'lucide-react';

export function VendorAuditTab() {
  const { vendorLogs } = useVendor();
  const [selectedLog, setSelectedLog] = useState<FinancialAuditLog | null>(null);

  const actionColors: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
    CREATE: 'success',
    UPDATE: 'warning',
    APPROVE: 'info',
    VOID: 'default',
    CANCEL: 'danger'
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Audit Log Keuangan Vendor
        </h2>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Rekam jejak kepatuhan Aturan Bisnis #12 untuk setiap mutasi kontrak, termin, tagihan, dan bukti bayar vendor
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-black/5 dark:bg-white/5 text-[var(--color-text-secondary)] font-semibold uppercase">
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Aksi</th>
                <th className="py-3 px-4">Entitas</th>
                <th className="py-3 px-4">Keterangan / Alasan</th>
                <th className="py-3 px-4 text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-text-primary)]">
              {vendorLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[var(--color-text-secondary)]">
                    Belum ada riwayat transaksi vendor pada proyek ini.
                  </td>
                </tr>
              ) : (
                vendorLogs.map(log => (
                  <tr key={log.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-[var(--color-text-secondary)]">
                      {new Date(log.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 font-medium flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 opacity-60" />
                      <span>{log.userName}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={actionColors[log.action] || 'default'}>{log.action}</Badge>
                    </td>
                    <td className="py-3 px-4 font-medium">{log.transactionType}</td>
                    <td className="py-3 px-4 text-[var(--color-text-secondary)] truncate max-w-xs" title={log.reason}>
                      {log.reason || '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-blue-600 dark:text-blue-400"
                        title="Lihat Snapshot Data"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Detail Audit Log (Old vs New Snapshot) */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Detail Snapshot Audit Log"
      >
        {selectedLog && (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-black/5 dark:bg-white/5 rounded-xl">
              <div>
                <span className="text-[var(--color-text-secondary)] block">Waktu:</span>
                <span className="font-semibold">{new Date(selectedLog.createdAt).toLocaleString('id-ID')}</span>
              </div>
              <div>
                <span className="text-[var(--color-text-secondary)] block">Pelaku (User):</span>
                <span className="font-semibold">{selectedLog.userName} ({selectedLog.userId})</span>
              </div>
              <div>
                <span className="text-[var(--color-text-secondary)] block">Tindakan:</span>
                <Badge variant={actionColors[selectedLog.action] || 'default'}>{selectedLog.action}</Badge>
              </div>
              <div>
                <span className="text-[var(--color-text-secondary)] block">Entitas:</span>
                <span className="font-semibold">{selectedLog.transactionType}</span>
              </div>
            </div>

            {selectedLog.reason && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <span className="text-blue-600 dark:text-blue-400 font-medium block">Alasan / Catatan:</span>
                <p className="text-[var(--color-text-primary)] mt-1">{selectedLog.reason}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="font-semibold mb-1 text-[var(--color-text-secondary)]">Nilai Sebelum (oldValue):</p>
                <pre className="p-3 bg-black/10 dark:bg-white/10 rounded-xl overflow-x-auto text-[11px] max-h-52">
                  {selectedLog.oldValue ? JSON.stringify(selectedLog.oldValue, null, 2) : 'null (Data Baru)'}
                </pre>
              </div>
              <div>
                <p className="font-semibold mb-1 text-[var(--color-text-secondary)]">Nilai Sesudah (newValue):</p>
                <pre className="p-3 bg-black/10 dark:bg-white/10 rounded-xl overflow-x-auto text-[11px] max-h-52">
                  {selectedLog.newValue ? JSON.stringify(selectedLog.newValue, null, 2) : 'null (Data Dihapus)'}
                </pre>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
