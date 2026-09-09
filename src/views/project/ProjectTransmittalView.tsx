import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTransmittals } from '../../context/TransmittalContext';
import { useDrawings } from '../../context/DrawingContext';
import { useDocumentContext } from '../../context/DocumentContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Project, DrawingItem, DrawingTransmittal } from '../../types';
import { generateTransmittalPdf } from '../../lib/exportUtils';
import { 
  Card, Button, Input, Modal, SegmentedControl 
} from '../../components/ui';
import { 
  FileText, Download, Plus, Trash2, Send, CheckCircle2, 
  Calendar, User, AlertCircle, Eye, ChevronDown, ChevronUp, Layers 
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ProjectTransmittalViewProps {
  project: Project;
}

export function ProjectTransmittalView({ project }: ProjectTransmittalViewProps) {
  const { user, appUser } = useAuth();
  const { transmittals, loading, createTransmittal, deleteTransmittal } = useTransmittals();
  const { items } = useDrawings();
  const { companySettings, recordGeneratedDocument } = useDocumentContext();
  const { canManageTransmittal, canManageProjects } = usePermissions();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTransmittal, setSelectedTransmittal] = useState<DrawingTransmittal | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form State
  const [recipientType, setRecipientType] = useState<"Klien" | "Konsultan Pengawas" | "Kontraktor">("Klien");
  const [recipientName, setRecipientName] = useState(project.clientName || "");
  const [purpose, setPurpose] = useState<"For Review" | "For Approval" | "For Construction (IFC)" | "As-Built">("For Review");
  const [notes, setNotes] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [searchItem, setSearchItem] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filterable non-deleted items
  const activeItems = useMemo(() => {
    return items.filter(i => !i.isDeleted);
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!searchItem.trim()) return activeItems;
    const q = searchItem.toLowerCase();
    return activeItems.filter(i => 
      i.drawingName.toLowerCase().includes(q) || 
      i.drawingNumber.toLowerCase().includes(q)
    );
  }, [activeItems, searchItem]);

  const handleOpenCreateModal = () => {
    setRecipientType("Klien");
    setRecipientName(project.clientName || "");
    setPurpose("For Review");
    setNotes("");
    // Default select all active items or clear
    setSelectedItemIds(activeItems.map(i => i.id));
    setSearchItem("");
    setIsCreateModalOpen(true);
  };

  const handleToggleItem = (id: string) => {
    setSelectedItemIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedItemIds.length === filteredItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(filteredItems.map(i => i.id));
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim()) {
      toast.error("Nama penerima wajib diisi");
      return;
    }
    if (selectedItemIds.length === 0) {
      toast.error("Pilih minimal 1 gambar kerja yang dilampirkan");
      return;
    }

    setSubmitting(true);
    try {
      // Build snapshot of selected items
      const itemRevisionSnapshot = selectedItemIds.map(id => {
        const item = items.find(i => i.id === id);
        return {
          itemId: id,
          drawingNumber: item?.drawingNumber || "-",
          drawingName: item?.drawingName || "-",
          revisionNumber: item?.revisionCount === 0 || !item?.revisionCount 
            ? "Rev 0" 
            : `Rev ${item.revisionCount}`,
        };
      });

      const newTransmittal = await createTransmittal({
        projectId: project.id,
        recipientType,
        recipientName: recipientName.trim(),
        purpose,
        itemIds: selectedItemIds,
        itemRevisionSnapshot,
        notes: notes.trim(),
        issuedBy: "",
        issuedAt: new Date().toISOString(),
      });

      // Record to Document Hub
      try {
        await recordGeneratedDocument({
          documentType: "DrawingTransmittal",
          documentNumber: newTransmittal.transmittalNumber,
          title: `Transmittal ${newTransmittal.transmittalNumber} (${newTransmittal.purpose})`,
          fileFormat: "PDF",
          version: 1,
          createdBy: user?.uid || 'system',
          createdByName: appUser?.name || user?.displayName || 'Pengguna Sistem',
          projectId: project.id,
          projectName: project.projectName,
          metadata: {
            fileSize: 45000,
            recipientType: newTransmittal.recipientType,
            recipientName: newTransmittal.recipientName,
            purpose: newTransmittal.purpose,
            itemCount: newTransmittal.itemRevisionSnapshot.length,
          }
        });
      } catch (docErr) {
        console.warn("Could not record to Document Hub:", docErr);
      }

      // Automatically generate and download the PDF
      generateTransmittalPdf(newTransmittal, project, companySettings);

      setIsCreateModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Gagal menerbitkan transmittal");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = (t: DrawingTransmittal) => {
    try {
      generateTransmittalPdf(t, project, companySettings);
      toast.success(`PDF Transmittal ${t.transmittalNumber} berhasil diunduh`);
    } catch (err) {
      console.error("Download transmittal PDF error:", err);
      toast.error("Gagal mengunduh dokumen PDF transmittal");
    }
  };

  const getPurposeBadge = (p: DrawingTransmittal["purpose"]) => {
    switch (p) {
      case "For Review":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">For Review</span>;
      case "For Approval":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">For Approval</span>;
      case "For Construction (IFC)":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">For Construction (IFC)</span>;
      case "As-Built":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">As-Built</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-600">{p}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--color-accent-blue)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[var(--color-accent-blue)]" />
            Surat Pengantar Gambar (Drawing Transmittal)
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Arsip resmi serah-terima berkas gambar dengan nomor urut kanonik TRM/YYYY/MM/XXX dan kop surat PT. Asa Perdana Mandiri.
          </p>
        </div>
        <div>
          <Button
            onClick={handleOpenCreateModal}
            disabled={!canManageTransmittal()}
            title={!canManageTransmittal() ? "Memerlukan izin Terbitkan Transmittal" : undefined}
            className="flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Buat Transmittal Baru
          </Button>
        </div>
      </div>

      {/* List of Transmittals */}
      {transmittals.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <div className="w-14 h-14 bg-black/5 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-3">
            <Send className="w-7 h-7 text-[var(--color-text-secondary)]" />
          </div>
          <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
            Belum Ada Transmittal Diterbitkan
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] max-w-md mb-4">
            Terbitkan surat pengantar berkas gambar resmi untuk Klien, Konsultan Pengawas, atau Kontraktor Pelaksana dengan nomor urut otomatis dan kop surat legal.
          </p>
          {canManageTransmittal() && (
            <Button onClick={handleOpenCreateModal} size="sm" className="flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Terbitkan Transmittal Pertama
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {transmittals.map((t) => {
            const isExpanded = expandedId === t.id;
            return (
              <Card key={t.id} className="p-4 transition-all hover:shadow-md">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left info */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-[var(--color-accent-blue)] bg-blue-500/10 px-2.5 py-0.5 rounded-lg border border-blue-500/20">
                        {t.transmittalNumber}
                      </span>
                      {getPurposeBadge(t.purpose)}
                      <span className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(t.issuedAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-secondary)] mt-1">
                      <span className="flex items-center gap-1 font-medium text-[var(--color-text-primary)]">
                        <User className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                        {t.recipientType}: <span className="font-semibold">{t.recipientName}</span>
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                        {t.itemRevisionSnapshot?.length || t.itemIds.length} Berkas Gambar
                      </span>
                      <span>&bull;</span>
                      <span>Oleh: {t.issuedByName || "Drafter / Manager"}</span>
                    </div>

                    {t.notes && (
                      <p className="text-xs text-[var(--color-text-secondary)] italic bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-md mt-1.5 line-clamp-1">
                        Catatan: &ldquo;{t.notes}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end lg:self-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : t.id)}
                      className="flex items-center gap-1 text-xs"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" /> Tutup Rincian
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" /> Rincian Lampiran ({t.itemRevisionSnapshot?.length || 0})
                        </>
                      )}
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleDownloadPdf(t)}
                      className="flex items-center gap-1.5 text-xs shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Unduh PDF
                    </Button>

                    {canManageProjects() && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Yakin ingin menghapus arsip Transmittal ${t.transmittalNumber}?`)) {
                            deleteTransmittal(t.id);
                          }
                        }}
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        title="Hapus Transmittal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Collapsible Item Snapshot Details */}
                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
                    <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                      Daftar Gambar Kerja Terlampir ({t.itemRevisionSnapshot?.length || 0} berkas)
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-black/[0.02] dark:bg-white/[0.02]">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[var(--color-border)] bg-black/5 dark:bg-white/5 font-semibold text-[var(--color-text-secondary)]">
                            <th className="p-2.5 w-12 text-center">No</th>
                            <th className="p-2.5">Nomor Gambar</th>
                            <th className="p-2.5">Judul Gambar</th>
                            <th className="p-2.5 text-center">Snapshot Revisi</th>
                            <th className="p-2.5 text-center">Status Kirim</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                          {t.itemRevisionSnapshot?.map((item, idx) => (
                            <tr key={item.itemId || idx} className="hover:bg-black/5 dark:hover:bg-white/5">
                              <td className="p-2.5 text-center text-[var(--color-text-secondary)]">{idx + 1}</td>
                              <td className="p-2.5 font-mono font-semibold text-[var(--color-text-primary)]">
                                {item.drawingNumber}
                              </td>
                              <td className="p-2.5 text-[var(--color-text-primary)]">{item.drawingName}</td>
                              <td className="p-2.5 text-center">
                                <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                  {item.revisionNumber || "Rev 0"}
                                </span>
                              </td>
                              <td className="p-2.5 text-center text-emerald-600 font-medium">
                                <span className="inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Terlampir
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Buat Transmittal Baru */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => !submitting && setIsCreateModalOpen(false)}
        title="Terbitkan Surat Pengantar Gambar (Transmittal)"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-accent-blue)]" />
            <div>
              <p className="font-semibold">Format Nomor Otomatis Kanonik</p>
              <p className="mt-0.5 text-blue-700/80 dark:text-blue-300/80">
                Nomor surat digenerate otomatis menggunakan format <strong>TRM/YYYY/MM/XXX</strong> dengan nomor urut yang tidak dapat digandakan. Berkas PDF resmi ber-kop surat PT. Asa Perdana Mandiri akan langsung diunduh.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">
                Kategori Penerima *
              </label>
              <select
                className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]"
                value={recipientType}
                onChange={(e) => setRecipientType(e.target.value as any)}
              >
                <option value="Klien">Klien (Owner / Pemberi Tugas)</option>
                <option value="Konsultan Pengawas">Konsultan Pengawas (MK / Pengawas Lapangan)</option>
                <option value="Kontraktor">Kontraktor Pelaksana / Subkontraktor</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">
                Nama Penerima / Instansi *
              </label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="cth. Bpk. Hendra (PT. Mahakarya)"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">
                Tujuan Pengiriman (Purpose) *
              </label>
              <select
                className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as any)}
              >
                <option value="For Review">For Review (Pemeriksaan & Masukan)</option>
                <option value="For Approval">For Approval (Persetujuan Resmi)</option>
                <option value="For Construction (IFC)">For Construction / IFC (Pelaksanaan Lapangan)</option>
                <option value="As-Built">As-Built (Gambar Terpasang Akhir)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">
                Proyek Terkait
              </label>
              <div className="p-2.5 rounded-xl border border-[var(--color-border)] bg-black/5 dark:bg-white/5 text-sm font-medium text-[var(--color-text-primary)]">
                {project.projectName} ({project.projectCode})
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">
              Catatan Pengantar (Opsional)
            </label>
            <textarea
              className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="cth. Terlampir gambar arsitektur revisi 1 sesuai hasil rapat koordinasi tgl 12."
            />
          </div>

          {/* Item Selection Table */}
          <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">
                  Pilih Gambar Kerja yang Dilampirkan ({selectedItemIds.length} dari {activeItems.length})
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-xs py-1 h-7"
                >
                  {selectedItemIds.length === filteredItems.length ? "Hapus Semua" : "Pilih Semua"}
                </Button>
              </div>
            </div>

            <Input
              value={searchItem}
              onChange={(e) => setSearchItem(e.target.value)}
              placeholder="Cari nomor atau judul gambar..."
              className="text-xs"
            />

            <div className="max-h-56 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-black/[0.02] dark:bg-white/[0.02] p-1 divide-y divide-[var(--color-border)]">
              {filteredItems.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--color-text-secondary)]">
                  Tidak ada gambar yang cocok dengan pencarian
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isChecked = selectedItemIds.includes(item.id);
                  const revText = item.revisionCount === 0 || !item.revisionCount 
                    ? "Rev 0" 
                    : `Rev ${item.revisionCount}`;

                  return (
                    <label
                      key={item.id}
                      className="flex items-center justify-between p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleItem(item.id)}
                          className="rounded border-[var(--color-border)] text-[var(--color-accent-blue)] focus:ring-[var(--color-accent-blue)] w-4 h-4"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                            {item.drawingName}
                          </p>
                          <p className="text-[11px] font-mono text-[var(--color-text-secondary)]">
                            {item.drawingNumber}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span className="text-[11px] px-2 py-0.5 rounded font-mono font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          {revText}
                        </span>
                        <span className="text-xs text-[var(--color-text-secondary)] font-medium">
                          {item.status}
                        </span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[var(--color-border)]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || selectedItemIds.length === 0}
              className="flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Menerbitkan & Menghasilkan PDF...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Terbitkan & Unduh Transmittal
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
