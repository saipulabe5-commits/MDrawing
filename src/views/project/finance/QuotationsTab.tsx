import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFinance } from '../../../context/FinanceContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { useProjects } from '../../../context/ProjectContext';
import { useParams } from 'react-router-dom';
import { Button, Modal, Input, Badge } from '../../../components/ui';
import { Plus, Send, FileText, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { QuotationFormSchema, QuotationFormData } from '../../../lib/validationSchemas';
import { generateQuotationPdf } from '../../../lib/exportUtils';

export function QuotationsTab() {
  const { id: projectId } = useParams<{ id: string }>();
  const { projects } = useProjects();
  const project = projects.find(p => p.id === projectId);

  const { quotations, clients, createQuotation, updateQuotationStatus } = useFinance();
  const { canManageFinance } = usePermissions();
  const canEdit = canManageFinance();

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Scoped strictly to current active project only
  const projectQuotations = quotations.filter((q) => q.projectId === projectId);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid },
  } = useForm<QuotationFormData>({
    resolver: zodResolver(QuotationFormSchema) as any,
    defaultValues: {
      discount: 0,
      taxPercentage: 11,
      notes: '',
      items: [
        {
          id: Date.now().toString(),
          description: '',
          quantity: 1,
          unit: 'ls',
          unitPrice: 0,
          totalPrice: 0,
        },
      ],
    },
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = watch('items') || [];
  const watchedDiscount = watch('discount') || 0;
  const watchedTaxPercentage = watch('taxPercentage') || 0;

  const subTotal = watchedItems.reduce((acc, item) => {
    const q = Number(item.quantity) || 0;
    const p = Number(item.unitPrice) || 0;
    return acc + (q > 0 && p >= 0 ? q * p : 0);
  }, 0);
  const subAfterDiscount = Math.max(0, subTotal - (watchedDiscount >= 0 ? watchedDiscount : 0));
  const tax = (subAfterDiscount * Math.max(0, watchedTaxPercentage)) / 100;
  const grandTotal = subAfterDiscount + tax;

  const handleOpenModal = () => {
    if (!canEdit) {
      toast.error('Akses terbatas: Anda tidak memiliki wewenang membuat penawaran.');
      return;
    }
    reset({
      discount: 0,
      taxPercentage: 11,
      notes: '',
      items: [
        {
          id: Date.now().toString(),
          description: '',
          quantity: 1,
          unit: 'ls',
          unitPrice: 0,
          totalPrice: 0,
        },
      ],
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: QuotationFormData) => {
    if (!canEdit) {
      toast.error('Akses ditolak: Anda tidak memiliki wewenang membuat penawaran.');
      return;
    }
    try {
      const formattedItems = data.items.map(item => ({
        id: item.id || Date.now().toString(),
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * item.unitPrice,
      }));

      await createQuotation({
        items: formattedItems,
        discount: data.discount,
        taxPercentage: data.taxPercentage,
        notes: data.notes || '',
      });
      setIsModalOpen(false);
      toast.success('Penawaran berhasil dibuat');
    } catch (e: any) {
      toast.error('Gagal membuat penawaran: ' + e.message);
    }
  };

  const statusColors: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
    Draft: 'default',
    Sent: 'warning',
    Approved: 'success',
    Rejected: 'danger',
    Cancelled: 'default',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Penawaran (Quotation)</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">Kelola penawaran harga ke klien.</p>
        </div>
        <Button
          disabled={!canEdit}
          title={!canEdit ? 'Akses terbatas: Memerlukan izin Kelola Keuangan (Finance / Admin / Owner)' : undefined}
          onClick={handleOpenModal}
        >
          <Plus className="w-4 h-4 mr-2" /> Buat Penawaran
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
              <th className="py-3 px-4">Nomor</th>
              <th className="py-3 px-4">Tanggal</th>
              <th className="py-3 px-4">Total</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {projectQuotations.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[var(--color-text-secondary)]">
                  Belum ada penawaran untuk proyek ini.
                </td>
              </tr>
            ) : (
              projectQuotations.map((q) => (
                <tr key={q.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg)]">
                  <td className="py-3 px-4 font-medium">{q.quotationNumber}</td>
                  <td className="py-3 px-4">{new Date(q.date).toLocaleDateString()}</td>
                  <td className="py-3 px-4 font-medium">Rp {q.grandTotal.toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <Badge variant={statusColors[q.status]}>{q.status}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Lihat PDF"
                        onClick={() => {
                          if (project) {
                            const client = clients.find((c) => c.id === project.clientId);
                            generateQuotationPdf(q, project, client);
                          }
                        }}
                      >
                        <FileText className="w-4 h-4 text-blue-500" />
                      </Button>
                      {canEdit && q.status === 'Draft' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Tandai Terkirim"
                          onClick={() => updateQuotationStatus(q.id, 'Sent')}
                        >
                          <Send className="w-4 h-4 text-orange-500" />
                        </Button>
                      )}
                      {canEdit && q.status === 'Sent' && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Setujui"
                            onClick={() => updateQuotationStatus(q.id, 'Approved')}
                          >
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Tolak"
                            onClick={() => updateQuotationStatus(q.id, 'Rejected')}
                          >
                            <XCircle className="w-4 h-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Buat Penawaran" className="max-w-3xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
            {fields.map((field, i) => {
              const itemQuantity = Number(watchedItems[i]?.quantity) || 0;
              const itemUnitPrice = Number(watchedItems[i]?.unitPrice) || 0;
              const itemTotal = itemQuantity > 0 && itemUnitPrice >= 0 ? itemQuantity * itemUnitPrice : 0;

              return (
                <div key={field.id} className="bg-[var(--color-bg)] p-3 rounded-xl border border-[var(--color-border)] space-y-2">
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        placeholder="Deskripsi item pekerjaan *"
                        {...register(`items.${i}.description`)}
                        error={errors.items?.[i]?.description?.message}
                      />
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        placeholder="Qty"
                        step="any"
                        {...register(`items.${i}.quantity`, { valueAsNumber: true })}
                        error={errors.items?.[i]?.quantity?.message}
                      />
                    </div>
                    <div className="w-24">
                      <Input
                        placeholder="Satuan"
                        {...register(`items.${i}.unit`)}
                        error={errors.items?.[i]?.unit?.message}
                      />
                    </div>
                    <div className="w-36">
                      <Input
                        type="number"
                        placeholder="Harga Satuan"
                        step="any"
                        {...register(`items.${i}.unitPrice`, { valueAsNumber: true })}
                        error={errors.items?.[i]?.unitPrice?.message}
                      />
                    </div>
                    <div className="w-32 py-2 text-right font-medium text-[var(--color-text-primary)]">
                      Rp {itemTotal.toLocaleString()}
                    </div>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-red-500"
                        onClick={() => remove(i)}
                      >
                        <XCircle className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                append({
                  id: Date.now().toString(),
                  description: '',
                  quantity: 1,
                  unit: 'ls',
                  unitPrice: 0,
                  totalPrice: 0,
                })
              }
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" /> Tambah Item
            </Button>
            {errors.items?.message && (
              <p className="text-xs text-red-500 font-medium">{errors.items.message}</p>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-[var(--color-border)]">
            <div className="w-72 space-y-2 text-sm text-[var(--color-text-secondary)]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-medium text-[var(--color-text-primary)]">Rp {subTotal.toLocaleString()}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span>Diskon (Rp):</span>
                  <input
                    type="number"
                    step="any"
                    className="w-28 px-2 py-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md text-right text-[var(--color-text-primary)]"
                    {...register('discount', { valueAsNumber: true })}
                  />
                </div>
                {errors.discount && (
                  <p className="text-xs text-red-500 text-right">{errors.discount.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span>Pajak (%):</span>
                  <input
                    type="number"
                    step="any"
                    className="w-20 px-2 py-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md text-right text-[var(--color-text-primary)]"
                    {...register('taxPercentage', { valueAsNumber: true })}
                  />
                </div>
                {errors.taxPercentage && (
                  <p className="text-xs text-red-500 text-right">{errors.taxPercentage.message}</p>
                )}
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 text-[var(--color-text-primary)] border-t border-[var(--color-border)]">
                <span>Total:</span>
                <span>Rp {grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Catatan (Opsional)</label>
            <Input placeholder="Catatan atau syarat penawaran..." {...register('notes')} />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border)]">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={!isValid}>
              Simpan Draft
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
