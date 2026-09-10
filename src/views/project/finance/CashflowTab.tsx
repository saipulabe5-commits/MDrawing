import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFinance } from '../../../context/FinanceContext';
import { useVendor } from '../../../context/VendorContext';
import { useExpense } from '../../../context/ExpenseContext';
import { useProjects } from '../../../context/ProjectContext';
import { useDocument } from '../../../context/DocumentContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { CashflowEntry, CashflowType, CashflowCategory } from '../../../types';
import { Button, Modal, Input, Badge, ConfirmModal } from '../../../components/ui';
import { Download, Plus, ArrowDownLeft, ArrowUpRight, DollarSign, Calendar, Trash2 } from 'lucide-react';
import { generateCashflowReportPdf } from '../../../lib/exportUtils';
import toast from 'react-hot-toast';
import { CashflowEntrySchema, CashflowEntryFormData } from '../../../lib/validationSchemas';

interface UnifiedCashflowItem {
  id: string;
  date: string;
  type: CashflowType;
  category: string;
  referenceType: string;
  referenceNumber: string;
  description: string;
  amount: number;
  isManual?: boolean;
  runningBalance?: number;
}

export function CashflowTab() {
  const { id: projectId } = useParams<{ id: string }>();
  const { projects } = useProjects();
  const { clientPayments } = useFinance();
  const { vendorPayments, vendorBills, vendors } = useVendor();
  const { expenses, cashflowEntries, createCashflowEntry, deleteCashflowEntry } = useExpense();
  const { companySettings, recordGeneratedDocument } = useDocument();
  const { canEditFinance, currentUser } = usePermissions();

  const project = projects.find((p) => p.id === projectId);

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterType, setFilterType] = useState<string>('ALL');

  // Modal manual entry
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid }
  } = useForm<CashflowEntryFormData>({
    resolver: zodResolver(CashflowEntrySchema) as any,
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      type: 'IN',
      category: 'Modal/Injeksi',
      referenceNumber: '',
      description: '',
      amount: 0,
      referenceType: 'Manual',
    },
    mode: 'onChange'
  });

  const handleOpenAdd = () => {
    reset({
      date: new Date().toISOString().slice(0, 10),
      type: 'IN',
      category: 'Modal/Injeksi',
      referenceNumber: '',
      description: '',
      amount: 0,
      referenceType: 'Manual',
    });
    setIsModalOpen(true);
  };

  // Aggregate all cash movements
  const unifiedEntries: UnifiedCashflowItem[] = useMemo(() => {
    const list: UnifiedCashflowItem[] = [];

    // 1. Client Payments (IN)
    clientPayments.forEach((cp) => {
      if (cp.status === 'Confirmed') {
        list.push({
          id: `cp-${cp.id}`,
          date: cp.paymentDate,
          type: 'IN',
          category: 'Pembayaran Klien',
          referenceType: 'Kwitansi Klien',
          referenceNumber: cp.paymentNumber,
          description: `Pembayaran Klien via ${cp.paymentMethod || 'Transfer'} (Ref: ${cp.referenceNumber || '-'})`,
          amount: cp.amount,
          isManual: false,
        });
      }
    });

    // 2. Vendor Payments (OUT)
    const billMap = new Map(vendorBills.map((b) => [b.id, b]));
    const vendorMap = new Map(vendors.map((v) => [v.id, v]));

    vendorPayments.forEach((vp) => {
      if (vp.status === 'Confirmed') {
        const bill = billMap.get(vp.billId);
        const v = vendorMap.get(vp.vendorId);
        list.push({
          id: `vp-${vp.id}`,
          date: vp.paymentDate,
          type: 'OUT',
          category: 'Pembayaran Vendor/Subkon',
          referenceType: 'Kas Keluar Vendor',
          referenceNumber: vp.paymentNumber,
          description: `Bayar ke ${v?.vendorName || 'Subkon'} (Tagihan: ${bill?.billNumber || '-'})`,
          amount: vp.amount,
          isManual: false,
        });
      }
    });

    // 3. Project Expenses (OUT)
    expenses.forEach((exp) => {
      if (exp.status === 'Approved' || exp.status === 'Paid') {
        list.push({
          id: `exp-${exp.id}`,
          date: exp.expenseDate,
          type: 'OUT',
          category: `Biaya: ${exp.expenseCategory}`,
          referenceType: 'Pengeluaran Proyek',
          referenceNumber: exp.expenseNumber,
          description: `${exp.description} ${exp.paidTo ? `(Penerima: ${exp.paidTo})` : ''}`,
          amount: exp.amount,
          isManual: false,
        });
      }
    });

    // 4. Manual Cashflow entries
    cashflowEntries.forEach((ce) => {
      list.push({
        id: ce.id,
        date: ce.date,
        type: ce.type,
        category: ce.category,
        referenceType: ce.referenceType || 'Manual',
        referenceNumber: ce.referenceNumber || 'MANUAL',
        description: ce.description,
        amount: ce.amount,
        isManual: true,
      });
    });

    // Chronological sort to calculate running balances accurately
    list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    list.forEach((item) => {
      if (item.type === 'IN') {
        running += item.amount;
      } else {
        running -= item.amount;
      }
      item.runningBalance = running;
    });

    return list;
  }, [clientPayments, vendorPayments, vendorBills, vendors, expenses, cashflowEntries]);

  // Totals
  const totalIn = unifiedEntries.filter((e) => e.type === 'IN').reduce((acc, e) => acc + e.amount, 0);
  const totalOut = unifiedEntries.filter((e) => e.type === 'OUT').reduce((acc, e) => acc + e.amount, 0);
  const netBalance = totalIn - totalOut;

  // Final display list sorted according to user preference
  const displayEntries = useMemo(() => {
    let filtered = [...unifiedEntries];
    if (filterType !== 'ALL') {
      filtered = filtered.filter((e) => e.type === filterType);
    }
    if (sortOrder === 'desc') {
      return filtered.reverse();
    }
    return filtered;
  }, [unifiedEntries, filterType, sortOrder]);

  const handleExportPdf = () => {
    if (!project) return;
    const exportData: CashflowEntry[] = unifiedEntries.map((item) => ({
      id: item.id,
      projectId: project.id,
      date: item.date,
      type: item.type,
      category: item.category as any,
      referenceType: item.referenceType as any,
      referenceNumber: item.referenceNumber,
      description: item.description,
      amount: item.amount,
      createdAt: new Date().toISOString(),
    }));

    generateCashflowReportPdf(
      project,
      exportData,
      { totalIn, totalOut, balance: netBalance },
      companySettings
    );

    recordGeneratedDocument({
      projectId: project.id,
      projectName: project.projectName,
      documentType: 'CashflowReport',
      documentNumber: `CASHFLOW-${project.projectCode}-${new Date().toISOString().slice(0, 10)}`,
      title: `Laporan Arus Kas - ${project.projectName}`,
      version: 1,
      fileFormat: 'PDF',
      createdBy: currentUser?.uid || '',
      createdByName: currentUser?.name || 'User',
    });

    toast.success('Laporan Arus Kas PDF berhasil diunduh');
  };

  const onSubmit = async (data: CashflowEntryFormData) => {
    try {
      await createCashflowEntry({
        projectId,
        date: data.date,
        type: data.type,
        category: data.category,
        referenceType: 'Manual',
        referenceNumber: data.referenceNumber || 'MANUAL',
        description: data.description,
        amount: data.amount,
      });
      toast.success('Transaksi arus kas manual berhasil dicatat');
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan transaksi');
    }
  };

  const handleDeleteManual = (id: string) => {
    setEntryToDelete(id);
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white/70 dark:bg-white/5 border border-[var(--color-border)] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-secondary)] font-medium">Total Kas Masuk (Inflow)</span>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              Rp {totalIn.toLocaleString('id-ID')}
            </p>
            <span className="text-[11px] text-[var(--color-text-secondary)]">
              {unifiedEntries.filter((e) => e.type === 'IN').length} Transaksi Masuk
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/70 dark:bg-white/5 border border-[var(--color-border)] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-secondary)] font-medium">Total Kas Keluar (Outflow)</span>
            <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              Rp {totalOut.toLocaleString('id-ID')}
            </p>
            <span className="text-[11px] text-[var(--color-text-secondary)]">
              {unifiedEntries.filter((e) => e.type === 'OUT').length} Transaksi Keluar
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/70 dark:bg-white/5 border border-[var(--color-border)] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-secondary)] font-medium">Saldo Kas Berjalan</span>
            <p className={`text-xl font-bold mt-0.5 ${netBalance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>
              Rp {netBalance.toLocaleString('id-ID')}
            </p>
            <span className="text-[11px] text-[var(--color-text-secondary)]">
              {netBalance >= 0 ? 'Arus kas positif' : 'Defisit kas berjalan!'}
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs h-9 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
          >
            <option value="ALL">Semua Aliran (In & Out)</option>
            <option value="IN">Kas Masuk (IN) Saja</option>
            <option value="OUT">Kas Keluar (OUT) Saja</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="text-xs h-9 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            {sortOrder === 'asc' ? 'Urutan: Lama ke Baru' : 'Urutan: Baru ke Lama'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportPdf}>
            <Download className="w-4 h-4 mr-1.5" />
            Cetak Cashflow PDF
          </Button>
          {canEditFinance() && (
            <Button size="sm" onClick={handleOpenAdd}>
              <Plus className="w-4 h-4 mr-1.5" />
              Catat Arus Kas Manual
            </Button>
          )}
        </div>
      </div>

      {/* Cashflow Ledger Table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--color-bg)]/80 text-[var(--color-text-secondary)] text-xs border-b border-[var(--color-border)]">
            <tr>
              <th className="py-3 px-4">Tanggal</th>
              <th className="py-3 px-4">Ref/No. Dokumen</th>
              <th className="py-3 px-4">Kategori & Tipe</th>
              <th className="py-3 px-4">Uraian Transaksi</th>
              <th className="py-3 px-4 text-right">Kas Masuk (In)</th>
              <th className="py-3 px-4 text-right">Kas Keluar (Out)</th>
              <th className="py-3 px-4 text-right">Saldo Berjalan</th>
              <th className="py-3 px-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {displayEntries.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[var(--color-text-secondary)]">
                  Belum ada transaksi arus kas pada proyek ini.
                </td>
              </tr>
            ) : (
              displayEntries.map((item) => (
                <tr key={item.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 text-xs font-medium text-[var(--color-text-primary)]">
                    {new Date(item.date).toLocaleDateString('id-ID')}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-[var(--color-text-secondary)]">
                    {item.referenceNumber || '-'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          item.type === 'IN' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      <span className="text-xs font-medium text-[var(--color-text-primary)]">
                        {item.category}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-[var(--color-text-secondary)]">
                    {item.description}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                    {item.type === 'IN' ? `Rp ${item.amount.toLocaleString('id-ID')}` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-rose-600 dark:text-rose-400">
                    {item.type === 'OUT' ? `Rp ${item.amount.toLocaleString('id-ID')}` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-xs text-[var(--color-text-primary)]">
                    Rp {(item.runningBalance || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {item.isManual && canEditFinance() ? (
                      <button
                        onClick={() => handleDeleteManual(item.id)}
                        className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        title="Hapus Transaksi Manual"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-xs text-[var(--color-text-secondary)]">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Manual Entry */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Catat Transaksi Arus Kas Manual"
      >
        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                Tanggal Transaksi *
              </label>
              <Input
                type="date"
                {...register('date')}
                error={errors.date?.message}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                Jenis Aliran Kas *
              </label>
              <select
                {...register('type')}
                className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm"
              >
                <option value="IN">Kas Masuk (IN)</option>
                <option value="OUT">Kas Keluar (OUT)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                Kategori Kas *
              </label>
              <select
                {...register('category')}
                className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm"
              >
                <option value="Modal/Injeksi">Modal/Injeksi</option>
                <option value="Client Payment">Pembayaran Klien Tambahan</option>
                <option value="Operasional Kantor">Operasional Kantor</option>
                <option value="Project Expense">Pengeluaran Lain Proyek</option>
                <option value="Lain-lain">Lain-lain</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                Jumlah Transaksi (Rp) *
              </label>
              <Input
                type="number"
                step="any"
                placeholder="Contoh: 10000000"
                {...register('amount', { valueAsNumber: true })}
                error={errors.amount?.message}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
              Nomor Referensi / Bukti (Opsional)
            </label>
            <Input
              placeholder="Contoh: BKM-001 / BKK-001 / TRF-BCA-987"
              {...register('referenceNumber')}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
              Uraian / Deskripsi *
            </label>
            <Input
              placeholder="Contoh: Injeksi modal operasional awal proyek"
              {...register('description')}
              error={errors.description?.message}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border)]">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={!isValid}>
              Simpan Transaksi Kas
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!entryToDelete}
        onClose={() => setEntryToDelete(null)}
        onConfirm={async () => {
          if (entryToDelete) {
            try {
              await deleteCashflowEntry(entryToDelete);
              toast.success('Transaksi berhasil dihapus');
            } catch (err: any) {
              toast.error(err.message || 'Gagal menghapus transaksi');
            }
            setEntryToDelete(null);
          }
        }}
        title="Konfirmasi Hapus Transaksi Kas"
        message="Apakah Anda yakin ingin menghapus transaksi arus kas manual ini? Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Ya, Hapus"
        cancelLabel="Batal"
        variant="danger"
      />
    </div>
  );
}
