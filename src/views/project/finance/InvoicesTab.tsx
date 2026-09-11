import React, { useState } from 'react';
import { useFinance } from '../../../context/FinanceContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { useProjects } from '../../../context/ProjectContext';
import { useParams } from 'react-router-dom';
import { Button, Modal, Select, Input, Badge, ConfirmModal } from '../../../components/ui';
import { Plus, Send, FileText, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Invoice } from '../../../types';
import { generateInvoicePdf, generatePiutangReportPdf } from '../../../lib/exportUtils';
import { normalizeMoney } from '../../../engine/financial/financialEngine';

export function InvoicesTab() {
  const { id: projectId } = useParams<{id: string}>();
  const { projects } = useProjects();
  const project = projects.find(p => p.id === projectId);

  const { invoices, clients, financeTerms, quotations, createInvoice, updateInvoiceStatus } = useFinance();
  const { canManageFinance } = usePermissions();
  const canEdit = canManageFinance();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTermId, setSelectedTermId] = useState('');
  const [voidInvoiceId, setVoidInvoiceId] = useState<string | null>(null);
  
  // Scoped to current active project only
  const projectInvoices = invoices.filter(inv => inv.projectId === projectId);
  const projectQuotations = quotations.filter(q => q.projectId === projectId);
  const approvedQuotation = projectQuotations.find(q => q.status === 'Approved');
  const projectFinanceTerms = financeTerms.filter(t => t.projectId === projectId);

  const handleCreate = async () => {
    if (!canEdit) {
      toast.error('Akses ditolak: Anda tidak memiliki wewenang membuat invoice.');
      return;
    }
    if (!projectId) {
      toast.error('Project ID aktif tidak valid.');
      return;
    }
    if (!approvedQuotation || approvedQuotation.projectId !== projectId) {
      toast.error('Penawaran untuk proyek ini belum disetujui, tidak bisa buat invoice.');
      return;
    }
    const term = projectFinanceTerms.find(t => t.id === selectedTermId && t.projectId === projectId);
    if (!term) {
      toast.error('Pilih termin proyek yang valid');
      return;
    }

    // Hitung nominal invoice secara deterministic IDR integer
    let invoiceAmount = 0;
    if (term.amountType === 'Percentage') {
      invoiceAmount = normalizeMoney(Math.round(approvedQuotation.grandTotal * ((term.percentageValue || 0) / 100)));
    } else {
      invoiceAmount = normalizeMoney(Math.round(term.nominalValue || 0));
    }

    try {
      await createInvoice({
        projectId,
        termId: term.id,
        clientId: approvedQuotation.clientId,
        subTotal: invoiceAmount,
        grandTotal: invoiceAmount,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 hari
      });
      setIsModalOpen(false);
      setSelectedTermId('');
      toast.success('Invoice berhasil dibuat');
    } catch (e: any) {
      toast.error('Gagal membuat invoice: ' + e.message);
    }
  };

  const statusColors: Record<string, 'default'|'success'|'warning'|'danger'> = {
    'Draft': 'default',
    'Sent': 'warning',
    'Partial Paid': 'warning',
    'Paid': 'success',
    'Overdue': 'danger',
    'Void': 'default',
    'Cancelled': 'danger'
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Faktur (Invoice)</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">Kelola tagihan proyek ke klien.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            onClick={() => generatePiutangReportPdf(projectInvoices, [], clients)}
          >
            <FileText className="w-4 h-4 mr-2" /> Laporan Piutang
          </Button>
          <Button 
            disabled={!canEdit}
            title={!canEdit ? "Akses terbatas: Memerlukan izin Kelola Keuangan (Finance / Admin / Owner)" : undefined}
            onClick={() => {
              if (!canEdit) {
                toast.error('Akses terbatas: Anda tidak memiliki wewenang membuat invoice.');
                return;
              }
              setIsModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Buat Invoice
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
              <th className="py-3 px-4">Nomor</th>
              <th className="py-3 px-4">Termin</th>
              <th className="py-3 px-4">Jatuh Tempo</th>
              <th className="py-3 px-4">Total</th>
              <th className="py-3 px-4">Dibayar</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {projectInvoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[var(--color-text-secondary)]">Belum ada invoice untuk proyek ini.</td>
              </tr>
            ) : (
              projectInvoices.map(inv => {
                const term = projectFinanceTerms.find(t => t.id === inv.termId);
                return (
                  <tr key={inv.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg)]">
                    <td className="py-3 px-4 font-medium">{inv.invoiceNumber}</td>
                    <td className="py-3 px-4">{term?.termName || 'Manual'}</td>
                    <td className="py-3 px-4 text-orange-600">{new Date(inv.dueDate).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-medium">Rp {inv.grandTotal.toLocaleString()}</td>
                    <td className="py-3 px-4 text-green-600">Rp {inv.amountPaid.toLocaleString()}</td>
                    <td className="py-3 px-4"><Badge variant={statusColors[inv.status]}>{inv.status}</Badge></td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" title="Lihat PDF" onClick={() => {
                          if (project) {
                            const client = clients.find(c => c.id === project.clientId);
                            const q = projectQuotations.find(qt => qt.id === approvedQuotation?.id);
                            generateInvoicePdf(inv, q, project, client, term?.termName);
                          }
                        }}>
                          <FileText className="w-4 h-4 text-blue-500" />
                        </Button>
                        {canEdit && inv.status === 'Draft' && (
                          <Button variant="ghost" size="icon" title="Tandai Terkirim" onClick={() => updateInvoiceStatus(inv.id, 'Sent')}>
                            <Send className="w-4 h-4 text-orange-500" />
                          </Button>
                        )}
                        {canEdit && !['Paid', 'Cancelled', 'Void'].includes(inv.status) && (
                          <Button variant="ghost" size="icon" title="Void" onClick={() => setVoidInvoiceId(inv.id)}>
                            <XCircle className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Buat Invoice">
        {!approvedQuotation ? (
          <div className="text-center py-6 text-[var(--color-text-secondary)]">
            Anda belum memiliki penawaran (Quotation) yang disetujui di proyek ini.
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Pilih Termin Pembayaran</label>
              <Select
                value={selectedTermId}
                onChange={e => setSelectedTermId(e.target.value)}
                options={[
                  { value: '', label: 'Pilih termin...' },
                  ...projectFinanceTerms.map(t => ({ value: t.id, label: `${t.termName} - ${t.amountType === 'Percentage' ? t.percentageValue + '%' : 'Rp ' + t.nominalValue}` }))
                ]}
              />
            </div>
            
            {selectedTermId && (
              <div className="p-4 bg-[var(--color-bg)] rounded-xl border border-[var(--color-border)]">
                <p className="text-sm text-[var(--color-text-secondary)]">Nilai invoice akan dihitung secara otomatis berdasarkan penawaran yang disetujui (Rp {approvedQuotation.grandTotal.toLocaleString()}).</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Batal</Button>
              <Button onClick={handleCreate} disabled={!selectedTermId}>Buat Invoice Draft</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!voidInvoiceId}
        onClose={() => setVoidInvoiceId(null)}
        onConfirm={async () => {
          if (voidInvoiceId) {
            await updateInvoiceStatus(voidInvoiceId, 'Void', 'Kesalahan pembuatan');
            setVoidInvoiceId(null);
          }
        }}
        title="Konfirmasi Void Invoice"
        message="Apakah Anda yakin ingin membatalkan (Void) invoice ini? Status invoice akan diubah menjadi Void dan tidak dapat ditagihkan lagi."
        confirmLabel="Ya, Void Invoice"
        cancelLabel="Batal"
        variant="danger"
      />
    </div>
  );
}
