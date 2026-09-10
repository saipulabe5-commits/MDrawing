import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useVendor } from '../../../context/VendorContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { ProjectVendor, VendorWorkStatus, VendorType } from '../../../types';
import { Button, Modal, Input, Card, ConfirmModal } from '../../../components/ui';
import { Plus, Edit2, Trash2, Calendar, Briefcase, FileText, CheckCircle2, Clock, AlertTriangle, PauseCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { VendorContractSchema, VendorContractFormData } from '../../../lib/validationSchemas';

interface VendorContractsTabProps {
  projectId: string;
}

const WORK_STATUSES: { value: VendorWorkStatus; label: string; icon: any; color: string }[] = [
  { value: 'Belum Mulai', label: 'Belum Mulai', icon: Clock, color: 'text-slate-700 dark:text-slate-300 bg-slate-500/15 border border-slate-300 dark:border-slate-700' },
  { value: 'Dalam Proses', label: 'Dalam Proses', icon: Briefcase, color: 'text-blue-700 dark:text-blue-300 bg-blue-500/15 border border-blue-300 dark:border-blue-700/60' },
  { value: 'On Hold', label: 'On Hold', icon: PauseCircle, color: 'text-amber-800 dark:text-amber-300 bg-amber-500/15 border border-amber-300 dark:border-amber-700/60' },
  { value: 'Selesai', label: 'Selesai', icon: CheckCircle2, color: 'text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-300 dark:border-emerald-700/60' }
];

export function VendorContractsTab({ projectId }: VendorContractsTabProps) {
  const { 
    vendors, 
    projectVendors, 
    createProjectVendor, 
    updateProjectVendor, 
    deleteProjectVendor, 
    updateProjectVendorWorkStatus 
  } = useVendor();

  const { canManageFinance, canViewVendorCost } = usePermissions();
  const canManage = canManageFinance();
  const canSeeCost = canViewVendorCost();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contractToDelete, setContractToDelete] = useState<{ id: string; name: string } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isValid }
  } = useForm<VendorContractFormData>({
    resolver: zodResolver(VendorContractSchema) as any,
    defaultValues: {
      vendorId: '',
      vendorName: '',
      vendorType: 'Struktur',
      scopeOfWork: '',
      contractValue: 0,
      workStatus: 'Belum Mulai',
      startDate: '',
      targetDate: '',
      notes: ''
    },
    mode: 'onChange'
  });

  const handleOpenAdd = () => {
    if (!canManage) {
      toast.error('Akses terbatas: Anda tidak memiliki wewenang menambah kontrak vendor.');
      return;
    }
    setEditingId(null);
    reset({
      vendorId: vendors[0]?.id || '',
      vendorName: vendors[0]?.vendorName || '',
      vendorType: vendors[0]?.vendorType || 'Struktur',
      scopeOfWork: '',
      contractValue: 0,
      workStatus: 'Belum Mulai',
      startDate: new Date().toISOString().split('T')[0],
      targetDate: '',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (pv: ProjectVendor) => {
    if (!canManage) {
      toast.error('Akses terbatas: Anda tidak memiliki wewenang mengedit kontrak vendor.');
      return;
    }
    setEditingId(pv.id);
    reset({
      vendorId: pv.vendorId || '',
      vendorName: pv.vendorName || '',
      vendorType: pv.vendorType || 'Struktur',
      scopeOfWork: pv.scopeOfWork || '',
      contractValue: pv.contractValue || 0,
      workStatus: pv.workStatus || 'Belum Mulai',
      startDate: pv.startDate || '',
      targetDate: pv.targetDate || '',
      notes: pv.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleVendorSelect = (vendorId: string) => {
    const selected = vendors.find(v => v.id === vendorId);
    if (selected) {
      setValue('vendorId', selected.id);
      setValue('vendorName', selected.vendorName, { shouldValidate: true });
      setValue('vendorType', selected.vendorType, { shouldValidate: true });
    }
  };

  const onSubmit = async (data: VendorContractFormData) => {
    if (!canManage) {
      toast.error('Akses ditolak: Anda tidak memiliki wewenang mengelola kontrak vendor.');
      return;
    }

    try {
      if (editingId) {
        await updateProjectVendor(editingId, data as any, 'Updated contract details');
        toast.success('Kontrak vendor berhasil diperbarui');
      } else {
        await createProjectVendor(data as any);
        toast.success('Kontrak vendor baru berhasil dibuat');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Gagal menyimpan kontrak');
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (!canManage) {
      toast.error('Akses ditolak: Anda tidak memiliki wewenang menghapus kontrak vendor.');
      return;
    }
    setContractToDelete({ id, name });
  };

  const handleStatusChange = async (id: string, status: VendorWorkStatus) => {
    try {
      await updateProjectVendorWorkStatus(id, status);
      toast.success(`Status pekerjaan diubah menjadi ${status}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Gagal mengubah status pekerjaan');
    }
  };

  const totalContractValue = projectVendors.reduce((acc, curr) => acc + (curr.contractValue || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top action & metrics bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Kontrak Pekerjaan Vendor
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Daftar rekanan subkon, konsultan, drafter freelance, dan surveyor pada proyek ini
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canSeeCost && (
            <div className="px-3.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-right">
              <span className="text-[11px] text-[var(--color-text-secondary)] block">Total Nilai Kontrak Vendor</span>
              <span className="text-sm font-semibold text-[var(--color-accent-blue)]">
                Rp {totalContractValue.toLocaleString('id-ID')}
              </span>
            </div>
          )}

          <Button 
            disabled={!canManage}
            title={!canManage ? "Akses terbatas: Memerlukan izin Kelola Keuangan (Finance / Admin / Owner)" : undefined}
            onClick={handleOpenAdd} 
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kontrak</span>
          </Button>
        </div>
      </div>

      {/* Contracts List */}
      {projectVendors.length === 0 ? (
        <div className="p-12 text-center bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] space-y-3">
          <Briefcase className="w-12 h-12 mx-auto text-[var(--color-text-secondary)] opacity-40" />
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Belum ada kontrak vendor</h3>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mx-auto">
            Tambahkan vendor yang terlibat dalam pekerjaan proyek ini beserta nilai kontrak dan lingkup kerjanya.
          </p>
          {canManage && (
            <Button onClick={handleOpenAdd} className="mt-2">
              Tambah Kontrak Pertama
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projectVendors.map((pv) => {
            const currentStatusObj = WORK_STATUSES.find(s => s.value === pv.workStatus) || WORK_STATUSES[0];
            const StatusIcon = currentStatusObj.icon;

            return (
              <Card key={pv.id} className="p-5 space-y-4 hover:border-[var(--color-accent-blue)]/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base text-[var(--color-text-primary)]">
                        {pv.vendorName}
                      </h3>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        {pv.vendorType}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[var(--color-text-primary)] mt-1.5">
                      Scope: {pv.scopeOfWork}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      disabled={!canManage}
                      onClick={() => handleOpenEdit(pv)}
                      className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 hover:text-[var(--color-text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                      title={!canManage ? "Akses terbatas: Memerlukan izin Kelola Keuangan" : "Edit Kontrak"}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      disabled={!canManage}
                      onClick={() => handleDelete(pv.id, pv.vendorName)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={!canManage ? "Akses terbatas: Memerlukan izin Kelola Keuangan" : "Hapus Kontrak"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Dates & Timeline */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                  {pv.startDate && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 opacity-60" />
                      <span>Mulai: {new Date(pv.startDate).toLocaleDateString('id-ID')}</span>
                    </div>
                  )}
                  {pv.targetDate && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 opacity-60" />
                      <span>Target: {new Date(pv.targetDate).toLocaleDateString('id-ID')}</span>
                    </div>
                  )}
                  {pv.completionDate && (
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Selesai: {new Date(pv.completionDate).toLocaleDateString('id-ID')}</span>
                    </div>
                  )}
                </div>

                {pv.notes && (
                  <p className="text-xs text-[var(--color-text-secondary)] bg-black/5 dark:bg-white/5 p-2 rounded-lg">
                    {pv.notes}
                  </p>
                )}

                {/* Footer with Contract Value and Work Status */}
                <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-[var(--color-text-secondary)] block">Nilai Kontrak:</span>
                    {canSeeCost ? (
                      <span className="font-semibold text-sm text-[var(--color-text-primary)]">
                        Rp {pv.contractValue.toLocaleString('id-ID')}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-text-secondary)] italic">Terkunci</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {canManage ? (
                      <select
                        value={pv.workStatus}
                        onChange={(e) => handleStatusChange(pv.id, e.target.value as VendorWorkStatus)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-lg border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)] ${currentStatusObj.color}`}
                      >
                        {WORK_STATUSES.map(s => (
                          <option key={s.value} value={s.value} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">
                            {s.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg ${currentStatusObj.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {pv.workStatus}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Add / Edit Contract */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Kontrak Vendor' : 'Tambah Kontrak Vendor'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {vendors.length > 0 ? (
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Pilih Vendor Rekanan *
              </label>
              <select
                {...register('vendorId')}
                onChange={(e) => handleVendorSelect(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)] text-[var(--color-text-primary)]"
              >
                {vendors.map(v => (
                  <option key={v.id} value={v.id} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">
                    {v.vendorName} ({v.vendorType})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-600 dark:text-amber-400">
              Belum ada vendor di Direktori Vendor. Anda dapat mengetik nama vendor secara langsung.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nama Vendor *"
              {...register('vendorName')}
              error={errors.vendorName?.message}
            />
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Jenis Vendor
              </label>
              <select
                {...register('vendorType')}
                className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)] text-[var(--color-text-primary)]"
              >
                <option value="Struktur">Struktur</option>
                <option value="MEP">MEP</option>
                <option value="Drafter Freelance">Drafter Freelance</option>
                <option value="Renderer">Renderer</option>
                <option value="Surveyor">Surveyor</option>
                <option value="Printing Vendor">Printing Vendor</option>
                <option value="Konsultan PBG">Konsultan PBG</option>
                <option value="Lain-lain">Lain-lain</option>
              </select>
            </div>
          </div>

          <Input
            label="Lingkup Pekerjaan (Scope of Work) *"
            placeholder="Contoh: Perhitungan Struktur & Gambar Kerja Struktur 3 Lantai"
            {...register('scopeOfWork')}
            error={errors.scopeOfWork?.message}
          />

          <Input
            label="Nilai Kontrak (Rp) *"
            type="number"
            step="any"
            placeholder="0"
            {...register('contractValue', { valueAsNumber: true })}
            error={errors.contractValue?.message}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Tanggal Mulai Pekerjaan"
              type="date"
              {...register('startDate')}
              error={errors.startDate?.message}
            />
            <Input
              label="Target Tanggal Selesai"
              type="date"
              {...register('targetDate')}
              error={errors.targetDate?.message}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Status Pekerjaan
            </label>
            <select
              {...register('workStatus')}
              className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)] text-[var(--color-text-primary)]"
            >
              {WORK_STATUSES.map(s => (
                <option key={s.value} value={s.value} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Catatan Kontrak / SLA
            </label>
            <textarea
              rows={3}
              placeholder="Catatan garansi revisi, detail kelengkapan berkas, dll"
              {...register('notes')}
              className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)] text-[var(--color-text-primary)]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border)]">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={!isValid}>
              {editingId ? 'Simpan Perubahan' : 'Buat Kontrak'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!contractToDelete}
        onClose={() => setContractToDelete(null)}
        onConfirm={async () => {
          if (contractToDelete) {
            try {
              await deleteProjectVendor(contractToDelete.id);
              toast.success('Kontrak vendor berhasil dihapus');
            } catch (err: any) {
              console.error(err);
              toast.error(err.message || 'Gagal menghapus kontrak');
            }
            setContractToDelete(null);
          }
        }}
        title="Konfirmasi Hapus Kontrak Vendor"
        message={`Apakah Anda yakin ingin menghapus kontrak vendor untuk "${contractToDelete?.name || ''}"? Data termin dan tagihan yang terkait harus ditinjau kembali.`}
        confirmLabel="Ya, Hapus Kontrak"
        cancelLabel="Batal"
        variant="danger"
      />
    </div>
  );
}
