import React from 'react';
import { useFinance } from '../../../context/FinanceContext';
import { Badge } from '../../../components/ui';

export function AuditLogsTab() {
  const { financialLogs } = useFinance();

  const actionColors: Record<string, 'default'|'success'|'warning'|'danger'|'info'> = {
    'CREATE': 'success',
    'UPDATE': 'warning',
    'APPROVE': 'info',
    'VOID': 'default',
    'CANCEL': 'danger'
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Financial Audit Log</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">Rekam jejak setiap perubahan pada dokumen keuangan.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
              <th className="py-3 px-4">Waktu</th>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Aksi</th>
              <th className="py-3 px-4">Modul</th>
              <th className="py-3 px-4">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {financialLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[var(--color-text-secondary)]">Belum ada aktivitas.</td>
              </tr>
            ) : (
              financialLogs.map(log => (
                <tr key={log.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg)]">
                  <td className="py-3 px-4 whitespace-nowrap text-sm text-[var(--color-text-secondary)]">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-sm">{log.userName}</td>
                  <td className="py-3 px-4">
                    <Badge variant={actionColors[log.action]}>{log.action}</Badge>
                  </td>
                  <td className="py-3 px-4 text-sm font-medium">{log.transactionType}</td>
                  <td className="py-3 px-4 text-sm text-[var(--color-text-secondary)] truncate max-w-xs" title={log.reason}>
                    {log.reason || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
