import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useVendor } from '../../../context/VendorContext';
import { useProjects } from '../../../context/ProjectContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { VendorPayment, VendorBill, VendorPaymentStatus } from '../../../types';
import { Button, Modal, Input, Card } from '../../../components/ui';
import { Plus, Download, CheckCircle2, Clock, Ban, CreditCard, Receipt, Building2, Upload } from 'lucide-react';
import { generateVendorPaymentReceiptPdf } from '../../../lib/exportUtils';
import toast from 'react-hot-toast';
import { VendorPaymentSchema, VendorPaymentFormData } from '../../../lib/validationSchemas';

interface VendorPaymentsTabProps {
  projectId: string;
  initialSelectedBill?: VendorBill | null;
  onClearSelectedBill?: () => void;
}

const PAYMENT_METHODS = [
  'Transfer Bank',
  'Kas Kecil (Petty Cash)',
  'Cek / Bilyet Giro',
  'Lainnya'
];

export function VendorPaymentsTab({ 
  projectId, 
  initialSelectedBill,
  onClearSelectedBill 
}: VendorPaymentsTabProps) {
  const { projects } = useProjects();
  const currentProject = projects.find(p => p.id === projectId);
  const { 
    vendors, 
    projectVendors, 
    vendorBills, 
    vendorPayments, 
    createVendorPayment, 
    updateVendorPaymentStatus 
  } = useVendor();

  const { canManageFinance, canViewVendorPayment } = usePermissions();
  const canManage = canManageFinance();
  const canSeePayment = canViewVendorPayment();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isValid }
  } = useForm<VendorPaymentFormData>({
    resolver: zodResolver(VendorPaymentSchema) as any,
    defaultValues: {
      billId: '',
      paymentDate: new Date().toISOString().split('T')[0],
      amount: 0,
      paymentMethod: 'Transfer Bank',
      referenceNumber: '',
      bankSource: 'Rekening Operasional BCA',
      notes: '',
      status: 'Confirmed'
    },
    mode: 'onChange'
  });

  // Open modal if an initial bill is passed from Bills tab
  useEffect(() => {
    if (initialSelectedBill) {
      reset({
        billId: initialSelectedBill.id,
        paymentDate: new Date().toISOString().split('T')[0],
        amount: initialSelectedBill.remainingAmount > 0 ? initialSelectedBill.remainingAmount : initialSelectedBill.amount,
        paymentMethod: 'Transfer Bank',
        referenceNumber: '',
        bankSource: 'Rekening Operasional BCA',
        notes: `Pembayaran ${initialSelectedBill.billNumber}`,
        status: 'Confirmed'
      });
      setIsModalOpen(true);
      if (onClearSelectedBill) onClearSelectedBill();
    }
  }, [initialSelectedBill]);

  const handleOpenAdd = () => {
    if (!canManage) {
      toast.error('Akses terbatas: Anda tidak memiliki wewenang mencatat pembayaran vendor.');
      return;
    }
    const defaultBill = vendorBills.find(b => b.remainingAmount > 0 && !['Void', 'Cancelled'].includes(b.status)) || vendorBills[0];
    reset({
      billId: defaultBill ? defaultBill.id : '',
      paymentDate: new Date().toISOString().split('T')[0],
      amount: defaultBill ? (defaultBill.remainingAmount || defaultBill.amount) : 0,
      paymentMethod: 'Transfer Bank',
      referenceNumber: '',
      bankSource: 'Rekening Operasional BCA',
      notes: defaultBill ? `Pembayaran tagihan ${defaultBill.billNumber}` : '',
      status: 'Confirmed'
    });
    setIsModalOpen(true);
  };

  const handleBillSelect = (billId: string) => {
    const selected = vendorBills.find(b => b.id === billId);
    if (selected) {
      setValue('billId', selected.id, { shouldValidate: true });
      setValue('amount', selected.remainingAmount > 0 ? selected.remainingAmount : selected.amount, { shouldValidate: true });
      setValue('notes', `Pembayaran ${selected.billNumber}`);
    }
  };

  const onSubmit = async (data: VendorPaymentFormData) => {
    if (!canManage) {
      toast.error('Akses ditolak: Anda tidak memiliki wewenang mencatat pembayaran vendor.');
      return;
    }

    try {
      const selectedBill = vendorBills.find(b => b.id === data.billId);
      await createVendorPayment({
        ...data,
        projectVendorId: selectedBill?.projectVendorId,
        vendorId: selectedBill?.vendorId
      } as any);

      toast.success('Pembayaran vendor berhasil dicatat');
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Gagal mencatat pembayaran');
    }
  };

  const handleDownloadReceipt = (payment: VendorPayment) => {
    const bill = vendorBills.find(b => b.id === payment.billId);
    const vendor = vendors.find(v => v.id === payment.vendorId);
    generateVendorPaymentReceiptPdf(payment, bill, vendor, currentProject || undefined);
    toast.success('Mengunduh Bukti Pengeluaran Kas...');
  };

  const handleStatusChange = async (paymentId: string, status: VendorPaymentStatus) => {
    if (!canManage) return;
    try {
      await updateVendorPaymentStatus(paymentId, status);
      toast.success(`Status pembayaran diubah menjadi ${status}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Gagal mengubah status');
    }
  };

  const activeBills = vendorBills.filter(b => !['Void', 'Cancelled'].includes(b.status));

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Pembayaran Vendor (Vendor Payments)
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Riwayat realisasi pengeluaran kas kepada vendor dan subkon proyek
          </p>
        </div>

        <Button 
          disabled={!canManage || activeBills.length === 0}
          title={
            !canManage 
              ? "Akses terbatas: Memerlukan izin Kelola Keuangan (Finance / Admin / Owner)" 
              : activeBills.length === 0 
                ? "Tidak ada tagihan vendor aktif yang perlu dibayarkan" 
                : undefined
          }
          onClick={handleOpenAdd} 
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Catat Pembayaran Baru</span>
        </Button>
      </div>

      {/* Payments List */}
      {vendorPayments.length === 0 ? (
        <div className="p-12 text-center bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] space-y-3">
          <Receipt className="w-12 h-12 mx-auto text-[var(--color-text-secondary)] opacity-40" />
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Belum ada realisasi pembayaran vendor</h3>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mx-auto">
            Catat bukti transfer atau pengeluaran kas setelah tagihan vendor diverifikasi dan dibayarkan.
          </p>
          {canManage && activeBills.length > 0 && (
            <Button onClick={handleOpenAdd} className="mt-2">
              Catat Pembayaran Pertama
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {vendorPayments.map((payment) => {
            const bill = vendorBills.find(b => b.id === payment.billId);
            const vendor = vendors.find(v => v.id === payment.vendorId);
            const pv = projectVendors.find(p => p.id === payment.projectVendorId);

            return (
              <Card key={payment.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-[var(--color-text-primary)]">
                      {payment.paymentNumber}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      payment.status === 'Confirmed'
                        ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60'
                        : payment.status === 'Draft'
                        ? 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700/60'
                    }`}>
                      {payment.status}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      Ref Tagihan: <span className="font-medium text-[var(--color-text-primary)]">{bill?.billNumber || '-'}</span>
                    </span>
                  </div>

                  <div className="text-xs text-[var(--color-text-secondary)] flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-medium text-[var(--color-text-primary)]">
                      Penerima: {vendor?.vendorName || pv?.vendorName || 'Rekanan'}
                    </span>
                    <span>Tgl: {new Date(payment.paymentDate).toLocaleDateString('id-ID')}</span>
                    <span>Metode: {payment.paymentMethod}</span>
                    {payment.bankSource && <span>Sumber: {payment.bankSource}</span>}
                    {payment.referenceNumber && <span>No. Ref: {payment.referenceNumber}</span>}
                  </div>

                  {payment.notes && (
                    <p className="text-xs text-[var(--color-text-secondary)] bg-black/5 dark:bg-white/5 p-1.5 rounded-md">
                      {payment.notes}
                    </p>
                  )}
                </div>

                {/* Amount & Actions */}
                <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[var(--color-border)]">
                  <div className="text-right">
                    <span className="text-[11px] text-[var(--color-text-secondary)] block">Jumlah Dibayar</span>
                    {canSeePayment ? (
                      <span className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                        Rp {payment.amount.toLocaleString('id-ID')}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-text-secondary)] italic">Terkunci</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDownloadReceipt(payment)}
                      className="text-xs flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Bukti Kas</span>
                    </Button>

                    {canManage && payment.status === 'Draft' && (
                      <Button
                        size="sm"
                        onClick={() => handleStatusChange(payment.id, 'Confirmed')}
                        className="text-xs"
                      >
                        Konfirmasi
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Add Payment */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Catat Realisasi Pembayaran Vendor"
      >
        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Pilih Tagihan Vendor *
            </label>
            <select
              {...register('billId')}
              onChange={(e) => handleBillSelect(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)] text-[var(--color-text-primary)]"
            >
              {activeBills.map(b => {
                const pv = projectVendors.find(p => p.id === b.projectVendorId);
                return (
                  <option key={b.id} value={b.id} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">
                    {b.billNumber} - {pv?.vendorName} (Sisa: Rp {b.remainingAmount.toLocaleString('id-ID')})
                  </option>
                );
              })}
            </select>
            {errors.billId && (
              <p className="text-xs text-red-500 mt-1">{errors.billId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Tanggal Pembayaran *"
              type="date"
              {...register('paymentDate')}
              error={errors.paymentDate?.message}
            />

            <Input
              label="Nominal Pembayaran (Rp) *"
              type="number"
              step="any"
              placeholder="0"
              {...register('amount', { valueAsNumber: true })}
              error={errors.amount?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Metode Pembayaran
              </label>
              <select
                {...register('paymentMethod')}
                className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)] text-[var(--color-text-primary)]"
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m} value={m} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Sumber Rekening / Kas"
              placeholder="Contoh: BCA 123456789 atau Kas Kecil"
              {...register('bankSource')}
            />
          </div>

          <Input
            label="Nomor Referensi Transfer / Cek"
            placeholder="No. Ref / Bukti Transfer"
            {...register('referenceNumber')}
          />

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Catatan Pembayaran
            </label>
            <textarea
              rows={2}
              placeholder="Keterangan transfer atau rincian potongan"
              {...register('notes')}
              className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)] text-[var(--color-text-primary)]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border)]">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={!isValid}>
              Simpan Pembayaran
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
