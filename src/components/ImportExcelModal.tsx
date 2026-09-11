import React, { useRef, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Modal, Button, Badge } from './ui';
import { 
  Upload, AlertCircle, CheckCircle2, AlertTriangle, FileSpreadsheet, 
  Download, Filter, CheckSquare, Square, RefreshCw 
} from 'lucide-react';
import { DrawingGroup, DrawingItem } from '../types';
import toast from 'react-hot-toast';

interface ParsedPreviewRow {
  id: string;
  rowNumber: number;
  selected: boolean;
  isValid: boolean;
  isDuplicate: boolean;
  errorReason?: string;
  groupName: string;
  drawingNumber: string;
  drawingName: string;
  scale: string;
  picName: string;
  deadline: string;
  status: string;
  progress: number;
  priority: 'Rendah' | 'Normal' | 'Tinggi' | 'Urgent';
  notes: string;
}

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (groups: Partial<DrawingGroup>[], items: Partial<DrawingItem>[]) => Promise<void>;
  existingGroups?: DrawingGroup[];
  existingItems?: DrawingItem[];
}

export function ImportExcelModal({
  isOpen,
  onClose,
  onImport,
  existingGroups = [],
  existingItems = []
}: ImportExcelModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedPreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'valid' | 'duplicate' | 'error'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingNumbersSet = useMemo(() => {
    return new Set(existingItems.map(i => i.drawingNumber.trim().toLowerCase()));
  }, [existingItems]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    parseExcel(selected);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls') || droppedFile.name.endsWith('.csv'))) {
      setFile(droppedFile);
      parseExcel(droppedFile);
    } else {
      toast.error('Harap unggah file spreadsheet Excel (.xlsx, .xls, .csv)');
    }
  };

  const downloadSampleTemplate = () => {
    try {
      const sampleData = [
        ['Grup', 'No. Gambar', 'Nama Gambar', 'Skala', 'PIC', 'Deadline', 'Status', 'Progress', 'Prioritas', 'Catatan'],
        ['Arsitektur', 'ARS-01', 'Denah Lantai 1', '1:100', 'Ahmad Drafter', '2026-09-20', 'Proses', 40, 'Normal', 'Revisi bukaan pintu'],
        ['Arsitektur', 'ARS-02', 'Tampak Depan & Samping', '1:100', 'Ahmad Drafter', '2026-09-25', 'Belum Mulai', 0, 'Normal', '-'],
        ['Struktur', 'STR-01', 'Rencana Pondasi & Kolom', '1:50', 'Budi Struktur', '2026-09-18', 'Proses', 60, 'Tinggi', 'Perlu konfirmasi soil test'],
        ['MEP', 'MEP-01', 'Instalasi Titik Lampu & Saklar', '1:100', 'Citra MEP', '2026-09-28', 'Belum Mulai', 0, 'Normal', '-'],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sampleData);
      // Auto width
      ws['!cols'] = [
        { wch: 15 }, { wch: 14 }, { wch: 30 }, { wch: 10 }, 
        { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 30 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template Daftar Gambar');
      XLSX.writeFile(wb, 'Template_Daftar_Gambar_MDrawing.xlsx');
      toast.success('Template Excel berhasil diunduh!');
    } catch {
      toast.error('Gagal membuat template Excel.');
    }
  };

  const parseExcel = async (f: File) => {
    setParsing(true);
    try {
      const data = await f.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[];

      if (rawRows.length === 0) {
        toast.error('File Excel kosong atau tidak memiliki baris data.');
        setParsedRows([]);
        setParsing(false);
        return;
      }

      const rows: ParsedPreviewRow[] = rawRows.map((row, index) => {
        // Flexible key matching
        const findVal = (keys: string[]) => {
          for (const k of keys) {
            for (const rowKey of Object.keys(row)) {
              if (rowKey.trim().toLowerCase() === k.toLowerCase()) {
                return String(row[rowKey] || '').trim();
              }
            }
          }
          return '';
        };

        const groupName = findVal(['Grup', 'Group', 'Kelompok', 'Header', 'Kategori']) || 'Umum';
        const drawingNumber = findVal(['No. Gambar', 'No Gambar', 'Kode Gambar', 'Kode', 'Drawing Number', 'Nomor Gambar', 'No']);
        const drawingName = findVal(['Nama Gambar', 'Judul Gambar', 'Nama', 'Judul', 'Title', 'Drawing Name']);
        const scale = findVal(['Skala', 'Scale']) || '1:100';
        const picName = findVal(['PIC', 'Drafter', 'Penanggung Jawab', 'PIC Name']);
        const deadlineRaw = findVal(['Deadline', 'Tenggat', 'Target', 'Batas Waktu']);
        const statusRaw = findVal(['Status', 'Kondisi']);
        const progressRaw = findVal(['Progress', 'Progress (%)', 'Progres', '%']);
        const priorityRaw = findVal(['Prioritas', 'Priority']);
        const notes = findVal(['Catatan', 'Notes', 'Keterangan', 'Revisi']) || '';

        // Format deadline safely (supports YYYY-MM-DD or DD/MM/YYYY or Excel date number)
        let deadline = '';
        if (deadlineRaw) {
          if (!isNaN(Number(deadlineRaw)) && Number(deadlineRaw) > 20000) {
            // Excel serial date
            const dateObj = new Date(Math.round((Number(deadlineRaw) - 25569) * 86400 * 1000));
            deadline = dateObj.toISOString().split('T')[0];
          } else {
            const cleanD = String(deadlineRaw).replace(/\//g, '-');
            const dParts = cleanD.split('-');
            if (dParts.length === 3 && dParts[0] && dParts[1] && dParts[2]) {
              if (dParts[0].length === 4) {
                deadline = `${dParts[0]}-${(dParts[1] || '01').padStart(2, '0')}-${(dParts[2] || '01').padStart(2, '0')}`;
              } else if (dParts[2].length === 4) {
                deadline = `${dParts[2]}-${(dParts[1] || '01').padStart(2, '0')}-${(dParts[0] || '01').padStart(2, '0')}`;
              }
            }
          }
        }

        // Parse progress
        let progress = 0;
        const pNum = Number(String(progressRaw || '').replace('%', '').trim());
        if (!isNaN(pNum) && pNum >= 0 && pNum <= 100) {
          progress = pNum;
        }

        // Parse status
        let status = 'Belum Mulai';
        if (['selesai', 'done', 'approved'].includes(statusRaw.toLowerCase())) status = 'Selesai';
        else if (['revisi', 'revision'].includes(statusRaw.toLowerCase())) status = 'Revisi';
        else if (['review', 'dicek'].includes(statusRaw.toLowerCase())) status = 'Review';
        else if (['hold', 'tertunda'].includes(statusRaw.toLowerCase())) status = 'Hold';
        else if (['proses', 'in progress', 'pengerjaan'].includes(statusRaw.toLowerCase()) || progress > 0) status = 'Proses';

        // Parse priority
        let priority: 'Rendah' | 'Normal' | 'Tinggi' | 'Urgent' = 'Normal';
        const pLower = priorityRaw.toLowerCase();
        if (pLower.includes('urgent') || pLower.includes('darurat')) priority = 'Urgent';
        else if (pLower.includes('tinggi') || pLower.includes('high')) priority = 'Tinggi';
        else if (pLower.includes('rendah') || pLower.includes('low')) priority = 'Rendah';

        // Validation
        const isDuplicate = Boolean(drawingNumber && existingNumbersSet.has(drawingNumber.toLowerCase()));
        let isValid = true;
        let errorReason: string | undefined;

        if (!drawingName) {
          isValid = false;
          errorReason = 'Nama Gambar kosong';
        } else if (!drawingNumber) {
          isValid = false;
          errorReason = 'No. Gambar kosong';
        }

        return {
          id: `preview-${index}-${Date.now()}`,
          rowNumber: index + 2,
          selected: isValid,
          isValid,
          isDuplicate,
          errorReason,
          groupName,
          drawingNumber,
          drawingName,
          scale,
          picName,
          deadline,
          status,
          progress,
          priority,
          notes
        };
      });

      setParsedRows(rows);
      const validCount = rows.filter(r => r.isValid).length;
      toast.success(`Berhasil membaca ${rows.length} baris. ${validCount} baris siap diimpor.`);
    } catch (err: any) {
      toast.error('Gagal membaca file Excel: ' + (err.message || 'Format tidak dikenali'));
      setParsedRows([]);
    } finally {
      setParsing(false);
    }
  };

  const toggleSelectRow = (id: string) => {
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  };

  const toggleSelectAll = () => {
    const areAllSelected = parsedRows.filter(r => r.isValid).every(r => r.selected);
    setParsedRows(prev => prev.map(r => r.isValid ? { ...r, selected: !areAllSelected } : r));
  };

  const filteredRows = useMemo(() => {
    if (filterMode === 'valid') return parsedRows.filter(r => r.isValid && !r.isDuplicate);
    if (filterMode === 'duplicate') return parsedRows.filter(r => r.isDuplicate);
    if (filterMode === 'error') return parsedRows.filter(r => !r.isValid);
    return parsedRows;
  }, [parsedRows, filterMode]);

  const stats = useMemo(() => {
    const total = parsedRows.length;
    const valid = parsedRows.filter(r => r.isValid).length;
    const duplicates = parsedRows.filter(r => r.isDuplicate).length;
    const errors = parsedRows.filter(r => !r.isValid).length;
    const selected = parsedRows.filter(r => r.selected).length;
    return { total, valid, duplicates, errors, selected };
  }, [parsedRows]);

  const handleExecuteImport = async () => {
    const rowsToImport = parsedRows.filter(r => r.selected && r.isValid);
    if (rowsToImport.length === 0) {
      toast.error('Tidak ada baris valid yang dipilih untuk diimpor.');
      return;
    }

    setLoading(true);
    try {
      // 1. Group resolution
      const groupMap = new Map<string, string>();
      // Seed with existing groups
      existingGroups.forEach(g => {
        groupMap.set(g.groupName.trim().toLowerCase(), g.id);
      });

      const newGroupsToCreate: Partial<DrawingGroup>[] = [];
      let sortOrderOffset = existingGroups.length;

      rowsToImport.forEach(row => {
        const cleanGName = row.groupName.trim();
        const key = cleanGName.toLowerCase();
        if (!groupMap.has(key)) {
          const newGroupId = crypto.randomUUID();
          groupMap.set(key, newGroupId);
          newGroupsToCreate.push({
            id: newGroupId,
            groupName: cleanGName,
            groupCode: cleanGName.substring(0, 3).toUpperCase(),
            sortOrder: sortOrderOffset++,
          });
        }
      });

      // 2. Item creation
      let itemSortOrder = existingItems.length;
      const newItemsToCreate: Partial<DrawingItem>[] = rowsToImport.map(row => {
        const groupId = groupMap.get(row.groupName.trim().toLowerCase()) || null;
        return {
          groupId,
          drawingNumber: row.drawingNumber,
          drawingName: row.drawingName,
          scale: row.scale,
          picName: row.picName || '',
          deadline: row.deadline || '',
          status: row.status as any,
          progress: row.progress,
          priority: row.priority,
          notes: row.notes,
          sortOrder: itemSortOrder++,
        };
      });

      await onImport(newGroupsToCreate, newItemsToCreate);
      toast.success(`Berhasil mengimpor ${newItemsToCreate.length} gambar!`);
      handleReset();
      onClose();
    } catch (err: any) {
      toast.error('Gagal melakukan impor: ' + (err.message || 'Kesalahan sistem'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setFilterMode('all');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Impor Daftar Gambar dari Excel (XLSX)" 
      maxWidth="max-w-5xl"
    >
      <div className="space-y-4">
        {/* Step 1: Upload Dropzone if no file loaded */}
        {parsedRows.length === 0 && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-10 text-center hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-all cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3.5 group-hover:scale-105 transition-transform shadow-sm">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Pilih atau Geser File Excel (.xlsx, .xls, .csv) ke Sini
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-md mx-auto font-medium">
                Sistem akan memindai kolom Grup, No. Gambar, Nama Gambar, Skala, PIC, Deadline, dan Progress secara otomatis.
              </p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx, .xls, .csv"
                className="hidden"
              />
            </div>

            {/* Template Download Prompt */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80 text-xs">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  Butuh contoh format kolom yang direkomendasikan?
                </span>
              </div>
              <button
                type="button"
                onClick={downloadSampleTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                Unduh Template Excel
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Interactive Table Preview */}
        {parsedRows.length > 0 && (
          <div className="space-y-4">
            {/* Top Toolbar & Summary Badges */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                  {file?.name}
                </span>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 ml-1"
                >
                  <RefreshCw className="w-3 h-3" /> Ganti File
                </button>
              </div>

              {/* Badges / Filters */}
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    filterMode === 'all'
                      ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-zinc-700'
                  }`}
                >
                  Semua ({stats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('valid')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    filterMode === 'valid'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  Valid ({stats.valid - stats.duplicates})
                </button>
                {stats.duplicates > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterMode('duplicate')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      filterMode === 'duplicate'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    Duplikat ({stats.duplicates})
                  </button>
                )}
                {stats.errors > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterMode('error')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      filterMode === 'error'
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                    }`}
                  >
                    Error ({stats.errors})
                  </button>
                )}
              </div>
            </div>

            {/* Preview Table */}
            <div className="border border-slate-200 dark:border-zinc-700 rounded-xl overflow-hidden max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 font-semibold sticky top-0 z-10 border-b border-slate-300 dark:border-zinc-700">
                  <tr>
                    <th className="p-2.5 w-10 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                        title="Pilih / Batalkan Semua Valid"
                      >
                        {stats.selected === stats.valid && stats.valid > 0 ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="p-2.5 w-24">Status</th>
                    <th className="p-2.5">Grup</th>
                    <th className="p-2.5 w-28">No. Gambar</th>
                    <th className="p-2.5">Nama Gambar</th>
                    <th className="p-2.5 w-16">Skala</th>
                    <th className="p-2.5 w-24">PIC</th>
                    <th className="p-2.5 w-24">Deadline</th>
                    <th className="p-2.5 w-16">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                  {filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => row.isValid && toggleSelectRow(row.id)}
                      className={`transition-colors ${
                        !row.isValid
                          ? 'bg-red-50/50 dark:bg-red-950/20 text-slate-400'
                          : row.selected
                          ? 'bg-blue-50/60 dark:bg-blue-950/30 cursor-pointer'
                          : 'hover:bg-slate-50 dark:hover:bg-zinc-800/40 cursor-pointer'
                      }`}
                    >
                      <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={!row.isValid}
                          onClick={() => toggleSelectRow(row.id)}
                          className={row.isValid ? 'text-slate-700 dark:text-slate-200' : 'opacity-30 cursor-not-allowed'}
                        >
                          {row.selected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </td>
                      <td className="p-2.5 whitespace-nowrap">
                        {!row.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded">
                            <AlertCircle className="w-3 h-3" /> {row.errorReason}
                          </span>
                        ) : row.isDuplicate ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded">
                            <AlertTriangle className="w-3 h-3" /> Duplikat
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3" /> Siap
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">
                        {row.groupName}
                      </td>
                      <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {row.drawingNumber || '-'}
                      </td>
                      <td className="p-2.5 font-medium text-slate-900 dark:text-slate-100">
                        {row.drawingName || '-'}
                      </td>
                      <td className="p-2.5 font-medium text-slate-700 dark:text-slate-300">{row.scale}</td>
                      <td className="p-2.5 font-medium text-slate-700 dark:text-slate-300">{row.picName || '-'}</td>
                      <td className="p-2.5 font-medium text-slate-700 dark:text-slate-300">{row.deadline || '-'}</td>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">
                        {row.progress}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-zinc-700">
              <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Terpilih: <strong className="text-slate-900 dark:text-slate-200">{stats.selected}</strong> dari {stats.valid} baris valid
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={handleReset} disabled={loading}>
                  Batal / Reset
                </Button>
                <Button 
                  type="button" 
                  variant="primary" 
                  onClick={handleExecuteImport} 
                  disabled={loading || stats.selected === 0}
                  className="gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  {loading ? 'Memproses Impor...' : `Impor (${stats.selected}) Gambar`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
