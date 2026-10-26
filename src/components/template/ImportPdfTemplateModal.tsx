import React, { useState, useRef } from 'react';
import { Modal, Button, Input, Badge } from '../ui';
import { 
  FileUp, FileText, CheckCircle2, AlertCircle, Plus, 
  Trash2, Layers, RefreshCw, Sparkles, ArrowRight, Eye
} from 'lucide-react';
import { apiRequest } from '../../lib/commandClient';
import { useDrawingTemplates } from '../../context/DrawingTemplateContext';
import { STANDARD_CAD_SCALES } from '../../lib/scaleUtils';
import toast from 'react-hot-toast';

interface ParsedItem {
  drawingNumber: string;
  drawingName: string;
  scale: string;
  notes?: string;
}

interface ParsedGroup {
  groupName: string;
  groupCode?: string;
  items: ParsedItem[];
}

interface ParsedData {
  templateName: string;
  projectType: string;
  description: string;
  totalPages: number;
  totalItems: number;
  groups: ParsedGroup[];
  rawTextPreview?: string;
}

interface ImportPdfTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportPdfTemplateModal: React.FC<ImportPdfTemplateModalProps> = ({ isOpen, onClose }) => {
  const { importTemplateFromParsedData } = useDrawingTemplates();

  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showRawText, setShowRawText] = useState(false);

  // Parsed and editable state
  const [templateName, setTemplateName] = useState('');
  const [projectType, setProjectType] = useState('Rumah Tinggal');
  const [description, setDescription] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [groups, setGroups] = useState<ParsedGroup[]>([]);
  const [rawText, setRawText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setIsLoading(false);
    setIsSaving(false);
    setShowRawText(false);
    setTemplateName('');
    setProjectType('Rumah Tinggal');
    setDescription('');
    setTotalPages(1);
    setGroups([]);
    setRawText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processPdfFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf' || droppedFile.name.toLowerCase().endsWith('.pdf')) {
        processPdfFile(droppedFile);
      } else {
        toast.error('File harus berformat PDF (.pdf)');
      }
    }
  };

  const processPdfFile = async (pdfFile: File) => {
    setFile(pdfFile);
    setIsLoading(true);

    try {
      // Convert file to Base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(pdfFile);
      const base64Data = await base64Promise;

      // Call parse-pdf endpoint
      const response = await apiRequest('/api/templates/parse-pdf', {
        pdfBase64: base64Data,
        fileName: pdfFile.name,
      });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Gagal memproses struktur PDF.');
      }

      setTemplateName(response.templateName || pdfFile.name.replace(/\.pdf$/i, ''));
      setProjectType(response.projectType || 'Umum');
      setDescription(response.description || `Diimpor dari file PDF: ${pdfFile.name}`);
      setTotalPages(response.totalPages || 1);
      setGroups(response.groups || []);
      setRawText(response.rawTextPreview || '');

      setStep('review');
      toast.success(`PDF berhasil dibaca: ${response.totalPages} halaman (${response.totalItems} gambar terdeteksi)`);
    } catch (err: any) {
      console.error('Error parsing PDF template:', err);
      toast.error(err.message || 'Gagal membaca isi PDF.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handlers for Editing Parsed Groups & Items ---
  const handleItemChange = (groupIndex: number, itemIndex: number, field: keyof ParsedItem, value: string) => {
    setGroups(prev => {
      const next = [...prev];
      const g = { ...next[groupIndex] };
      const items = [...g.items];
      items[itemIndex] = { ...items[itemIndex], [field]: value };
      g.items = items;
      next[groupIndex] = g;
      return next;
    });
  };

  const handleDeleteItem = (groupIndex: number, itemIndex: number) => {
    setGroups(prev => {
      const next = [...prev];
      const g = { ...next[groupIndex] };
      g.items = g.items.filter((_, idx) => idx !== itemIndex);
      next[groupIndex] = g;
      return next;
    });
  };

  const handleAddItem = (groupIndex: number) => {
    setGroups(prev => {
      const next = [...prev];
      const g = { ...next[groupIndex] };
      const code = g.groupCode || 'AR';
      const count = g.items.length + 1;
      const numStr = count.toString().padStart(2, '0');
      g.items = [
        ...g.items,
        {
          drawingNumber: `${code}-${numStr}`,
          drawingName: 'Nama Gambar Baru',
          scale: '1:100',
        },
      ];
      next[groupIndex] = g;
      return next;
    });
  };

  const handleGroupNameChange = (groupIndex: number, newName: string) => {
    setGroups(prev => {
      const next = [...prev];
      next[groupIndex] = { ...next[groupIndex], groupName: newName.toUpperCase() };
      return next;
    });
  };

  const handleDeleteGroup = (groupIndex: number) => {
    setGroups(prev => prev.filter((_, idx) => idx !== groupIndex));
  };

  const handleAddGroup = () => {
    setGroups(prev => [
      ...prev,
      {
        groupName: 'KATEGORI GAMBAR BARU',
        groupCode: 'GBR',
        items: [
          {
            drawingNumber: 'GBR-01',
            drawingName: 'Nama Lembar Gambar',
            scale: '1:100',
          },
        ],
      },
    ]);
  };

  // --- Save to Firestore ---
  const handleSave = async () => {
    if (!templateName.trim()) {
      toast.error('Nama Template wajib diisi');
      return;
    }

    const totalValidItems = groups.reduce((acc, g) => acc + g.items.length, 0);
    if (totalValidItems === 0) {
      toast.error('Minimal harus ada 1 item gambar pada template');
      return;
    }

    setIsSaving(true);
    try {
      await importTemplateFromParsedData({
        templateName: templateName.trim(),
        projectType: projectType.trim() || 'Umum',
        description: description.trim() || `Diimpor dari file PDF (${totalPages} Halaman, Total ${totalValidItems} Gambar).`,
        groups,
      });

      handleClose();
    } catch (err: any) {
      console.error('Gagal menyimpan template:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const totalItemCount = groups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Impor Template Gambar dari PDF"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-6">
        {step === 'upload' ? (
          <div className="space-y-4">
            {/* Instruction Banner */}
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-blue-900 dark:text-blue-200">
                  Impor Multi-Halaman Otomatis (1 Lembar, 2 Lembar, atau Lebih)
                </p>
                <p className="text-blue-700 dark:text-blue-300 leading-relaxed">
                  Unggah file PDF Daftar Gambar Kerja (Drawing Index / Schedule). Sistem membaca seluruh halaman PDF dan mengekstrak nomor gambar, judul, serta skala ke dalam kelompok disiplin (Arsitektur, Struktur, MEP, dsb.).
                </p>
              </div>
            </div>

            {/* Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--color-border)] hover:border-blue-500 rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[var(--color-surface)] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] text-center group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shadow-xs">
                {isLoading ? (
                  <RefreshCw className="w-7 h-7 animate-spin" />
                ) : (
                  <FileUp className="w-7 h-7" />
                )}
              </div>

              <h4 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">
                {isLoading ? 'Sedang Membaca & Mengekstrak Isi PDF...' : 'Pilih File PDF atau Tarik & Lepas ke Sini'}
              </h4>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mb-4">
                Mendukung dokumen PDF 2 halaman atau lebih. Maksimal ukuran file 25 MB.
              </p>

              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isLoading}
                className="pointer-events-none"
              >
                {isLoading ? 'Memproses...' : 'Telusuri File PDF'}
              </Button>
            </div>
          </div>
        ) : (
          /* Step 2: Review & Edit Parsed Template */
          <div className="space-y-6">
            {/* Header Summary Card */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    PDF Berhasil Dibaca ({totalPages} Halaman)
                  </h4>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Terdeteksi {groups.length} Kategori dan <strong>{totalItemCount} Lembar Gambar Berurutan (No. 1 s/d No. {totalItemCount})</strong>. Anda dapat meninjau dan mengedit data sebelum disimpan.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowRawText(!showRawText)}
                  className="text-xs gap-1 h-8"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showRawText ? 'Sembunyikan Teks' : 'Lihat Teks Asli'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setStep('upload')}
                  className="text-xs h-8"
                >
                  Ganti File
                </Button>
              </div>
            </div>

            {/* Optional Raw Text Debug Preview */}
            {showRawText && (
              <div className="p-3 bg-slate-50 dark:bg-black/40 rounded-xl border border-slate-200 dark:border-white/10">
                <p className="text-[11px] font-bold text-[var(--color-text-secondary)] mb-1">
                  Teks Mentah yang Diekstrak dari {totalPages} Halaman PDF:
                </p>
                <pre className="text-[11px] font-mono text-[var(--color-text-secondary)] max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {rawText || 'Tidak ada pratinjau teks.'}
                </pre>
              </div>
            )}

            {/* Template Information Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[var(--color-text-primary)] block mb-1">
                  Nama Template Gambar *
                </label>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Contoh: Standar Gambar Villa 2 Lantai"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-text-primary)] block mb-1">
                  Tipe Bangunan / Proyek *
                </label>
                <select
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  className="w-full h-10 px-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-primary)]"
                >
                  <option value="Rumah Tinggal">Rumah Tinggal</option>
                  <option value="Villa">Villa</option>
                  <option value="Ruko / Komersial">Ruko / Komersial</option>
                  <option value="Gedung / Kantor">Gedung / Kantor</option>
                  <option value="Interior">Interior</option>
                  <option value="Gudang / Pabrik">Gudang / Pabrik</option>
                  <option value="Umum">Umum</option>
                </select>
              </div>

              <div className="col-span-full">
                <label className="text-xs font-bold text-[var(--color-text-primary)] block mb-1">
                  Deskripsi Template
                </label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Keterangan singkat template..."
                />
              </div>
            </div>

            {/* Groups & Items Table Editor */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Daftar Lembar Gambar per Kategori
                </h4>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleAddGroup}
                  className="text-xs gap-1.5 h-8"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Kategori
                </Button>
              </div>

              {groups.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-[var(--color-border)] rounded-xl p-4">
                  <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                    Tidak ada baris gambar yang terdeteksi otomatis. Silakan tambah kategori secara manual.
                  </p>
                  <Button size="sm" onClick={handleAddGroup}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Buat Kategori Pertama
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                  {(() => {
                    const groupOffsets = new Map<number, number>();
                    let runningCount = 0;
                    groups.forEach((g, idx) => {
                      groupOffsets.set(idx, runningCount);
                      runningCount += g.items.length;
                    });

                    return groups.map((group, gIdx) => {
                      const gOffset = groupOffsets.get(gIdx) || 0;
                      const gStart = group.items.length > 0 ? gOffset + 1 : 0;
                      const gEnd = gOffset + group.items.length;

                      return (
                        <div
                          key={gIdx}
                          className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3 shadow-xs"
                        >
                          {/* Group Header */}
                          <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] pb-2.5">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Layers className="w-4 h-4 text-blue-600 shrink-0" />
                              <input
                                type="text"
                                value={group.groupName}
                                onChange={(e) => handleGroupNameChange(gIdx, e.target.value)}
                                className="font-bold text-xs bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 text-[var(--color-text-primary)] px-1 py-0.5 outline-hidden flex-1"
                                placeholder="NAMA KATEGORI"
                              />
                              <Badge variant="default" className="text-[11px] shrink-0 font-bold font-mono">
                                Lembar No. {gStart} – {gEnd} ({group.items.length} Gambar)
                              </Badge>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleAddItem(gIdx)}
                                className="h-7 px-2 text-[11px] gap-1 text-blue-600"
                                title="Tambah Baris Gambar"
                              >
                                <Plus className="w-3 h-3" /> Tambah
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteGroup(gIdx)}
                                className="h-7 px-2 text-[11px] text-rose-500 hover:text-rose-700"
                                title="Hapus Kategori Ini"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Table Header Legend */}
                          <div className="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                            <span className="w-16 shrink-0 text-center">NO. LEMBAR</span>
                            <span className="w-24 shrink-0">KODE GAMBAR</span>
                            <span className="flex-1 min-w-0">JUDUL GAMBAR KERJA</span>
                            <span className="w-20 shrink-0 text-center">SKALA</span>
                            <span className="w-6 shrink-0 text-center">AKSI</span>
                          </div>

                          {/* Items Rows */}
                          <div className="space-y-1.5">
                            {group.items.map((item, iIdx) => {
                              const globalNo = gOffset + iIdx + 1;
                              return (
                                <div
                                  key={iIdx}
                                  className="flex items-center gap-2 p-1.5 rounded-lg bg-[var(--color-bg-secondary)]/50 hover:bg-[var(--color-bg-secondary)] transition-colors"
                                >
                                  {/* Continuous Sheet Number */}
                                  <div className="w-16 shrink-0 flex items-center justify-center">
                                    <span 
                                      className="font-mono text-xs font-bold px-1.5 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-blue-600 dark:text-blue-400 w-full text-center shadow-2xs"
                                      title={`Lembar No. ${globalNo} dari ${totalItemCount} lembar gambar`}
                                    >
                                      No. {globalNo}
                                    </span>
                                  </div>

                                  {/* Drawing Number */}
                                  <input
                                    type="text"
                                    value={item.drawingNumber}
                                    onChange={(e) => handleItemChange(gIdx, iIdx, 'drawingNumber', e.target.value)}
                                    className="w-24 shrink-0 px-2 py-1 text-xs font-mono font-bold bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)]"
                                    placeholder="AR-01"
                                  />

                                  {/* Drawing Title */}
                                  <input
                                    type="text"
                                    value={item.drawingName}
                                    onChange={(e) => handleItemChange(gIdx, iIdx, 'drawingName', e.target.value)}
                                    className="flex-1 min-w-0 px-2 py-1 text-xs font-medium bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)]"
                                    placeholder="Nama Gambar..."
                                  />

                                  {/* Scale */}
                                  <input
                                    type="text"
                                    value={item.scale}
                                    onChange={(e) => handleItemChange(gIdx, iIdx, 'scale', e.target.value)}
                                    className="w-20 shrink-0 px-2 py-1 text-xs font-mono text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)]"
                                    placeholder="1:100"
                                  />

                                  {/* Delete item button */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteItem(gIdx, iIdx)}
                                    className="w-6 shrink-0 p-1 text-slate-400 hover:text-rose-500 transition-colors flex items-center justify-center"
                                    title="Hapus lembar gambar"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-secondary)]">
                Total: <strong>{groups.length} Kategori</strong>, <strong>{totalItemCount} Gambar</strong>
              </p>

              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={handleClose} disabled={isSaving}>
                  Batal
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || totalItemCount === 0}
                  className="gap-2"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Menyimpan Template...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Simpan Sebagai Template
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
