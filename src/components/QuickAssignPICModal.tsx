import React, { useState } from 'react';
import { AppUser, DrawingItem } from '../types';
import { Modal, Button, Badge, Input } from './ui';
import { UserCheck, UserX, Search, Sparkles, Shield, Mail } from 'lucide-react';

interface QuickAssignPICModalProps {
  item: DrawingItem | null;
  isOpen: boolean;
  onClose: () => void;
  teamUsers: AppUser[];
  onAssign: (itemId: string, picId: string, picName: string) => Promise<void>;
  currentUserId?: string;
  currentUserName?: string;
}

export function QuickAssignPICModal({
  item,
  isOpen,
  onClose,
  teamUsers,
  onAssign,
  currentUserId,
  currentUserName,
}: QuickAssignPICModalProps) {
  const [search, setSearch] = useState('');
  const [customName, setCustomName] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen || !item) return null;

  const filteredUsers = teamUsers.filter(u => {
    const nameMatch = u.name?.toLowerCase().includes(search.toLowerCase());
    const emailMatch = u.email?.toLowerCase().includes(search.toLowerCase());
    const roleMatch = u.role.toLowerCase().includes(search.toLowerCase());
    return nameMatch || emailMatch || roleMatch;
  });

  const handleSelectUser = async (u: AppUser) => {
    setSaving(true);
    try {
      await onAssign(item.id, u.uid, u.name || u.email || 'Drafter');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleAssignSelf = async () => {
    if (!currentUserId) return;
    setSaving(true);
    try {
      await onAssign(item.id, currentUserId, currentUserName || 'Saya');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async () => {
    setSaving(true);
    try {
      await onAssign(item.id, '', '');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCustomName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    setSaving(true);
    try {
      await onAssign(item.id, '', customName.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tugaskan PIC Drafter"
    >
      <div className="space-y-4">
        {/* Drawing Context Card */}
        <div className="p-3 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[var(--color-accent-blue)]">
                {item.drawingNumber || 'Tanpa No'}
              </span>
              <span className="text-xs font-semibold text-[var(--color-text-primary)] line-clamp-1">
                {item.drawingName}
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
              PIC Saat ini:{' '}
              {item.picName ? (
                <strong className="text-[var(--color-text-primary)]">{item.picName}</strong>
              ) : (
                <span className="text-amber-500 italic">Belum ditugaskan</span>
              )}
            </p>
          </div>
          {item.picName && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnassign}
              disabled={saving}
              className="text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 h-7"
            >
              <UserX className="w-3.5 h-3.5 mr-1" /> Lepas PIC
            </Button>
          )}
        </div>

        {/* Quick Assign to Me */}
        {currentUserId && (
          <button
            type="button"
            onClick={handleAssignSelf}
            disabled={saving}
            className="w-full flex items-center justify-between p-2.5 rounded-xl border border-[var(--color-accent-blue)]/30 bg-[var(--color-accent-blue)]/10 hover:bg-[var(--color-accent-blue)]/20 transition-all text-xs font-medium text-[var(--color-accent-blue)]"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Tugaskan Langsung ke Saya ({currentUserName || 'User'})
            </span>
            <UserCheck className="w-4 h-4" />
          </button>
        )}

        {/* Search Team Members */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--color-text-primary)] block">
            Pilih dari Anggota Tim Terdaftar
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, email, atau role tim..."
              className="pl-8 text-xs h-8"
            />
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-[var(--color-border)]/50 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)]">
            {filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--color-text-tertiary)] italic">
                Tidak ada pengguna cocok dengan pencarian.
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = item.picId === u.uid || item.picName === u.name;
                const initials = (u.name || u.email || 'D')
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                return (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() => handleSelectUser(u)}
                    disabled={saving}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--color-bg-secondary)] transition-colors text-xs ${
                      isSelected ? 'bg-[var(--color-accent-blue)]/10 font-semibold' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                        {initials}
                      </div>
                      <div className="truncate">
                        <div className="text-[var(--color-text-primary)] truncate font-medium">
                          {u.name || u.email}
                        </div>
                        <div className="text-[11px] text-[var(--color-text-secondary)] truncate">
                          {u.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <Badge variant="default" className="text-xs px-2 py-0.5 font-medium">
                        {u.role}
                      </Badge>
                      {isSelected && <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Or Input Custom Drafter Name */}
        <form onSubmit={handleSaveCustomName} className="space-y-2 pt-2 border-t border-[var(--color-border)]">
          <label className="text-xs font-semibold text-[var(--color-text-primary)] block">
            Atau Masukkan Nama PIC Manual (Eksternal / Freelancer)
          </label>
          <div className="flex gap-2">
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Contoh: Budi Santoso (Drafter Eksternal)"
              className="text-xs h-8 flex-1"
            />
            <Button type="submit" size="sm" disabled={!customName.trim() || saving} className="h-8 text-xs">
              Simpan
            </Button>
          </div>
        </form>

        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Tutup
          </Button>
        </div>
      </div>
    </Modal>
  );
}
