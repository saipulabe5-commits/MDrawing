import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Client } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { Button, Modal, Input, Card, ConfirmModal } from '../components/ui';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function ClientsView() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clientToDelete, setClientToDelete] = useState<{ id: string; name?: string } | null>(null);
  const [formData, setFormData] = useState<Partial<Client>>({
    clientName: '',
    companyName: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    notes: ''
  });

  const { canViewFinance, canManageFinance } = usePermissions();

  useEffect(() => {
    if (!canViewFinance()) return;
    const q = query(collection(db, 'clients'));
    const unsub = onSnapshot(q, (snapshot) => {
      setClients(snapshot.docs.map(doc => doc.data() as Client));
    });
    return () => unsub();
  }, [canViewFinance]);

  if (!canViewFinance()) {
    return <div className="p-4 text-center">Anda tidak memiliki akses ke halaman ini.</div>;
  }

  const handleSave = async () => {
    if (!canManageFinance()) {
      toast.error('Akses ditolak: Anda tidak memiliki wewenang mengelola data klien.');
      return;
    }
    if (!formData.companyName) {
      toast.error('Nama Perusahaan wajib diisi');
      return;
    }
    try {
      const id = editingId || crypto.randomUUID();
      const clientData: Client = {
        id,
        clientName: formData.clientName || '',
        companyName: formData.companyName || '',
        email: formData.email || '',
        phone: formData.phone || '',
        address: formData.address || '',
        taxId: formData.taxId || '',
        notes: formData.notes || '',
        createdAt: editingId ? (formData.createdAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'clients', id), clientData);
      toast.success(editingId ? 'Data klien diperbarui' : 'Klien berhasil ditambahkan');
      setIsModalOpen(false);
    } catch (e: any) {
      toast.error('Gagal menyimpan klien: ' + e.message);
    }
  };

  const handleDelete = (id: string, name?: string) => {
    if (!canManageFinance()) {
      toast.error('Akses ditolak: Anda tidak memiliki wewenang menghapus data klien.');
      return;
    }
    setClientToDelete({ id, name });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">Data Klien</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Kelola daftar klien perusahaan Anda.</p>
        </div>
        <Button 
          disabled={!canManageFinance()}
          title={!canManageFinance() ? "Akses terbatas: Memerlukan izin Kelola Keuangan (Finance / Admin / Owner)" : undefined}
          onClick={() => {
            if (!canManageFinance()) {
              toast.error("Akses terbatas: Anda tidak memiliki izin mengelola data klien.");
              return;
            }
            setFormData({ clientName: '', companyName: '', email: '', phone: '', address: '', taxId: '', notes: '' });
            setEditingId(null);
            setIsModalOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" /> Tambah Klien
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.length === 0 ? (
          <div className="col-span-full py-12 text-center text-[var(--color-text-secondary)]">
            Belum ada data klien.
          </div>
        ) : (
          clients.map(client => (
            <Card key={client.id} className="p-6 flex flex-col">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">{client.companyName}</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4">{client.address || '-'}</p>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">PIC:</span>
                    <span className="font-medium text-[var(--color-text-primary)]">{client.clientName || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">Telepon:</span>
                    <span className="font-medium text-[var(--color-text-primary)]">{client.phone || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">Email:</span>
                    <span className="font-medium text-[var(--color-text-primary)]">{client.email || '-'}</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-[var(--color-border)]">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  disabled={!canManageFinance()}
                  title={!canManageFinance() ? "Akses terbatas: Memerlukan izin Kelola Keuangan" : "Edit Klien"}
                  onClick={() => {
                    if (!canManageFinance()) {
                      toast.error("Akses terbatas: Anda tidak memiliki izin mengedit data klien.");
                      return;
                    }
                    setFormData(client);
                    setEditingId(client.id);
                    setIsModalOpen(true);
                  }}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  disabled={!canManageFinance()}
                  title={!canManageFinance() ? "Akses terbatas: Memerlukan izin Kelola Keuangan" : "Hapus Klien"}
                  className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40" 
                  onClick={() => {
                    if (!canManageFinance()) {
                      toast.error("Akses terbatas: Anda tidak memiliki izin menghapus data klien.");
                      return;
                    }
                    handleDelete(client.id, client.companyName || client.clientName);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Klien' : 'Tambah Klien'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Nama Perusahaan / Klien *</label>
            <Input 
              value={formData.companyName || ''}
              onChange={e => setFormData({ ...formData, companyName: e.target.value })}
              placeholder="PT Contoh Klien"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Alamat</label>
            <Input 
              value={formData.address || ''}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
              placeholder="Jl. Sudirman No. 1..."
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Nama PIC</label>
              <Input 
                value={formData.clientName || ''}
                onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                placeholder="Budi Santoso"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">No. Telepon / HP</label>
              <Input 
                value={formData.phone || ''}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="0812xxxxxx"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Batal</Button>
            <Button onClick={handleSave}>Simpan</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!clientToDelete}
        onClose={() => setClientToDelete(null)}
        onConfirm={async () => {
          if (clientToDelete) {
            try {
              await deleteDoc(doc(db, 'clients', clientToDelete.id));
              toast.success('Klien dihapus');
            } catch (e: any) {
              toast.error('Gagal menghapus klien: ' + e.message);
            }
            setClientToDelete(null);
          }
        }}
        title="Konfirmasi Hapus Klien"
        message={`Apakah Anda yakin ingin menghapus data klien ${clientToDelete?.name ? `"${clientToDelete.name}"` : ''}? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hapus Klien"
        cancelLabel="Batal"
        variant="danger"
      />
    </div>
  );
}
