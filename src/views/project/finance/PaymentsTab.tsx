import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from 'react-router-dom';
import { useFinance } from '../../../context/FinanceContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { Button, Modal, Select, Input, Badge } from '../../../components/ui';
import { Plus, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { ClientPaymentSchema, ClientPaymentFormData } from '../../../lib/validationSchemas';

export function PaymentsTab() {
  const { id: projectId } = useParams<{ id: string }>();
  const { clientPayments, invoices, createPayment, updatePaymentStatus } = useFinance();
  const { canManageFinance } = usePermissions();
  const canEdit = canManageFinance();

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Scoped strictly to current active project only
  const projectInvoices = invoices.filter(i => i.projectId === projectId);
  const projectPayments = clientPayments.filter(p => p.projectId === projectId);

  // Filter invoices for current project that are not paid or cancelled
  const activeInvoices = projectInvoices.filter(i => !['Paid', 'Void', 'Cancelled'].includes(i.status));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<ClientPaymentFormData>({
    resolver: zodResolver(ClientPaymentSchema) as any,
    defaultValues: {
      invoiceId: '',
      amount: 0,
      paymentMethod: 'Transfer Bank',
      paymentDate: new Date().toISOString().split('T')[0],
      referenceNumber: '',
      notes: '',
    },
    mode: 'onChange',
  });

  const handleOpenModal = () => {
    if (!canEdit) {
      toast.error('Akses terbatas: Anda tidak memiliki wewenang mencatat pembayaran.');
      return;
    }
    reset({
      invoiceId: activeInvoices[0]?.id || '',
      amount: 0,
      paymentMethod: 'Transfer Bank',
      paymentDate: new Date().toISOString().split('T')[0],
      referenceNumber: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: ClientPaymentFormData) => {
    if (!canEdit) {
      toast.error('Akses ditolak: Anda tidak memiliki wewenang mencatat pembayaran.');
      return;
    }

    try {
      await createPayment({
        invoiceId: data.invoiceId,
        amount: data.amount,
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber,
        notes: data.notes,
      });
      setIsModalOpen(false);
      toast.success('Pembayaran dicatat sebagai Draft');
    } catch (e: any) {
      toast.error('Gagal mencatat pembayaran: ' + e.message);
    }
  };

  const statusColors: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
    Draft: 'default',
    Confirmed: 'success',
    Cancelled: 'danger',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Pembayaran Klien</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">Catat penerimaan pembayaran dari klien.</p>
        </div>
        <Button
          disabled={!canEdit || activeInvoices.length === 0}
          title={
            !canEdit
              ? 'Akses terbatas: Memerlukan izin Kelola Keuangan (Finance / Admin / Owner)'
              : activeInvoices.length === 0
              ? 'Tidak ada invoice aktif yang dapat dibayarkan'
              : undefined
          }
          onClick={handleOpenModal}
        >
          <Plus className="w-4 h-4 mr-2" /> Catat Pembayaran
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
              <th className="py-3 px-4">Tgl Bayar</th>
              <th className="py-3 px-4">Nomor Invoice</th>
              <th className="py-3 px-4">Metode</th>
              <th className="py-3 px-4">Nominal</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {projectPayments.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[var(--color-text-secondary)]">
                  Belum ada catatan pembayaran untuk proyek ini.
                </td>
              </tr>
            ) : (
              projectPayments.map((pay) => {
                const inv = projectInvoices.find((i) => i.id === pay.invoiceId);
                return (
                  <tr key={pay.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg)]">
                    <td className="py-3 px-4">{new Date(pay.paymentDate).toLocaleDateString()}</td>
                    <td className="py-3 px-4">{inv?.invoiceNumber || 'Tidak diketahui'}</td>
                    <td className="py-3 px-4">{pay.paymentMethod}</td>
                    <td className="py-3 px-4 font-medium text-green-600">Rp {pay.amount.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <Badge variant={statusColors[pay.status]}>{pay.status}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        {canEdit && pay.status === 'Draft' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Konfirmasi Pembayaran"
                              onClick={() => updatePaymentStatus(pay.id, 'Confirmed')}
                            >
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Batalkan"
                              onClick={() => updatePaymentStatus(pay.id, 'Cancelled')}
                            >
                              <XCircle className="w-4 h-4 text-red-500" />
                            </Button>
                          </>
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Catat Pembayaran Masuk">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Pilih Invoice *</label>
            <Select
              {...register('invoiceId')}
              options={[
                { value: '', label: 'Pilih invoice...' },
                ...activeInvoices.map((i) => ({
                  value: i.id,
                  label: `${i.invoiceNumber} (Sisa: Rp ${(i.grandTotal - i.amountPaid).toLocaleString()})`,
                })),
              ]}
            />
            {errors.invoiceId && (
              <p className="text-xs text-red-500 mt-1">{errors.invoiceId.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Nominal Diterima *</label>
            <Input
              type="number"
              step="any"
              placeholder="Contoh: 1500000"
              {...register('amount', { valueAsNumber: true })}
              error={errors.amount?.message}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Metode Pembayaran *</label>
              <Select
                {...register('paymentMethod')}
                options={[
                  { value: 'Transfer Bank', label: 'Transfer Bank' },
                  { value: 'Cash', label: 'Cash' },
                  { value: 'Cek/Bilyet Giro', label: 'Cek/Bilyet Giro' },
                ]}
              />
              {errors.paymentMethod && (
                <p className="text-xs text-red-500 mt-1">{errors.paymentMethod.message}</p>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Tanggal Bayar *</label>
              <Input
                type="date"
                {...register('paymentDate')}
                error={errors.paymentDate?.message}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Catatan / Ref. No</label>
            <Input
              placeholder="Contoh: BCA TRF 0129310"
              {...register('referenceNumber')}
              error={errors.referenceNumber?.message}
            />
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
