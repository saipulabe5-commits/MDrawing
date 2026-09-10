import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useVendor } from '../../../context/VendorContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { VendorPaymentTerm, VendorTermTrigger, ProjectVendor } from '../../../types';
import { Button, Modal, Input, Card, ConfirmModal } from '../../../components/ui';
import { Plus, Edit2, Trash2, ArrowUp, ArrowDown, FilePlus2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { VendorPaymentTermSchema, VendorPaymentTermFormData } from '../../../lib/validationSchemas';

interface VendorTermsTabProps {
  projectId: string;
  onGenerateBillFromTerm?: (term: VendorPaymentTerm, projectVendor: ProjectVendor) => void;
}

const TRIGGER_TYPES: VendorTermTrigger[] = [
  'On Work Start',
  'On Work Progress',
  'On Work Completed',
  'On Client Payment Received',
  'On Custom Date',
  'Manual'
];

export function VendorTermsTab({ projectId, onGenerateBillFromTerm }: VendorTermsTabProps) {
  const { 
    projectVendors, 
    vendorPaymentTerms, 
    createVendorPaymentTerm, 
    updateVendorPaymentTerm, 
    deleteVendorPaymentTerm, 
    reorderVendorPaymentTerms,
    createVendorBill
  } = useVendor();

  const { canManageFinance, canViewVendorCost } = usePermissions();
  const canManage = canManageFinance();
  const canSeeCost = canViewVendorCost();

  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [termToDelete, setTermToDelete] = useState<{ id: string; name: string } | null>(null);

  // Modal Generate Bill from Term
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [targetTerm, setTargetTerm] = useState<VendorPaymentTerm | null>(null);
  const [targetContract, setTargetContract] = useState<ProjectVendor | null>(null);
  const [billAmount, setBillAmount] = useState<number>(0);
  const [billDueDate, setBillDueDate] = useState<string>('');
  const [billNotes, setBillNotes] = useState<string>('');

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid }
  } = useForm<VendorPaymentTermFormData>({
    resolver: zodResolver(VendorPaymentTermSchema) as any,
    defaultValues: {
      projectVendorId: '',
      termName: '',
      triggerType: 'On Work Start',
      triggerCondition: '',
      amountType: 'Percentage',
      percentageValue: 50,
      nominalValue: 0,
      sortOrder: 1
    },
    mode: 'onChange'
  });

  const watchedAmountType = watch('amountType');

  const handleOpenAdd = () => {
    setEditingId(null);
    const defaultPv = projectVendors[0];
    reset({
      projectVendorId: defaultPv ? defaultPv.id : '',
      termName: '',
      triggerType: 'On Work Start',
      triggerCondition: '',
      amountType: 'Percentage',
      percentageValue: 50,
      nominalValue: 0,
      sortOrder: vendorPaymentTerms.length + 1
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (term: VendorPaymentTerm) => {
    setEditingId(term.id);
    reset({
      projectVendorId: term.projectVendorId,
      termName: term.termName,
      triggerType: term.triggerType,
      triggerCondition: term.triggerCondition || '',
      amountType: term.amountType,
      percentageValue: term.percentageValue || 0,
      nominalValue: term.nominalValue || 0,
      sortOrder: term.sortOrder
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: VendorPaymentTermFormData) => {
    try {
      if (editingId) {
        await updateVendorPaymentTerm(editingId, data as any);
        toast.success('Termin bayar vendor diperbarui');
      } else {
        const nextOrder = vendorPaymentTerms.filter(t => t.projectVendorId === data.projectVendorId).length;
        await createVendorPaymentTerm({ ...(data as any), sortOrder: nextOrder });
        toast.success('Termin bayar vendor berhasil dibuat');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Gagal menyimpan termin');
    }
  };

  const handleDelete = (id: string, name: string) => {
    setTermToDelete({ id, name });
  };

  const handleMove = async (index: number, direction: 'up' | 'down', filteredList: VendorPaymentTerm[]) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredList.length) return;

    const updated = [...filteredList];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    try {
      await reorderVendorPaymentTerms(updated);
      toast.success('Urutan termin berhasil diperbarui');
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal memperbarui urutan');
    }
  };

  const handleOpenGenerateBill = (term: VendorPaymentTerm) => {
    const contract = projectVendors.find(pv => pv.id === term.projectVendorId);
    if (!contract) return;

    let computedAmount = 0;
    if (term.amountType === 'Percentage') {
      computedAmount = ((term.percentageValue || 0) * (contract.contractValue || 0)) / 100;
    } else {
      computedAmount = term.nominalValue || 0;
    }

    setTargetTerm(term);
    setTargetContract(contract);
    setBillAmount(computedAmount);
    setBillDueDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setBillNotes(`Tagihan Termin ${term.termName} (${term.amountType === 'Percentage' ? `${term.percentageValue}%` : 'Nominal'})`);
    setIsBillModalOpen(true);
  };

  const handleConfirmGenerateBill = async () => {
    if (!targetTerm || !targetContract) return;

    try {
      await createVendorBill({
        projectVendorId: targetContract.id,
        vendorId: targetContract.vendorId,
        termId: targetTerm.id,
        amount: billAmount,
        dueDate: billDueDate,
        notes: billNotes
      });

      toast.success('Tagihan vendor berhasil dibuat dari termin');
      setIsBillModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Gagal membuat tagihan vendor');
    }
  };

  const filteredTerms = vendorPaymentTerms.filter(t => {
    if (selectedVendorFilter === 'ALL') return true;
    return t.projectVendorId === selectedVendorFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Cara Bayar & Termin Vendor
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Atur tahapan pembayaran vendor berdasarkan progres pekerjaan atau milestone proyek
          </p>
        </div>

        <div className="flex items-center gap-3">
          {projectVendors.length > 0 && (
            <select
              value={selectedVendorFilter}
              onChange={(e) => setSelectedVendorFilter(e.target.value)}
              className="text-xs font-medium px-3 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)] text-[var(--color-text-primary)]"
            >
              <option value="ALL">Semua Vendor ({projectVendors.length})</option>
              {projectVendors.map(pv => (
                <option key={pv.id} value={pv.id}>
                  {pv.vendorName} ({pv.vendorType})
                </option>
              ))}
            </select>
          )}

          {canManage && projectVendors.length > 0 && (
            <Button onClick={handleOpenAdd} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>Tambah Termin</span>
            </Button>
          )}
        </div>
      </div>

      {/* Terms List */}
      {filteredTerms.length === 0 ? (
        <div className="p-12 text-center bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] space-y-3">
          <FilePlus2 className="w-12 h-12 mx-auto text-[var(--color-text-secondary)] opacity-40" />
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Belum ada termin bayar</h3>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mx-auto">
            {projectVendors.length === 0
              ? 'Tambahkan kontrak vendor terlebih dahulu sebelum membuat termin pembayaran.'
              : 'Atur termin pembayaran untuk vendor yang dipilih (misal: DP 30%, Progres 50%, Selesai 20%).'}
          </p>
          {canManage && projectVendors.length > 0 && (
            <Button onClick={handleOpenAdd} className="mt-2">
              Tambah Termin Pertama
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTerms.map((term, idx) => {
            const contract = projectVendors.find(pv => pv.id === term.projectVendorId);
            const calculatedNominal = term.amountType === 'Percentage' && contract
              ? ((term.percentageValue || 0) * (contract.contractValue || 0)) / 100
              : term.nominalValue || 0;

            const isFullyInvoiced = (term.invoicedAmount || 0) >= calculatedNominal && calculatedNominal > 0;

            return (
              <Card key={term.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {canManage && (
                    <div className="flex flex-col gap-1 text-[var(--color-text-secondary)]">
                      <button
                        onClick={() => handleMove(idx, 'up', filteredTerms)}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMove(idx, 'down', filteredTerms)}
                        disabled={idx === filteredTerms.length - 1}
                        className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm text-[var(--color-text-primary)]">
                        {term.termName}
                      </h4>
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-black/5 dark:bg-white/5 text-[var(--color-text-secondary)]">
                        {contract?.vendorName || 'Vendor'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[var(--color-text-secondary)]">
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        Trigger: {term.triggerType}
                      </span>
                      {term.triggerCondition && (
                        <span>• {term.triggerCondition}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                  <div className="text-right">
                    <span className="text-xs text-[var(--color-text-secondary)] block">
                      {term.amountType === 'Percentage' ? `${term.percentageValue}% Kontrak` : 'Nominal Pasti'}
                    </span>
                    {canSeeCost ? (
                      <span className="font-semibold text-sm text-[var(--color-text-primary)]">
                        Rp {calculatedNominal.toLocaleString('id-ID')}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-text-secondary)] italic">Terkunci</span>
                    )}

                    {term.invoicedAmount && term.invoicedAmount > 0 ? (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 justify-end">
                        <CheckCircle2 className="w-3 h-3" />
                        Ditagih: Rp {term.invoicedAmount.toLocaleString('id-ID')}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1">
                    {canManage && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleOpenGenerateBill(term)}
                          disabled={isFullyInvoiced}
                          className="text-xs flex items-center gap-1.5"
                          title="Generate Tagihan Vendor"
                        >
                          <FilePlus2 className="w-3.5 h-3.5" />
                          <span>Buat Tagihan</span>
                        </Button>

                        <button
                          onClick={() => handleOpenEdit(term)}
                          className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/10"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(term.id, term.termName)}
                          className="p-2 rounded-lg text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Add/Edit Term */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Termin Vendor' : 'Tambah Termin Vendor'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Pilih Kontrak Vendor *
            </label>
            <select
              {...register('projectVendorId')}
              className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)] text-[var(--color-text-primary)]"
            >
              {projectVendors.map(pv => (
                <option key={pv.id} value={pv.id} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">
                  {pv.vendorName} - {pv.scopeOfWork} (Rp {pv.contractValue.toLocaleString('id-ID')})
                </option>
              ))}
            </select>
            {errors.projectVendorId && (
              <p className="text-xs text-red-500 mt-1">{errors.projectVendorId.message}</p>
            )}
          </div>

          <Input
            label="Nama Termin *"
            placeholder="Contoh: DP 30% / Termin 1 / Pelunasan 100%"
            {...register('termName')}
            error={errors.termName?.message}
          />

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Trigger / Pemicu Pembayaran *
            </label>
            <select
              {...register('triggerType')}
              className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)] text-[var(--color-text-primary)]"
            >
              {TRIGGER_TYPES.map(trig => (
                <option key={trig} value={trig} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">
                  {trig}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Kondisi Pemicu Spesifik (Opsional)"
            placeholder="Contoh: Saat pondasi & kolom lantai 1 selesai dihitung"
            {...register('triggerCondition')}
            error={errors.triggerCondition?.message}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Tipe Nilai
              </label>
              <select
                {...register('amountType')}
                className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)] text-[var(--color-text-primary)]"
              >
                <option value="Percentage">Persentase (%)</option>
                <option value="Nominal">Nominal Tetap (Rp)</option>
              </select>
            </div>

            {watchedAmountType === 'Percentage' ? (
              <Input
                label="Persentase (%)"
                type="number"
                step="any"
                placeholder="50"
                {...register('percentageValue', { valueAsNumber: true })}
                error={errors.percentageValue?.message}
              />
            ) : (
              <Input
                label="Nominal (Rp)"
                type="number"
                step="any"
                placeholder="10000000"
                {...register('nominalValue', { valueAsNumber: true })}
                error={errors.nominalValue?.message}
              />
            )}
          </div>
          {errors.amountType && (
            <p className="text-xs text-red-500">{errors.amountType.message}</p>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border)]">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={!isValid}>
              {editingId ? 'Simpan Perubahan' : 'Buat Termin'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Generate Bill directly from Term */}
      <Modal
        isOpen={isBillModalOpen}
        onClose={() => setIsBillModalOpen(false)}
        title="Buat Tagihan Vendor Dari Termin"
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-1 text-xs">
            <p className="font-semibold text-blue-600 dark:text-blue-400">
              {targetContract?.vendorName} ({targetContract?.vendorType})
            </p>
            <p className="text-[var(--color-text-secondary)]">
              Termin: {targetTerm?.termName} ({targetTerm?.triggerType})
            </p>
          </div>

          <Input
            label="Jumlah Tagihan (Rp) *"
            type="number"
            step="any"
            value={billAmount.toString()}
            onChange={(e) => setBillAmount(parseFloat(e.target.value) || 0)}
            error={billAmount <= 0 ? 'Jumlah tagihan harus lebih besar dari 0' : undefined}
          />

          <Input
            label="Tanggal Jatuh Tempo *"
            type="date"
            value={billDueDate}
            onChange={(e) => setBillDueDate(e.target.value)}
            error={!billDueDate ? 'Tanggal jatuh tempo wajib diisi' : undefined}
          />

          <Input
            label="Catatan Tagihan"
            value={billNotes}
            onChange={(e) => setBillNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border)]">
            <Button variant="secondary" onClick={() => setIsBillModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleConfirmGenerateBill} disabled={billAmount <= 0 || !billDueDate}>
              Terbitkan Tagihan Vendor
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!termToDelete}
        onClose={() => setTermToDelete(null)}
        onConfirm={async () => {
          if (termToDelete) {
            try {
              await deleteVendorPaymentTerm(termToDelete.id);
              toast.success('Termin berhasil dihapus');
            } catch (err: any) {
              console.error(err);
              toast.error(err.message || 'Gagal menghapus termin');
            }
            setTermToDelete(null);
          }
        }}
        title="Konfirmasi Hapus Termin Vendor"
        message={`Apakah Anda yakin ingin menghapus termin "${termToDelete?.name || ''}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hapus Termin"
        cancelLabel="Batal"
        variant="danger"
      />
    </div>
  );
}
