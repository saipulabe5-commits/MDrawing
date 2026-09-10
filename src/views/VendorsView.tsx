import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Vendor, VendorType } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { Button, Modal, Input, Card, ConfirmModal } from '../components/ui';
import { Plus, Edit2, Trash2, Search, Filter, Phone, Mail, Building2, CreditCard, Star } from 'lucide-react';
import toast from 'react-hot-toast';

const VENDOR_TYPES: VendorType[] = [
  'Struktur',
  'MEP',
  'Drafter Freelance',
  'Renderer',
  'Surveyor',
  'Printing Vendor',
  'Konsultan PBG',
  'Lain-lain'
];

export function VendorsView() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [vendorToDelete, setVendorToDelete] = useState<{ id: string; name: string } | null>(null);

  const [formData, setFormData] = useState<Partial<Vendor>>({
    vendorName: '',
    vendorType: 'Struktur',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    bankName: '',
    bankAccountNumber: '',
    bankAccountHolder: '',
    npwp: '',
    notes: '',
    rating: 5
  });

  const { canViewFinance, canManageFinance, canViewVendorCost } = usePermissions();
  const canView = canViewVendorCost() || canViewFinance();
  const canManage = canManageFinance();

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'vendors'));
    const unsub = onSnapshot(q, (snapshot) => {
      setVendors(snapshot.docs.map(doc => doc.data() as Vendor));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching vendors:", error);
      setLoading(false);
    });
    return () => unsub();
  }, [canView]);

  if (!canView) {
    return (
      <div className="p-8 text-center text-[var(--color-text-secondary)]">
        Anda tidak memiliki akses ke modul Vendor.
      </div>
    );
  }

  const handleOpenAdd = () => {
    if (!canManage) {
      toast.error('Akses terbatas: Anda tidak memiliki wewenang menambah vendor.');
      return;
    }
    setEditingId(null);
    setFormData({
      vendorName: '',
      vendorType: 'Struktur',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      bankName: '',
      bankAccountNumber: '',
      bankAccountHolder: '',
      npwp: '',
      notes: '',
      rating: 5
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (v: Vendor) => {
    if (!canManage) {
      toast.error('Akses terbatas: Anda tidak memiliki wewenang mengedit vendor.');
      return;
    }
    setEditingId(v.id);
    setFormData(v);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!canManage) {
      toast.error('Akses ditolak: Anda tidak memiliki wewenang mengelola data vendor.');
      return;
    }
    if (!formData.vendorName?.trim()) {
      toast.error('Nama Vendor wajib diisi');
      return;
    }

    try {
      const id = editingId || crypto.randomUUID();
      const vendorData: Vendor = {
        id,
        vendorName: formData.vendorName.trim(),
        vendorType: (formData.vendorType as VendorType) || 'Lain-lain',
        contactPerson: formData.contactPerson || '',
        phone: formData.phone || '',
        email: formData.email || '',
        address: formData.address || '',
        bankName: formData.bankName || '',
        bankAccountNumber: formData.bankAccountNumber || '',
        bankAccountHolder: formData.bankAccountHolder || '',
        npwp: formData.npwp || '',
        notes: formData.notes || '',
        rating: formData.rating || 5,
        createdAt: editingId ? (formData.createdAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'vendors', id), vendorData);
      toast.success(editingId ? 'Vendor berhasil diperbarui' : 'Vendor baru berhasil ditambahkan');
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Gagal menyimpan vendor');
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (!canManage) {
      toast.error('Akses ditolak: Anda tidak memiliki wewenang menghapus data vendor.');
      return;
    }
    setVendorToDelete({ id, name });
  };

  const filteredVendors = vendors.filter(v => {
    const matchSearch = 
      v.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.contactPerson?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.phone?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = selectedType === 'ALL' || v.vendorType === selectedType;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Direktori Vendor & Rekanan
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Kelola data vendor spesialis, konsultan, drafter freelance, surveyor, dan rekanan proyek
          </p>
        </div>

        <Button 
          disabled={!canManage}
          title={!canManage ? "Akses terbatas: Memerlukan izin Kelola Keuangan (Finance / Admin / Owner)" : undefined}
          onClick={handleOpenAdd} 
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Vendor</span>
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-[var(--color-surface)] p-3 rounded-2xl border border-[var(--color-border)]">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            placeholder="Cari nama, kontak, telepon..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-transparent text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-4 h-4 text-[var(--color-text-secondary)] hidden md:block" />
          <button
            onClick={() => setSelectedType('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              selectedType === 'ALL'
                ? 'bg-[var(--color-accent-blue)] text-white'
                : 'bg-black/5 dark:bg-white/5 text-[var(--color-text-secondary)] hover:bg-black/10'
            }`}
          >
            Semua ({vendors.length})
          </button>
          {VENDOR_TYPES.map(type => {
            const count = vendors.filter(v => v.vendorType === type).length;
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedType === type
                    ? 'bg-[var(--color-accent-blue)] text-white'
                    : 'bg-black/5 dark:bg-white/5 text-[var(--color-text-secondary)] hover:bg-black/10'
                }`}
              >
                {type} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Vendor Cards Grid */}
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-4 border-[var(--color-accent-blue)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="p-12 text-center bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] space-y-3">
          <Building2 className="w-12 h-12 mx-auto text-[var(--color-text-secondary)] opacity-40" />
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Belum ada vendor ditemukan</h3>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mx-auto">
            {searchQuery || selectedType !== 'ALL'
              ? 'Tidak ada vendor yang cocok dengan filter pencarian Anda.'
              : 'Mulai dengan menambahkan vendor rekanan pertama Anda.'}
          </p>
          {canManage && !searchQuery && selectedType === 'ALL' && (
            <Button onClick={handleOpenAdd} className="mt-2">
              Tambah Vendor Pertama
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVendors.map((vendor) => (
            <Card key={vendor.id} className="p-5 flex flex-col justify-between space-y-4 hover:border-[var(--color-accent-blue)]/40 transition-colors">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-base text-[var(--color-text-primary)]">
                      {vendor.vendorName}
                    </h3>
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      {vendor.vendorType}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={!canManage}
                      onClick={() => handleOpenEdit(vendor)}
                      className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title={!canManage ? "Akses terbatas: Memerlukan izin Kelola Keuangan" : "Edit Vendor"}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      disabled={!canManage}
                      onClick={() => handleDelete(vendor.id, vendor.vendorName)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title={!canManage ? "Akses terbatas: Memerlukan izin Kelola Keuangan" : "Hapus Vendor"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-[var(--color-text-secondary)]">
                  {vendor.contactPerson && (
                    <p className="font-medium text-[var(--color-text-primary)]">
                      PIC: {vendor.contactPerson}
                    </p>
                  )}
                  {vendor.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 opacity-60" />
                      <span>{vendor.phone}</span>
                    </div>
                  )}
                  {vendor.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 opacity-60" />
                      <span>{vendor.email}</span>
                    </div>
                  )}
                  {vendor.address && (
                    <p className="line-clamp-2 pt-1 border-t border-[var(--color-border)]/50">
                      {vendor.address}
                    </p>
                  )}
                </div>
              </div>

              {/* Bank Account Footer */}
              <div className="pt-3 border-t border-[var(--color-border)]/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                  <CreditCard className="w-4 h-4 text-emerald-500" />
                  <span>
                    {vendor.bankName ? `${vendor.bankName} - ${vendor.bankAccountNumber}` : 'Belum ada data bank'}
                  </span>
                </div>
                {vendor.bankAccountHolder && (
                  <span className="text-[11px] font-medium text-[var(--color-text-primary)] truncate max-w-[120px]">
                    a/n {vendor.bankAccountHolder}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Add / Edit Vendor */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Vendor Rekanan' : 'Tambah Vendor Baru'}
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <Input
            label="Nama Vendor / Perusahaan / Freelancer *"
            placeholder="Contoh: PT Struktur Prima Rekatama atau Agus (Renderer)"
            value={formData.vendorName}
            onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
          />

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Jenis Layanan / Spesialisasi *
            </label>
            <select
              value={formData.vendorType}
              onChange={(e) => setFormData({ ...formData, vendorType: e.target.value as VendorType })}
              className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)] text-[var(--color-text-primary)]"
            >
              {VENDOR_TYPES.map((t) => (
                <option key={t} value={t} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Contact Person (PIC)"
              placeholder="Nama PIC"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
            />
            <Input
              label="Nomor Telepon / WhatsApp"
              placeholder="08123456789"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="vendor@mail.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <Input
              label="NPWP (Opsional)"
              placeholder="00.000.000.0-000.000"
              value={formData.npwp}
              onChange={(e) => setFormData({ ...formData, npwp: e.target.value })}
            />
          </div>

          <Input
            label="Alamat Kantor / Workshop"
            placeholder="Alamat lengkap vendor"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          {/* Bank Information */}
          <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl space-y-3 border border-[var(--color-border)]/60">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Informasi Rekening Pembayaran
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Nama Bank"
                placeholder="BCA / Mandiri / BNI"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              />
              <Input
                label="Nomor Rekening"
                placeholder="1234567890"
                value={formData.bankAccountNumber}
                onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
              />
              <Input
                label="Nama Pemilik Rekening"
                placeholder="a/n Pemilik"
                value={formData.bankAccountHolder}
                onChange={(e) => setFormData({ ...formData, bankAccountHolder: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Catatan Khusus / Terms Rekanan
            </label>
            <textarea
              rows={3}
              placeholder="Catatan keahlian khusus, preferensi termin, dll"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-transparent border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)] text-[var(--color-text-primary)]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border)]">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave}>
              {editingId ? 'Simpan Perubahan' : 'Tambah Vendor'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!vendorToDelete}
        onClose={() => setVendorToDelete(null)}
        onConfirm={async () => {
          if (vendorToDelete) {
            try {
              await deleteDoc(doc(db, 'vendors', vendorToDelete.id));
              toast.success('Vendor berhasil dihapus');
            } catch (err: any) {
              console.error(err);
              toast.error(err.message || 'Gagal menghapus vendor');
            }
            setVendorToDelete(null);
          }
        }}
        title="Konfirmasi Hapus Vendor"
        message={`Apakah Anda yakin ingin menghapus master data vendor "${vendorToDelete?.name || ''}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hapus Vendor"
        cancelLabel="Batal"
        variant="danger"
      />
    </div>
  );
}
