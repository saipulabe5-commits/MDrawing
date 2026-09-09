import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFinance } from '../../../context/FinanceContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { Button, Modal, Input, Select } from '../../../components/ui';
import { Plus, GripVertical, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { FinanceTerm, FinanceTermTrigger } from '../../../types';
import { FinanceTermSchema, FinanceTermFormData } from '../../../lib/validationSchemas';

export function FinanceTermsTab() {
  const { financeTerms, createFinanceTerm, deleteFinanceTerm } = useFinance();
  const { canManageFinance } = usePermissions();
  const canEdit = canManageFinance();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid },
  } = useForm<FinanceTermFormData>({
    resolver: zodResolver(FinanceTermSchema) as any,
    defaultValues: {
      termName: '',
      triggerType: 'Manual',
      triggerCondition: '',
      amountType: 'Percentage',
      percentageValue: 0,
      nominalValue: 0,
      sortOrder: 1,
    },
    mode: 'onChange',
  });

  const watchedTriggerType = watch('triggerType');
  const watchedAmountType = watch('amountType');

  const handleOpenModal = () => {
    reset({
      termName: '',
      triggerType: 'Manual',
      triggerCondition: '',
      amountType: 'Percentage',
      percentageValue: 0,
      nominalValue: 0,
      sortOrder: financeTerms.length + 1,
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: FinanceTermFormData) => {
    if (!canEdit) {
      toast.error('Akses ditolak: Anda tidak memiliki wewenang mengelola keuangan.');
      return;
    }

    try {
      await createFinanceTerm({
        termName: data.termName,
        triggerType: data.triggerType as FinanceTermTrigger,
        triggerCondition: data.triggerCondition || '',
        amountType: data.amountType,
        percentageValue: data.amountType === 'Percentage' ? data.percentageValue : undefined,
        nominalValue: data.amountType === 'Nominal' ? data.nominalValue : undefined,
        sortOrder: financeTerms.length + 1,
      });
      setIsModalOpen(false);
      toast.success('Termin berhasil ditambahkan');
    } catch (e: any) {
      toast.error('Gagal menambahkan termin: ' + e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus termin ini?')) return;
    try {
      await deleteFinanceTerm(id);
      toast.success('Termin dihapus');
    } catch (e: any) {
      toast.error('Gagal menghapus: ' + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Termin Pembayaran</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">Atur skema dan jadwal pembayaran proyek.</p>
        </div>
        {canEdit && (
          <Button onClick={handleOpenModal}>
            <Plus className="w-4 h-4 mr-2" /> Tambah Termin
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {financeTerms.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)] italic">Belum ada termin pembayaran.</p>
        ) : (
          financeTerms.map((term) => (
            <div
              key={term.id}
              className="flex items-center gap-4 p-4 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg)]"
            >
              {canEdit && <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />}
              <div className="flex-1">
                <div className="font-medium text-[var(--color-text-primary)]">{term.termName}</div>
                <div className="text-sm text-[var(--color-text-secondary)]">
                  Trigger: {term.triggerType} {term.triggerCondition && `(${term.triggerCondition})`}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-[var(--color-text-primary)]">
                  {term.amountType === 'Percentage'
                    ? `${term.percentageValue}%`
                    : `Rp ${term.nominalValue?.toLocaleString()}`}
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  Invoiced: Rp {(term.invoicedAmount || 0).toLocaleString()}
                </div>
              </div>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(term.id)}
                  className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Tambah Termin Pembayaran">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Nama Termin *</label>
            <Input
              placeholder="Contoh: DP 30%"
              {...register('termName')}
              error={errors.termName?.message}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Kondisi Trigger</label>
            <Select
              {...register('triggerType')}
              options={[
                { value: 'Manual', label: 'Manual' },
                { value: 'On Quotation Approved', label: 'Setelah Penawaran Disetujui' },
                { value: 'On Project Start', label: 'Saat Proyek Dimulai' },
                { value: 'On Drawing Progress', label: 'Berdasarkan Progress Gambar' },
                { value: 'On Drawing Final', label: 'Saat Semua Gambar Final' },
              ]}
            />
          </div>
          {watchedTriggerType === 'On Drawing Progress' && (
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Progress (%)</label>
              <Input
                type="number"
                placeholder="Contoh: 50"
                {...register('triggerCondition')}
                error={errors.triggerCondition?.message}
              />
            </div>
          )}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Tipe Nilai</label>
              <Select
                {...register('amountType')}
                options={[
                  { value: 'Percentage', label: 'Persentase (%)' },
                  { value: 'Nominal', label: 'Nominal (Rp)' },
                ]}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Nilai *</label>
              {watchedAmountType === 'Percentage' ? (
                <div>
                  <Input
                    type="number"
                    step="any"
                    placeholder="Contoh: 30"
                    {...register('percentageValue', { valueAsNumber: true })}
                    error={errors.percentageValue?.message}
                  />
                </div>
              ) : (
                <div>
                  <Input
                    type="number"
                    step="any"
                    placeholder="Contoh: 5000000"
                    {...register('nominalValue', { valueAsNumber: true })}
                    error={errors.nominalValue?.message}
                  />
                </div>
              )}
            </div>
          </div>
          {errors.amountType && (
            <p className="text-xs text-red-500">{errors.amountType.message}</p>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border)]">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={!isValid}>
              Simpan
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
