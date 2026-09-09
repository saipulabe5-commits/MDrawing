import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { User, UserRole } from '../../types';
import { Card, Button, Badge, Modal, Input } from '../../components/ui';
import { 
  Users, ShieldCheck, Check, X, Lock, 
  AlertTriangle, Save, RefreshCw, Key, UserCheck, 
  UserX, ShieldAlert, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

const CANONICAL_ROLES: { role: UserRole; label: string; desc: string }[] = [
  { role: 'OWNER', label: 'Owner (Pemilik)', desc: 'Akses penuh tanpa batas, manajemen izin, otorisasi finansial, dan audit sistem.' },
  { role: 'ADMIN', label: 'Administrator', desc: 'Pengelolaan operasional, penugasan tim, proyek, dan pengawasan berkas.' },
  { role: 'PROJECT_LEADER', label: 'Project Leader', desc: 'Kepala proyek teknis, manajemen register gambar kerja, dan penerbitan transmittal.' },
  { role: 'TEAM', label: 'Team (Drafter)', desc: 'Eksekutor gambar, pembaharuan progress pengerjaan, dan catatan teknis.' },
  { role: 'FINANCE', label: 'Finance Staff', desc: 'Penerbitan quotation, invoice, pembayaran klien, tagihan vendor, dan arus kas.' },
  { role: 'VIEWER', label: 'Viewer (Pengamat)', desc: 'Hanya melihat daftar gambar dan status proyek tanpa izin modifikasi.' },
];

const GRANULAR_CAPABILITIES = [
  { key: 'canCreateProject', label: 'Buat Proyek Baru', desc: 'Diizinkan mendaftarkan proyek baru ke sistem' },
  { key: 'canEditProject', label: 'Edit Detail Proyek', desc: 'Mengubah timeline, nama proyek, atau status proyek' },
  { key: 'canDeleteProject', label: 'Hapus Proyek', desc: 'Menghapus dokumen proyek (hanya Owner/Admin)' },
  { key: 'canManageDrawingRegister', label: 'Kelola Register Gambar', desc: 'Menambah, mengubah, atau menghapus item gambar dan grup' },
  { key: 'canUpdateDrawingStatus', label: 'Update Status & Progress', desc: 'Memperbarui persentase progress dan status pengerjaan' },
  { key: 'canManageTransmittal', label: 'Terbitkan Transmittal', desc: 'Membuat surat pengantar pengiriman berkas gambar resmi' },
  { key: 'canViewFinance', label: 'Lihat Data Keuangan', desc: 'Akses membaca invoice, penawaran, tagihan vendor, dan arus kas' },
  { key: 'canEditFinance', label: 'Ubah Data Keuangan', desc: 'Membuat atau mengedit transaksi finansial dan mencatat pembayaran' },
  { key: 'canManageVendor', label: 'Kelola Vendor & SPK', desc: 'Mendaftarkan vendor baru, membuat kontrak, dan verifikasi SPK' },
  { key: 'canExportFinanceReport', label: 'Ekspor Laporan & Audit', desc: 'Mengunduh rekapitulasi finansial dan log audit integritas' },
];

export function UserPermissionsTab() {
  const { appUser, user, setSimulatedRole, simulatedRole, realAppUser } = useAuth();

  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit User State
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('VIEWER');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editCaps, setEditCaps] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // Create Test User State
  const [isCreatingTestUser, setIsCreatingTestUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('TEAM');
  const [creatingUser, setCreatingUser] = useState(false);

  const actualRole = realAppUser?.role || appUser?.role;
  const isOwner = actualRole === 'OWNER';
  const isAdmin = actualRole === 'ADMIN';

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as User[];

        // If list is empty or current user is not in list, ensure current user is represented
        if (list.length === 0 && appUser) {
          setUsersList([appUser]);
        } else {
          setUsersList(list);
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Failed to listen to users collection:', err.message);
        if (appUser) setUsersList([appUser]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [appUser]);

  const handleOpenEdit = (targetUser: User) => {
    setSelectedUser(targetUser);
    setEditRole(targetUser.role || 'VIEWER');
    setEditIsActive(targetUser.isActive !== false);

    const initialCaps: Record<string, boolean> = {};
    GRANULAR_CAPABILITIES.forEach((c) => {
      initialCaps[c.key] = (targetUser as any)[c.key] === true;
    });
    setEditCaps(initialCaps);
  };

  const handleToggleCapability = (capKey: string) => {
    setEditCaps((prev) => ({
      ...prev,
      [capKey]: !prev[capKey],
    }));
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    const targetId = selectedUser.uid || selectedUser.id || '';
    const currentUserId = appUser?.uid || appUser?.id || '';

    // Anti-Escalation Check 1: User cannot modify self role or active status
    if (targetId === currentUserId) {
      if (editRole !== appUser?.role || editIsActive !== appUser?.isActive) {
        toast.error('Anti-Eskalasi: Anda tidak dapat mengubah peran atau status keaktifan akun Anda sendiri.');
        return;
      }
    }

    // Anti-Escalation Check 2: Only Owner can appoint Owner
    if (editRole === 'OWNER' && !isOwner) {
      toast.error('Akses Ditolak: Hanya peran OWNER sah yang dapat menunjuk peran OWNER baru.');
      return;
    }

    // Anti-Escalation Check 3: Admin cannot modify an Owner
    if (selectedUser.role === 'OWNER' && !isOwner) {
      toast.error('Akses Ditolak: Admin tidak diizinkan memodifikasi akun Owner.');
      return;
    }

    setSaving(true);
    try {
      // 1. Try server endpoint first for custom claims
      const token = await auth.currentUser?.getIdToken();

      if (token && isOwner) {
        try {
          await fetch('/api/admin/set-user-claim', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              targetUid: targetId,
              role: editRole,
              isActive: editIsActive,
              capabilities: editCaps,
            }),
          });
        } catch (e) {
          // fallback to client update
        }
      }

      // 2. Direct Firestore update
      const updatePayload: Record<string, any> = {
        role: editRole,
        isActive: editIsActive,
        ...editCaps,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'users', targetId), updatePayload);

      toast.success(`Hak akses pengguna ${selectedUser.name || selectedUser.email} berhasil diperbarui.`);
      setSelectedUser(null);
    } catch (err: any) {
      console.error('Save permissions error:', err);
      toast.error('Gagal menyimpan hak akses: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleUserActive = async (targetUser: User) => {
    const targetId = targetUser.uid || targetUser.id || '';
    const currentUserId = appUser?.uid || appUser?.id || '';

    // Anti-Escalation: User cannot toggle self
    if (targetId === currentUserId) {
      toast.error('Anti-Eskalasi: Anda tidak dapat menonaktifkan akun Anda sendiri.');
      return;
    }

    if (targetUser.role === 'OWNER' && !isOwner) {
      toast.error('Akses Ditolak: Akun Owner tidak dapat dinonaktifkan oleh Admin.');
      return;
    }

    const nextState = !(targetUser.isActive !== false);
    try {
      await updateDoc(doc(db, 'users', targetId), {
        isActive: nextState,
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Akun ${targetUser.name || targetUser.email} berhasil ${nextState ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch (err: any) {
      toast.error('Gagal memperbarui status keaktifan: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">
              Manajemen Peran Kanonik & 10 Capabilities Pengguna
            </h3>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Mengatur otorisasi berlapis 3-layer (UI, Authorization Client, dan Firestore Rules). Dilindungi aturan Anti-Eskalasi ketat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isOwner ? 'purple' : isAdmin ? 'info' : 'outline'}>
            Peran Anda: {appUser?.role || 'VIEWER'}
          </Badge>

          {isOwner && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setNewUserName('Drafter Budi (Test TEAM)');
                  setNewUserEmail(`drafter.${Date.now().toString().slice(-4)}@mdrawing.local`);
                  setNewUserRole('TEAM');
                  setIsCreatingTestUser(true);
                }}
              >
                + Tambah Akun Uji Coba
              </Button>

              <Button
                variant={simulatedRole === 'TEAM' ? 'primary' : 'ghost'}
                size="sm"
                title="Beralih cepat ke mode uji coba sebagai TEAM (Drafter)"
                onClick={() => {
                  if (simulatedRole === 'TEAM') {
                    setSimulatedRole(null);
                  } else {
                    setSimulatedRole('TEAM');
                  }
                }}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                {simulatedRole === 'TEAM' ? 'Sedang Menguji TEAM' : 'Uji Tampilan TEAM'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] font-semibold text-xs border-b border-[var(--color-border)]">
              <tr>
                <th className="py-3 px-4 font-semibold">Pengguna</th>
                <th className="py-3 px-4 font-semibold">Email</th>
                <th className="py-3 px-4 font-semibold">Peran Kanonik</th>
                <th className="py-3 px-4 font-semibold">Status Akun</th>
                <th className="py-3 px-4 font-semibold">Ringkasan Hak Akses</th>
                <th className="py-3 px-4 font-semibold text-center">Aksi Otorisasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[var(--color-text-secondary)]">
                    Memuat daftar pengguna...
                  </td>
                </tr>
              ) : usersList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[var(--color-text-secondary)]">
                    Tidak ada pengguna terdaftar.
                  </td>
                </tr>
              ) : (
                usersList.map((u) => {
                  const userId = u.uid || u.id || '';
                  const currentUserId = appUser?.uid || appUser?.id || '';
                  const isActive = u.isActive !== false;
                  const isSelf = userId === currentUserId;
                  const userIsOwner = u.role === 'OWNER';

                  return (
                    <tr key={userId} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      {/* Name */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-xs text-[var(--color-text-primary)] flex items-center gap-1.5">
                          {u.name || 'Pengguna MDrawing'}
                          {isSelf && (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 font-semibold">
                              Anda
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[var(--color-text-secondary)] font-mono block">
                          UID: {userId.substring(0, 10)}...
                        </span>
                      </td>

                      {/* Email */}
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-[var(--color-text-secondary)]">
                        {u.email}
                      </td>

                      {/* Role */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge variant={userIsOwner ? 'purple' : u.role === 'ADMIN' ? 'info' : u.role === 'PROJECT_LEADER' ? 'success' : u.role === 'FINANCE' ? 'warning' : 'default'}>
                          {u.role || 'VIEWER'}
                        </Badge>
                      </td>

                      {/* Active Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-red-500/10 text-red-600 dark:text-red-400'
                          }`}
                        >
                          {isActive ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                          {isActive ? 'Aktif' : 'Non-Aktif'}
                        </span>
                      </td>

                      {/* Capabilities count */}
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-[var(--color-text-secondary)]">
                        {userIsOwner ? (
                          <span className="text-purple-500 font-medium">10/10 (Akses Penuh Mutlak)</span>
                        ) : (
                          <span>
                            {GRANULAR_CAPABILITIES.filter((c) => (u as any)[c.key] === true).length} dari 10 aktif
                          </span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-4 whitespace-nowrap text-center space-x-2">
                        {isOwner && (
                          <Button
                            variant={simulatedRole === u.role ? 'primary' : 'ghost'}
                            size="sm"
                            title={`Simulasikan tampilan aplikasi sebagai ${u.role}`}
                            onClick={() => {
                              if (simulatedRole === u.role) {
                                setSimulatedRole(null);
                              } else {
                                setSimulatedRole(u.role || 'VIEWER');
                              }
                            }}
                          >
                            <Sparkles className="w-3.5 h-3.5 mr-1" />
                            {simulatedRole === u.role ? 'Sedang Diuji' : 'Uji Peran'}
                          </Button>
                        )}

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenEdit(u)}
                          disabled={!isOwner && !isAdmin}
                        >
                          <Key className="w-3.5 h-3.5 mr-1" />
                          Atur Otorisasi
                        </Button>

                        {!isSelf && (isOwner || (isAdmin && !userIsOwner)) && (
                          <Button
                            variant={isActive ? 'danger' : 'secondary'}
                            size="sm"
                            onClick={() => handleToggleUserActive(u)}
                          >
                            {isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edit Otorisasi */}
      {selectedUser && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedUser(null)}
          title={`Atur Hak Akses: ${selectedUser.name || selectedUser.email}`}
        >
          <div className="space-y-5">
            {/* User header */}
            <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 space-y-1">
              <span className="text-[11px] text-[var(--color-text-secondary)] block">Target Pengguna:</span>
              <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                {selectedUser.name || 'Pengguna'} ({selectedUser.email})
              </div>
            </div>

            {/* Canonical Role Selection */}
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">
                Pilih Peran Kanonik:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CANONICAL_ROLES.map((r) => {
                  const isOwnerOption = r.role === 'OWNER';
                  const isSelf = (selectedUser.uid || selectedUser.id) === (appUser?.uid || appUser?.id);
                  const isCurrent = editRole === r.role;
                  const disabled = (isOwnerOption && !isOwner) || (isSelf && isCurrent);

                  return (
                    <button
                      key={r.role}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setEditRole(r.role);
                        // Auto populate defaults for role
                        if (r.role === 'OWNER') {
                          const full: Record<string, boolean> = {};
                          GRANULAR_CAPABILITIES.forEach((c) => (full[c.key] = true));
                          setEditCaps(full);
                        } else if (r.role === 'VIEWER') {
                          setEditCaps({});
                        } else if (r.role === 'FINANCE') {
                          setEditCaps({
                            canViewFinance: true,
                            canEditFinance: true,
                            canExportFinanceReport: true,
                          });
                        }
                      }}
                      className={`p-2.5 rounded-xl text-left border transition-all ${
                        isCurrent
                          ? 'border-blue-500 bg-blue-500/10 text-[var(--color-text-primary)]'
                          : 'border-[var(--color-border)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--color-text-secondary)]'
                      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-[var(--color-text-primary)]">
                          {r.label}
                        </span>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-blue-500" />}
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                        {r.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Account Status Switch */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--color-border)]">
              <div>
                <span className="text-xs font-semibold text-[var(--color-text-primary)] block">
                  Status Keaktifan Akun (isActive)
                </span>
                <span className="text-[11px] text-[var(--color-text-secondary)]">
                  Akun non-aktif otomatis diblokir dari seluruh pembacaan/penulisan Firestore
                </span>
              </div>
              <input
                type="checkbox"
                checked={editIsActive}
                disabled={(selectedUser.uid || selectedUser.id) === (appUser?.uid || appUser?.id)}
                onChange={(e) => setEditIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
            </div>

            {/* 10 Granular Capabilities Matrix */}
            <div>
              <span className="text-xs font-semibold text-[var(--color-text-primary)] block mb-2">
                10 Granular Capabilities:
              </span>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {GRANULAR_CAPABILITIES.map((cap) => {
                  const checked = editRole === 'OWNER' || !!editCaps[cap.key];
                  const disabled = editRole === 'OWNER';

                  return (
                    <label
                      key={cap.key}
                      className={`flex items-start justify-between p-2 rounded-xl border border-[var(--color-border)] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors ${
                        checked ? 'bg-blue-500/5' : ''
                      }`}
                    >
                      <div className="space-y-0.5">
                        <span className="text-xs font-medium text-[var(--color-text-primary)] block">
                          {cap.label}
                        </span>
                        <span className="text-[11px] text-[var(--color-text-secondary)] block">
                          {cap.desc}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => handleToggleCapability(cap.key)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 mt-0.5"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <Button variant="ghost" onClick={() => setSelectedUser(null)} disabled={saving}>
                Batal
              </Button>
              <Button variant="primary" onClick={handleSavePermissions} disabled={saving}>
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    Simpan Otorisasi
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Buat Akun Uji Coba */}
      {isCreatingTestUser && (
        <Modal
          isOpen={true}
          onClose={() => setIsCreatingTestUser(false)}
          title="Buat Akun Uji Coba (Test User)"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newUserName.trim() || !newUserEmail.trim()) {
                toast.error("Nama dan Email wajib diisi.");
                return;
              }
              setCreatingUser(true);
              try {
                const token = await auth.currentUser?.getIdToken();
                const res = await fetch('/api/admin/create-test-user', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    name: newUserName.trim(),
                    email: newUserEmail.trim(),
                    role: newUserRole,
                  }),
                });
                const data = await res.json();
                if (res.ok) {
                  toast.success(`Akun uji coba '${newUserName}' (${newUserRole}) berhasil dibuat!`);
                  setIsCreatingTestUser(false);
                } else {
                  toast.error(data.error || 'Gagal membuat akun uji coba.');
                }
              } catch (err: any) {
                toast.error('Gagal membuat akun uji coba: ' + err.message);
              } finally {
                setCreatingUser(false);
              }
            }}
            className="space-y-4"
          >
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300">
              Akun uji coba akan didaftarkan ke koleksi pengguna Firestore dengan peran kanonik yang dipilih untuk memvalidasi batasan hak akses sistem.
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--color-text-primary)]">Nama Pengguna *</label>
              <Input
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Contoh: Drafter Budi (Test TEAM)"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--color-text-primary)]">Email Pengguna *</label>
              <Input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="Contoh: drafter.budi@mdrawing.local"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--color-text-primary)]">Peran Kanonik *</label>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm focus:ring-2"
              >
                {CANONICAL_ROLES.map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border)]">
              <Button type="button" variant="ghost" onClick={() => setIsCreatingTestUser(false)} disabled={creatingUser}>
                Batal
              </Button>
              <Button type="submit" disabled={creatingUser}>
                {creatingUser ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Membuat...
                  </>
                ) : (
                  'Buat Akun'
                )}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
