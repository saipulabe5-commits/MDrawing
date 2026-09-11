import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useVendor } from '../../../context/VendorContext';
import { useProjects } from '../../../context/ProjectContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { VendorBill, VendorBillStatus, ProjectVendor } from '../../../types';
import { Button, Modal, Input, Card } from '../../../components/ui';
import { Plus, FileText, Download, DollarSign, Ban, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { generateVendorBillPdf } from '../../../lib/exportUtils';
import toast from 'react-hot-toast';
import { VendorBillSchema, VendorBillFormData } from '../../../lib/validationSchemas';

interface VendorBillsTabProps {
  projectId: string;
  onPayBill?: (bill: VendorBill) => void;
}

const BILL_STATUS_CONFIG: Record<VendorBillStatus, { label: string; color: string }> = {
  Draft: { label: 'Draft', color: 'bg-gray-500/10 text-gray-500' },
  Received: { label: 'Diterima', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  'Partial Paid': { label: 'Sebagian Dibayar', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  Paid: { label: 'Lunas', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  Overdue: { label: 'Jatuh Tempo', color: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  Void: { label: 'Void', color: 'bg-red-500/10 text-red-500 line-through' },
  Cancelled: { label: 'Dibatalkan', color: 'bg-gray-500/10 text-gray-400' }
};

export function VendorBillsTab({ projectId, onPayBill }: VendorBillsTabProps) {
  const { projects } = useProjects();
  const currentProject = projects.find(p => p.id === projectId);
  const { 
    vendors, 
    projectVendors, 
    vendorBills, 
    vendorPaymentTerms, 
    createVendorBill, 
    updateVendorBillStatus, 
    voidVendorBill 
  } = useVendor();

  const { canManageFinance, canViewVendorCost, canVoidFinanceTransaction } = usePermissions();
  const canManage = canManageFinance();
  const canSeeCost = canViewVendorCost();
  const canVoid = canVoidFinanceTransaction();

  // Scoped strictly to current active project
  const currentProjectVendors = projectVendors.filter(p => p.projectId === projectId);
  const currentProjectVendorBills = vendorBills.filter(b => b.projectId === projectId);
  const currentProjectVendorPaymentTerms = vendorPaymentTerms.filter(t => t.projectId === projectId);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Void modal state
  const [voidTargetId, setVoidTargetId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isValid }
  } = useForm<VendorBillFormData>({
    resolver: zodResolver(VendorBillSchema) as any,
    defaultValues: {
      projectVendorId: '',
      vendorId: '',
      termId: '',
      billDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      amount: 0,
      notes: ''
    },
    mode: 'onChange'
  });

  const currentProjectVendorId = watch('projectVendorId');
  const availableTerms = currentProjectVendorPaymentTerms.filter(t => t.projectVendorId === currentProjectVendorId);

  const handleOpenAdd = () => {
    if (!canManage) {
      toast.error('Akses terbatas: Anda tidak memiliki wewenang menerbitkan tagihan vendor.');
      return;
    }
    const defaultPv = currentProjectVendors[0];
    reset({
      projectVendorId: defaultPv ? defaultPv.id : '',
      vendorId: defaultPv ? defaultPv.vendorId : '',
      termId: '',
      billDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      amount: 0,
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleContractChange = (pvId: string) => {
    const pv = currentProjectVendors.find(p => p.id === pvId);
    setValue('projectVendorId', pvId, { shouldValidate: true });
    setValue('vendorId', pv ? pv.vendorId : '', { shouldValidate: true });
    setValue('termId', '', { shouldValidate: true });
  };

  const onSubmit = async (data: VendorBillFormData) => {
    if (!canManage) {
      toast.error('Akses ditolak: Anda tidak memiliki wewenang menerbitkan tagihan.');
      return;
    }

    try {
      await createVendorBill(data as any);
      toast.success('Tagihan vendor berhasil diterbitkan');
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Gagal menerbitkan tagihan');
    }
  };

  const handleDownloadPdf = (bill: VendorBill) => {
    const pv = currentProjectVendors.find(p => p.id === bill.projectVendorId);
    const v = vendors.find(item => item.id === bill.vendorId);
    generateVendorBillPdf(bill, pv, v, currentProject || undefined);
    toast.success('Mengunduh PDF Tagihan Vendor...');
  };

  const handleOpenVoidModal = (billId: string) => {
    setVoidTargetId(billId);
    setVoidReason('');
    setIsVoidModalOpen(true);
  };

  const handleConfirmVoid = async () => {
    if (!voidTargetId || !voidReason.trim()) {
      toast.error('Alasan void wajib diisi');
      return;
    }

    try {
      await voidVendorBill(voidTargetId, voidReason.trim());
      toast.success('Tagihan vendor berhasil di-void');
      setIsVoidModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Gagal melakukan void');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Tagihan Vendor (Vendor Bills)
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Kewajiban hutang yang ditagihkan oleh vendor/subkon untuk diverifikasi dan dibayarkan
          </p>
        </div>

        <Button 
          disabled={!canManage || currentProjectVendors.length === 0}
          title={
            !canManage 
              ? "Akses terbatas: Memerlukan izin Kelola Keuangan (Finance / Admin / Owner)" 
              : currentProjectVendors.length === 0 
                ? "Tambahkan vendor kontrak terlebih dahulu di tab Kontrak Vendor" 
                : undefined
          }
          onClick={handleOpenAdd} 
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Terbitkan Tagihan Baru</span>
        </Button>
      </div>

      {/* Bills List */}
      {currentProjectVendorBills.length === 0 ? (
        <div className="p-12 text-center bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] space-y-3">
          <FileText className="w-12 h-12 mx-auto text-[var(--color-text-secondary)] opacity-40" />
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Belum ada tagihan vendor</h3>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mx-auto">
            Terbitkan tagihan baru atau generate otomatis dari tab Termin Bayar ketika pekerjaan vendor mencapai progres target.
          </p>
          {canManage && currentProjectVendors.length > 0 && (
            <Button onClick={handleOpenAdd} className="mt-2">
              Terbitkan Tagihan Pertama
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {currentProjectVendorBills.map((bill) => {
            const pv = currentProjectVendors.find(p => p.id === bill.projectVendorId);
            const statusConfig = BILL_STATUS_CONFIG[bill.status] || BILL_STATUS_CONFIG.Draft;
            const isOverdue = bill.remainingAmount > 0 && bill.dueDate && new Date(bill.dueDate) < new Date() && !['Void', 'Cancelled', 'Paid'].includes(bill.status);

            return (
              <Card key={bill.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-[var(--color-text-primary)]">
                      {bill.billNumber}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                    {isOverdue && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Lewat Jatuh Tempo
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-[var(--color-text-secondary)] flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-medium text-[var(--color-text-primary)]">
                      Vendor: {pv?.vendorName || 'Rekanan'}
                    </span>
                    <span>Tgl: {new Date(bill.billDate).toLocaleDateString('id-ID')}</span>
                    {bill.dueDate && (
                      <span>Jatuh Tempo: {new Date(bill.dueDate).toLocaleDateString('id-ID')}</span>
                    )}
                  </div>

                  {bill.notes && (
                    <p className="text-xs text-[var(--color-text-secondary)] bg-black/5 dark:bg-white/5 p-1.5 rounded-md">
                      {bill.notes}
                    </p>
                  )}
                </div>

                {/* Amounts and Actions */}
                <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[var(--color-border)]">
                  <div className="text-right">
                    <span className="text-[11px] text-[var(--color-text-secondary)] block">Total Tagihan</span>
                    {canSeeCost ? (
                      <span className="font-bold text-sm text-[var(--color-text-primary)]">
                        Rp {bill.amount.toLocaleString('id-ID')}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-text-secondary)] italic">Terkunci</span>
                    )}

                    {canSeeCost && (
                      <div className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                        Dibayar: <span className="text-emerald-600 dark:text-emerald-400 font-medium">Rp {bill.paidAmount.toLocaleString('id-ID')}</span>
                        {bill.remainingAmount > 0 && (
                          <> • Sisa: <span className="text-amber-600 dark:text-amber-400 font-medium">Rp {bill.remainingAmount.toLocaleString('id-ID')}</span></>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDownloadPdf(bill)}
                      title="Unduh PDF Tagihan"
                      className="p-2"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>

                    {canManage && !['Paid', 'Void', 'Cancelled'].includes(bill.status) && onPayBill && (
                      <Button
                        size="sm"
                        onClick={() => onPayBill(bill)}
                        className="text-xs flex items-center gap-1.5"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Bayar</span>
                      </Button>
                    )}

                    {canManage && canVoid && !['Void', 'Cancelled'].includes(bill.status) && (
                      <button
                        onClick={() => handleOpenVoidModal(bill.id)}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 text-xs flex items-center gap-1"
                        title="Void Tagihan"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Add Bill */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Terbitkan Tagihan Vendor Baru"
      >
        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Pilih Kontrak Vendor *
            </label>
            <select
              {...register('projectVendorId')}
              onChange={(e) => handleContractChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)] text-[var(--color-text-primary)]"
            >
              {currentProjectVendors.map(pv => (
                <option key={pv.id} value={pv.id} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">
                  {pv.vendorName} - {pv.scopeOfWork} (Total: Rp {pv.contractValue.toLocaleString('id-ID')})
                </option>
              ))}
            </select>
            {errors.projectVendorId && (
              <p className="text-xs text-red-500 mt-1">{errors.projectVendorId.message}</p>
            )}
          </div>

          {availableTerms.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Tautkan Ke Termin Bayar (Opsional)
              </label>
              <select
                {...register('termId')}
                onChange={(e) => {
                  const tId = e.target.value;
                  const chosenTerm = availableTerms.find(t => t.id === tId);
                  const pv = currentProjectVendors.find(p => p.id === currentProjectVendorId);
                  setValue('termId', tId);
                  if (chosenTerm && pv) {
                    const autoAmount = chosenTerm.amountType === 'Percentage'
                      ? ((chosenTerm.percentageValue || 0) * (pv.contractValue || 0)) / 100
                      : chosenTerm.nominalValue || 0;
                    setValue('amount', autoAmount, { shouldValidate: true });
                    setValue('notes', `Tagihan Termin ${chosenTerm.termName}`);
                  }
                }}
                className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)] text-[var(--color-text-primary)]"
              >
                <option value="">-- Tanpa Tautan Termin (Manual) --</option>
                {availableTerms.map(term => (
                  <option key={term.id} value={term.id} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">
                    {term.termName} ({term.amountType === 'Percentage' ? `${term.percentageValue}%` : `Rp ${term.nominalValue?.toLocaleString('id-ID')}`})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Tanggal Tagihan *"
              type="date"
              {...register('billDate')}
              error={errors.billDate?.message}
            />
            <Input
              label="Tanggal Jatuh Tempo *"
              type="date"
              {...register('dueDate')}
              error={errors.dueDate?.message}
            />
          </div>

          <Input
            label="Jumlah Tagihan (Rp) *"
            type="number"
            step="any"
            placeholder="0"
            {...register('amount', { valueAsNumber: true })}
            error={errors.amount?.message}
          />

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Keterangan / Rincian Tagihan
            </label>
            <textarea
              rows={3}
              placeholder="Rincian tagihan vendor"
              {...register('notes')}
              className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)] text-[var(--color-text-primary)]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border)]">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={!isValid}>
              Terbitkan Tagihan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Void Reason */}
      <Modal
        isOpen={isVoidModalOpen}
        onClose={() => setIsVoidModalOpen(false)}
        title="Konfirmasi Void Tagihan Vendor"
      >
        <div className="space-y-4">
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 p-3 rounded-xl">
            Tindakan Void akan membatalkan tagihan ini secara permanen dan dicatat dalam Financial Audit Log sesuai Aturan Bisnis #12.
          </p>

          <Input
            label="Alasan Void Tagihan *"
            placeholder="Contoh: Kesalahan nominal atau dibatalkan oleh vendor"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            error={!voidReason.trim() && voidReason !== '' ? 'Alasan void wajib diisi' : undefined}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border)]">
            <Button variant="secondary" onClick={() => setIsVoidModalOpen(false)}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleConfirmVoid} disabled={!voidReason.trim()}>
              Void Tagihan Ini
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
