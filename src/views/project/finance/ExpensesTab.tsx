import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useExpense } from '../../../context/ExpenseContext';
import { useProjects } from '../../../context/ProjectContext';
import { useDocument } from '../../../context/DocumentContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { ProjectExpense, ProjectExpenseCategory, ProjectExpenseStatus } from '../../../types';
import { Button, Card, Modal, Input, Badge, ConfirmModal } from '../../../components/ui';
import { Plus, Download, Trash2, Edit2, FileText, CheckCircle, ExternalLink, Paperclip } from 'lucide-react';
import { generateExpenseReportPdf } from '../../../lib/exportUtils';
import toast from 'react-hot-toast';
import { ProjectExpenseSchema, ProjectExpenseFormData } from '../../../lib/validationSchemas';

const CATEGORIES: ProjectExpenseCategory[] = [
  'Site Visit',
  'Printing',
  'Konsumsi',
  'Transport',
  'Software License',
  'Alat Kantor',
  'Subkon Lainnya',
  'Lain-lain',
];

export function ExpensesTab() {
  const { id: projectId } = useParams<{ id: string }>();
  const { projects } = useProjects();
  const { expenses, loadingExpense, createExpense, updateExpense, deleteExpense, updateExpenseStatus } = useExpense();
  const { companySettings, recordGeneratedDocument } = useDocument();
  const { canEditFinance, canApproveFinance, currentUser } = usePermissions();

  const project = projects.find((p) => p.id === projectId);

  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ProjectExpense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<{ id: string; number: string } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid }
  } = useForm<ProjectExpenseFormData>({
    resolver: zodResolver(ProjectExpenseSchema) as any,
    defaultValues: {
      expenseDate: new Date().toISOString().slice(0, 10),
      expenseCategory: 'Site Visit',
      amount: 0,
      description: '',
      paidTo: '',
      paymentMethod: 'Kas/Cash',
      attachmentUrl: '',
      isReimbursable: false,
      status: 'Draft',
    },
    mode: 'onChange'
  });

  const handleOpenAdd = () => {
    setEditingExpense(null);
    reset({
      expenseDate: new Date().toISOString().slice(0, 10),
      expenseCategory: 'Site Visit',
      amount: 0,
      description: '',
      paidTo: '',
      paymentMethod: 'Kas/Cash',
      attachmentUrl: '',
      isReimbursable: false,
      status: 'Draft',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (exp: ProjectExpense) => {
    setEditingExpense(exp);
    reset({
      expenseDate: exp.expenseDate,
      expenseCategory: exp.expenseCategory,
      amount: exp.amount,
      description: exp.description,
      paidTo: exp.paidTo || '',
      paymentMethod: exp.paymentMethod || 'Kas/Cash',
      attachmentUrl: exp.attachmentUrl || '',
      isReimbursable: Boolean(exp.isReimbursable),
      status: exp.status,
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: ProjectExpenseFormData) => {
    if (!canEditFinance()) {
      toast.error('Akses ditolak: Anda tidak memiliki wewenang mencatat pengeluaran.');
      return;
    }

    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, {
          expenseDate: data.expenseDate,
          expenseCategory: data.expenseCategory,
          amount: data.amount,
          description: data.description,
          paidTo: data.paidTo,
          paymentMethod: data.paymentMethod,
          attachmentUrl: data.attachmentUrl,
          isReimbursable: data.isReimbursable,
          status: data.status,
        });
        toast.success('Biaya pengeluaran berhasil diperbarui');
      } else {
        await createExpense({
          projectId,
          expenseDate: data.expenseDate,
          expenseCategory: data.expenseCategory,
          amount: data.amount,
          description: data.description,
          paidTo: data.paidTo,
          paymentMethod: data.paymentMethod,
          attachmentUrl: data.attachmentUrl,
          isReimbursable: data.isReimbursable,
          status: data.status,
        });
        toast.success('Pengeluaran baru berhasil dicatat');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan pengeluaran');
    }
  };

  const handleDelete = (id: string, number: string) => {
    if (!canEditFinance()) {
      toast.error('Akses ditolak: Anda tidak memiliki wewenang menghapus pengeluaran.');
      return;
    }
    setExpenseToDelete({ id, number });
  };

  const handleExportPdf = () => {
    if (!project) return;
    generateExpenseReportPdf(project, expenses, companySettings);
    recordGeneratedDocument({
      projectId: project.id,
      projectName: project.projectName,
      documentType: 'ExpenseReport',
      documentNumber: `EXP-REP-${project.projectCode}-${new Date().toISOString().slice(0, 10)}`,
      title: `Laporan Biaya Operasional - ${project.projectName}`,
      version: 1,
      fileFormat: 'PDF',
      createdBy: currentUser?.uid || '',
      createdByName: currentUser?.name || 'User',
    });
    toast.success('Laporan Biaya Operasional PDF berhasil diunduh');
  };

  // Filter list
  const filtered = expenses.filter((e) => {
    if (filterCategory !== 'ALL' && e.expenseCategory !== filterCategory) return false;
    if (filterStatus !== 'ALL' && e.status !== filterStatus) return false;
    return true;
  });

  // Financial calculations
  const totalApprovedPaid = expenses
    .filter((e) => e.status === 'Approved' || e.status === 'Paid')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalAll = expenses
    .filter((e) => e.status !== 'Cancelled')
    .reduce((sum, e) => sum + e.amount, 0);

  const budget = project?.budgetOtherExpenses || 0;
  const remainingBudget = budget - totalApprovedPaid;
  const budgetPercentage = budget > 0 ? (totalApprovedPaid / budget) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white/70 dark:bg-white/5 border border-[var(--color-border)] shadow-xs">
          <span className="text-xs text-[var(--color-text-secondary)] font-medium">Anggaran Operasional</span>
          <p className="text-xl font-bold text-[var(--color-text-primary)] mt-1">
            Rp {budget.toLocaleString('id-ID')}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-white/70 dark:bg-white/5 border border-[var(--color-border)] shadow-xs">
          <span className="text-xs text-[var(--color-text-secondary)] font-medium">Realisasi Disetujui/Dibayar</span>
          <p className="text-xl font-bold text-amber-500 mt-1">
            Rp {totalApprovedPaid.toLocaleString('id-ID')}
          </p>
          <span className="text-[11px] text-[var(--color-text-secondary)]">
            {budgetPercentage.toFixed(1)}% dari anggaran
          </span>
        </div>
        <div className="p-4 rounded-xl bg-white/70 dark:bg-white/5 border border-[var(--color-border)] shadow-xs">
          <span className="text-xs text-[var(--color-text-secondary)] font-medium">Sisa Anggaran</span>
          <p className={`text-xl font-bold mt-1 ${remainingBudget < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            Rp {remainingBudget.toLocaleString('id-ID')}
          </p>
          {remainingBudget < 0 && (
            <span className="text-[11px] text-red-500 font-medium">Over budget!</span>
          )}
        </div>
        <div className="p-4 rounded-xl bg-white/70 dark:bg-white/5 border border-[var(--color-border)] shadow-xs">
          <span className="text-xs text-[var(--color-text-secondary)] font-medium">Total Item Pengeluaran</span>
          <p className="text-xl font-bold text-[var(--color-text-primary)] mt-1">
            {expenses.length} Transaksi
          </p>
          <span className="text-[11px] text-[var(--color-text-secondary)]">
            Total tercatat: Rp {totalAll.toLocaleString('id-ID')}
          </span>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-xs h-9 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
          >
            <option value="ALL">Semua Kategori</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs h-9 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
          >
            <option value="ALL">Semua Status</option>
            <option value="Draft">Draft</option>
            <option value="Approved">Approved</option>
            <option value="Paid">Paid</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportPdf}>
            <Download className="w-4 h-4 mr-1.5" />
            Cetak Laporan PDF
          </Button>
          <Button 
            size="sm" 
            disabled={!canEditFinance()}
            title={!canEditFinance() ? "Akses terbatas: Memerlukan izin Kelola Keuangan (Finance / Admin / Owner)" : undefined}
            onClick={() => {
              if (!canEditFinance()) {
                toast.error('Akses terbatas: Anda tidak memiliki wewenang mencatat pengeluaran.');
                return;
              }
              handleOpenAdd();
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Catat Pengeluaran
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--color-bg)]/80 text-[var(--color-text-secondary)] text-xs border-b border-[var(--color-border)]">
            <tr>
              <th className="py-3 px-4">No. Bukti</th>
              <th className="py-3 px-4">Tanggal</th>
              <th className="py-3 px-4">Kategori</th>
              <th className="py-3 px-4">Uraian & Penerima</th>
              <th className="py-3 px-4 text-right">Jumlah</th>
              <th className="py-3 px-4">Metode</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-center">Bukti</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-[var(--color-text-secondary)]">
                  Belum ada catatan biaya operasional proyek.
                </td>
              </tr>
            ) : (
              filtered.map((exp) => (
                <tr key={exp.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-[var(--color-text-primary)]">
                    {exp.expenseNumber}
                  </td>
                  <td className="py-3 px-4 text-xs text-[var(--color-text-secondary)]">
                    {new Date(exp.expenseDate).toLocaleDateString('id-ID')}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                      {exp.expenseCategory}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-[var(--color-text-primary)]">{exp.description}</div>
                    {exp.paidTo && (
                      <div className="text-xs text-[var(--color-text-secondary)]">Penerima: {exp.paidTo}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-[var(--color-text-primary)]">
                    Rp {exp.amount.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-4 text-xs text-[var(--color-text-secondary)]">
                    {exp.paymentMethod || 'Kas/Cash'}
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={
                        exp.status === 'Paid'
                          ? 'success'
                          : exp.status === 'Approved'
                          ? 'info'
                          : exp.status === 'Cancelled'
                          ? 'danger'
                          : 'default'
                      }
                    >
                      {exp.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {exp.attachmentUrl ? (
                      <a
                        href={exp.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        title="Lihat Bukti"
                      >
                        <Paperclip className="w-4 h-4" />
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--color-text-secondary)]">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canApproveFinance() && exp.status === 'Draft' && (
                        <button
                          onClick={() => updateExpenseStatus(exp.id, 'Approved')}
                          className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          title="Setujui (Approve)"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {canEditFinance() && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(exp)}
                            className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/10"
                            title="Edit Biaya"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(exp.id, exp.expenseNumber)}
                            className="p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="Hapus Biaya"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Modal Add / Edit Expense */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingExpense ? `Edit Biaya Operasional (${editingExpense.expenseNumber})` : 'Catat Biaya Operasional Proyek'}
      >
        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                Tanggal Transaksi *
              </label>
              <Input
                type="date"
                {...register('expenseDate')}
                error={errors.expenseDate?.message}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                Kategori Pengeluaran *
              </label>
              <select
                {...register('expenseCategory')}
                className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {errors.expenseCategory && (
                <p className="text-xs text-red-500 mt-1">{errors.expenseCategory.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                Jumlah Pengeluaran (Rp) *
              </label>
              <Input
                type="number"
                step="any"
                placeholder="Contoh: 350000"
                {...register('amount', { valueAsNumber: true })}
                error={errors.amount?.message}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                Metode Pembayaran
              </label>
              <select
                {...register('paymentMethod')}
                className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm"
              >
                <option value="Kas/Cash">Kas/Cash</option>
                <option value="Transfer Bank BCA">Transfer Bank BCA</option>
                <option value="Transfer Bank Mandiri">Transfer Bank Mandiri</option>
                <option value="Kartu Debit/Kredit">Kartu Debit/Kredit</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
              Dibayarkan Kepada / Penerima
            </label>
            <Input
              placeholder="Contoh: Percetakan Sinar Jaya / Driver / Toko Alat Tulis"
              {...register('paidTo')}
              error={errors.paidTo?.message}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
              Uraian / Deskripsi *
            </label>
            <Input
              placeholder="Contoh: Print gambar kerja A1 10 set & binding proposal"
              {...register('description')}
              error={errors.description?.message}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
              Tautan / URL Bukti Struk / Nota (Opsional)
            </label>
            <Input
              type="url"
              placeholder="https://..."
              {...register('attachmentUrl')}
              error={errors.attachmentUrl?.message}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                Status Pengeluaran
              </label>
              <select
                {...register('status')}
                className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm"
              >
                <option value="Draft">Draft</option>
                <option value="Approved">Approved</option>
                <option value="Paid">Paid</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div className="pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  {...register('isReimbursable')}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[var(--color-text-primary)]">Reimburse ke Klien</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border)]">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={!isValid}>
              {editingExpense ? 'Simpan Perubahan' : 'Catat Pengeluaran'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!expenseToDelete}
        onClose={() => setExpenseToDelete(null)}
        onConfirm={async () => {
          if (expenseToDelete) {
            try {
              await deleteExpense(expenseToDelete.id);
              toast.success('Pengeluaran berhasil dihapus');
            } catch (err: any) {
              toast.error(err.message || 'Gagal menghapus pengeluaran');
            }
            setExpenseToDelete(null);
          }
        }}
        title="Konfirmasi Hapus Pengeluaran"
        message={`Apakah Anda yakin ingin menghapus data pengeluaran ${expenseToDelete?.number || ''}? Data yang dihapus tidak dapat dipulihkan.`}
        confirmLabel="Ya, Hapus"
        cancelLabel="Batal"
        variant="danger"
      />
    </div>
  );
}
