import React, { useState, useEffect } from 'react';
import { useDrawings } from '../../context/DrawingContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Button, Card, Badge, Modal, Input } from '../../components/ui';
import { 
  Plus, GripVertical, Settings2, Trash2, Copy, FileEdit, 
  AlertCircle, Mail, Layers, BookmarkPlus, Upload, CheckSquare, 
  UserCheck, X, FileSpreadsheet, UserPlus, Sparkles, ListOrdered 
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { DrawingItem, DrawingItemStatus, DrawingPriority, AppUser } from '../../types';
import { EmailReminderModal } from '../../components/EmailReminderModal';
import { ApplyTemplateModal } from '../../components/ApplyTemplateModal';
import { SaveAsTemplateModal } from '../../components/SaveAsTemplateModal';
import { ImportExcelModal } from '../../components/ImportExcelModal';
import { CADSheetModal } from '../../components/CADSheetModal';
import { QuickAssignPICModal } from '../../components/QuickAssignPICModal';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatScale, STANDARD_CAD_SCALES } from '../../lib/scaleUtils';
import { generateSequentialDrawingNumbers } from '../../lib/drawingNumberUtils';
import toast from 'react-hot-toast';

export function ProjectListView({ 
  search, 
  projectName = 'Proyek',
  projectId = ''
}: { 
  search: string; 
  projectName?: string;
  projectId?: string;
}) {
  const { groups, items, reorderItems, renumberGroupItems, createGroup, deleteGroup, updateGroup, createItem, updateItem, deleteItem, duplicateItem, importItems, bulkUpdateItems } = useDrawings();
  const { canManageProjects, role, appUser } = usePermissions();
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [selectedItemForEmail, setSelectedItemForEmail] = useState<DrawingItem | null>(null);
  const [isApplyTemplateModalOpen, setIsApplyTemplateModalOpen] = useState(false);
  const [isSaveAsTemplateModalOpen, setIsSaveAsTemplateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCadSheetModalOpen, setIsCadSheetModalOpen] = useState(false);
  const [quickAssignItem, setQuickAssignItem] = useState<DrawingItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<DrawingItem | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<any | null>(null);

  // Registered Team Users for PIC assignment
  const [teamUsers, setTeamUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const uList = snap.docs.map(d => ({ uid: d.id, id: d.id, ...d.data() } as any));
      setTeamUsers(uList.filter(u => u.isActive !== false));
    });
    return () => unsub();
  }, []);

  // Bulk Selection State
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [bulkModalType, setBulkModalType] = useState<'status' | 'pic' | 'delete' | null>(null);
  const [bulkStatus, setBulkStatus] = useState<DrawingItemStatus>('Proses');
  const [bulkPicName, setBulkPicName] = useState<string>('');
  const [bulkPicId, setBulkPicId] = useState<string>('');
  const [bulkUpdating, setBulkUpdating] = useState<boolean>(false);

  const isTeam = role === 'TEAM';
  const isManager = canManageProjects();

  const visibleItems = items.filter(i => 
    !i.isDeleted && 
    (i.drawingName.toLowerCase().includes(search.toLowerCase()) || 
     i.drawingNumber.toLowerCase().includes(search.toLowerCase()) ||
     (i.picName && i.picName.toLowerCase().includes(search.toLowerCase())))
  );
  const isAllSelected = visibleItems.length > 0 && visibleItems.every(i => selectedItemIds.includes(i.id));

  const handleToggleSelect = (id: string) => {
    setSelectedItemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleToggleSelectGroup = (groupItemIds: string[]) => {
    if (groupItemIds.length === 0) return;
    const allGroupSelected = groupItemIds.every(id => selectedItemIds.includes(id));
    if (allGroupSelected) {
      setSelectedItemIds(prev => prev.filter(id => !groupItemIds.includes(id)));
    } else {
      setSelectedItemIds(prev => Array.from(new Set([...prev, ...groupItemIds])));
    }
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(visibleItems.map(i => i.id));
    }
  };

  const handleQuickAssignPIC = async (itemId: string, picId: string, picName: string) => {
    await updateItem(itemId, { picId, picName });
    toast.success(picName ? `PIC berhasil ditugaskan: ${picName}` : 'Penugasan PIC dilepas');
  };

  const canEditItem = (item: DrawingItem) => {
    if (isManager) return true;
    if (isTeam) {
      // Team can only edit status/progress/notes of their assigned item or unassigned
      return !item.picId || item.picId === appUser?.uid;
    }
    return false;
  };

  const getEditTooltip = (item: DrawingItem) => {
    if (isManager) return "Edit Gambar";
    if (isTeam) {
      if (!item.picId || item.picId === appUser?.uid) {
        return "Edit Status, Progress & Catatan (Anggota Tim)";
      }
      return `Akses terbatas: Hanya PIC (${item.picName || 'terkait'}) atau Manager yang dapat mengedit gambar ini`;
    }
    return "Akses terbatas: Memerlukan izin Kelola Proyek (Owner / Admin / Project Leader)";
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    if (!isManager) {
      toast.error("Akses terbatas: Hanya Manager yang dapat menyusun ulang urutan gambar.");
      return;
    }

    const sourceDroppable = result.source.droppableId;
    const destDroppable = result.destination.droppableId;
    const sourceGroupId = sourceDroppable.replace('group-', '');
    const destGroupId = destDroppable.replace('group-', '');

    // Reorder within the same group
    if (sourceDroppable === destDroppable) {
      const actualGroupId = sourceGroupId === 'unassigned' ? null : sourceGroupId;
      const group = groups.find(g => g.id === actualGroupId);
      
      const groupItems = items
        .filter(i => !i.isDeleted && (i.groupId || 'unassigned') === sourceGroupId)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      if (groupItems.length <= 1) return;

      const [removed] = groupItems.splice(result.source.index, 1);
      groupItems.splice(result.destination.index, 0, removed);

      // Dynamically calculate sequential drawing numbers for the new position order
      const newNumbers = generateSequentialDrawingNumbers(groupItems, group?.groupName);
      const updatedItems = groupItems.map((item, idx) => ({
        ...item,
        sortOrder: idx,
        drawingNumber: newNumbers[idx] || item.drawingNumber,
      }));

      await reorderItems(updatedItems);
      toast.success("Urutan & nomor gambar diperbarui otomatis", { id: "drag-reorder-toast", duration: 2000 });
    } else {
      // Cross-group drag & drop support
      const actualSourceId = sourceGroupId === 'unassigned' ? null : sourceGroupId;
      const actualDestId = destGroupId === 'unassigned' ? null : destGroupId;

      const sourceGroup = groups.find(g => g.id === actualSourceId);
      const destGroup = groups.find(g => g.id === actualDestId);

      const sourceItems = items
        .filter(i => !i.isDeleted && (i.groupId || 'unassigned') === sourceGroupId)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const destItems = items
        .filter(i => !i.isDeleted && (i.groupId || 'unassigned') === destGroupId)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const [removed] = sourceItems.splice(result.source.index, 1);
      const movedItemWithNewGroup = { ...removed, groupId: actualDestId };
      destItems.splice(result.destination.index, 0, movedItemWithNewGroup);

      // Renumber destination group with its dynamic sequence
      const destNumbers = generateSequentialDrawingNumbers(destItems, destGroup?.groupName);
      const updatedDestItems = destItems.map((item, idx) => ({
        ...item,
        sortOrder: idx,
        groupId: actualDestId,
        drawingNumber: destNumbers[idx] || item.drawingNumber,
      }));

      // Renumber source group
      const sourceNumbers = generateSequentialDrawingNumbers(sourceItems, sourceGroup?.groupName);
      const updatedSourceItems = sourceItems.map((item, idx) => ({
        ...item,
        sortOrder: idx,
        drawingNumber: sourceNumbers[idx] || item.drawingNumber,
      }));

      await reorderItems([...updatedDestItems, ...updatedSourceItems]);
      toast.success(
        `Gambar dipindahkan ke "${destGroup ? destGroup.groupName : 'Tanpa Grup'}" & nomor diurutkan otomatis`,
        { id: "cross-group-toast", duration: 3000 }
      );
    }
  };

  const isRestrictedTeamEdit = Boolean(editingItem && !editingItem.isNew && isTeam && !isManager);

  const renderPriorityBadge = (priority?: DrawingPriority) => {
    const p = priority || 'Normal';
    switch (p) {
      case 'Urgent':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700/60 tracking-wide inline-flex items-center gap-1 shadow-xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse inline-block shrink-0" />
            Urgent
          </span>
        );
      case 'Tinggi':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 inline-flex items-center whitespace-nowrap shadow-xs">
            Tinggi
          </span>
        );
      case 'Rendah':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-slate-500/15 border border-slate-300 dark:border-slate-700 inline-flex items-center whitespace-nowrap">
            Rendah
          </span>
        );
      case 'Normal':
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium text-[var(--color-text-tertiary)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] inline-flex items-center whitespace-nowrap">
            Normal
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Daftar Gambar Kerja</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Kelola grup, gambar kerja, status, dan riwayat revisi.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {visibleItems.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleToggleSelectAll}
              className="text-xs flex items-center gap-1.5"
            >
              <CheckSquare className="w-3.5 h-3.5 text-[var(--color-accent-blue)]" />
              {isAllSelected ? "Batal Pilih Semua" : "Pilih Semua"}
            </Button>
          )}

          {projectId && (
            <Button
              variant="secondary"
              size="sm"
              disabled={!isManager}
              title={!isManager ? "Akses terbatas: Memerlukan izin Kelola Proyek" : "Terapkan Template Master ke Proyek Ini"}
              onClick={() => setIsApplyTemplateModalOpen(true)}
            >
              <Layers className="w-4 h-4 mr-1.5 text-blue-500" /> Terapkan Template
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsCadSheetModalOpen(true)}
            title="Tampilkan Format Lembar Gambar Standar AutoCAD (Drawing Sheet)"
            className="text-xs flex items-center gap-1.5 border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10"
          >
            <FileSpreadsheet className="w-4 h-4 text-cyan-500" /> Format Lembar CAD
          </Button>

          <Button
            variant="secondary"
            size="sm"
            disabled={!isManager || items.length === 0}
            title={!isManager ? "Akses terbatas: Memerlukan izin Kelola Proyek" : "Simpan Gambar Proyek Ini Sebagai Template Baru"}
            onClick={() => setIsSaveAsTemplateModalOpen(true)}
          >
            <BookmarkPlus className="w-4 h-4 mr-1.5 text-purple-500" /> Simpan Sbg Template
          </Button>

          <Button
            variant="secondary"
            size="sm"
            disabled={!isManager}
            title={!isManager ? "Akses terbatas: Memerlukan izin Kelola Proyek" : "Impor dari file Excel"}
            onClick={() => setIsImportModalOpen(true)}
          >
            <Upload className="w-4 h-4 mr-1.5 text-emerald-500" /> Impor Excel
          </Button>

          <Button 
            variant="primary"
            size="sm"
            disabled={!isManager}
            title={!isManager ? "Akses terbatas: Memerlukan izin Kelola Proyek (Owner / Admin / Project Leader)" : "Buat Grup Baru"}
            onClick={() => {
              if (!isManager) {
                toast.error("Akses terbatas: Anda tidak memiliki wewenang membuat grup gambar.");
                return;
              }
              setEditingGroup({ isNew: true });
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Buat Grup
          </Button>
        </div>
      </div>

      {/* Integrated Bulk Action Bar (Sticky Top Banner - Tetap Terlihat & Melayang saat Di-scroll) */}
      {selectedItemIds.length > 0 && (
        <div className="sticky top-[60px] z-30 flex flex-wrap items-center justify-between gap-3 p-3 px-4 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-2 border-blue-500/40 dark:border-blue-500/60 shadow-xl shadow-blue-950/15 dark:shadow-black/70 transition-all duration-200 ring-1 ring-blue-500/20">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-[var(--color-accent-blue)] text-white text-xs font-bold flex items-center justify-center shadow-xs shrink-0">
              {selectedItemIds.length}
            </span>
            <span className="text-xs font-bold text-blue-950 dark:text-blue-100 whitespace-nowrap">
              {selectedItemIds.length} gambar dipilih
            </span>
            <span className="text-xs text-blue-600/80 dark:text-blue-400/80 hidden md:inline">
              — Pilih aksi massal:
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              disabled={!isManager && !isTeam}
              title={!isManager && !isTeam ? "Akses terbatas: Anda tidak memiliki izin mengubah status gambar" : "Ubah status gambar terpilih sekaligus"}
              onClick={() => {
                setBulkStatus('Proses');
                setBulkModalType('status');
              }}
              className="text-xs flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/70 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-semibold shadow-xs"
            >
              <CheckSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Ubah Status Massal
            </Button>

            <Button
              variant="secondary"
              size="sm"
              disabled={!isManager}
              title={!isManager ? "Akses terbatas: Hanya Manager yang dapat mengubah PIC massal" : "Tugaskan PIC baru ke gambar terpilih"}
              onClick={() => {
                setBulkPicName('');
                setBulkModalType('pic');
              }}
              className="text-xs flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/70 hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 font-semibold shadow-xs"
            >
              <UserCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              Ubah PIC Massal
            </Button>

            {isManager && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBulkModalType('delete')}
                className="text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border-rose-200 dark:border-rose-900/60 flex items-center gap-1.5 bg-rose-50/50 dark:bg-rose-950/40 font-semibold shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Massal
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedItemIds([])}
              className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-black/5 dark:hover:bg-white/10"
            >
              Batal / Bersihkan
            </Button>
          </div>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        {groups.map(group => {
          const groupItems = items
            .filter(i => i.groupId === group.id)
            .filter(i => i.drawingName.toLowerCase().includes(search.toLowerCase()) || 
                         i.drawingNumber.toLowerCase().includes(search.toLowerCase()) ||
                         (i.picName && i.picName.toLowerCase().includes(search.toLowerCase())))
            .sort((a, b) => a.sortOrder - b.sortOrder);
          
          const groupItemIds = groupItems.map(i => i.id);
          const isGroupAllSelected = groupItemIds.length > 0 && groupItemIds.every(id => selectedItemIds.includes(id));
          const isGroupPartiallySelected = groupItemIds.some(id => selectedItemIds.includes(id)) && !isGroupAllSelected;
          
          return (
            <Card key={group.id} className="p-4 mb-6 shadow-sm border-[var(--color-border)]">
              {/* Group Header */}
              <div className="flex justify-between items-center mb-3 pb-3 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-sm tracking-wide text-[var(--color-text-primary)] uppercase flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[var(--color-accent-blue)] inline-block" />
                    {group.groupName}
                  </h3>
                  <span className="text-[11px] font-mono text-[var(--color-text-tertiary)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded-full border border-[var(--color-border)]">
                    {groupItems.length} Gambar
                  </span>

                  <Button 
                    variant="ghost" 
                    size="icon" 
                    disabled={!isManager}
                    title={!isManager ? "Akses terbatas: Memerlukan izin Kelola Proyek" : "Edit Nama Grup"}
                    onClick={() => {
                      if (!isManager) {
                        toast.error("Akses terbatas: Anda tidak memiliki wewenang mengedit grup.");
                        return;
                      }
                      setEditingGroup(group);
                    }}
                    className="h-7 w-7"
                  >
                    <Settings2 className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                  </Button>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    disabled={!isManager || groupItems.length === 0}
                    title={!isManager ? "Akses terbatas: Memerlukan izin Kelola Proyek" : "Urutkan nomor gambar secara berurutan sesuai posisi saat ini"}
                    onClick={() => {
                      if (!isManager) {
                        toast.error("Akses terbatas: Anda tidak memiliki wewenang mengurutkan nomor gambar.");
                        return;
                      }
                      renumberGroupItems(group.id);
                    }}
                    className="h-8 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent-blue)]"
                  >
                    <ListOrdered className="w-3.5 h-3.5 mr-1" /> Urutkan No.
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    disabled={!isManager}
                    title={!isManager ? "Akses terbatas" : "Tambah Gambar Baru ke Grup"}
                    onClick={() => {
                      if (!isManager) {
                        toast.error("Akses terbatas: Anda tidak memiliki wewenang menambah gambar.");
                        return;
                      }
                      const nextNumbers = generateSequentialDrawingNumbers([...groupItems, { drawingNumber: '' }], group.groupName);
                      const suggestedNextNumber = nextNumbers[nextNumbers.length - 1] || '';
                      setEditingItem({ groupId: group.id, isNew: true, drawingNumber: suggestedNextNumber });
                    }}
                    className="h-8 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Gambar
                  </Button>
                </div>
              </div>

              {/* Redesigned Table Column Headers - AutoCAD Standard Alignment */}
              <div className="hidden lg:grid grid-cols-[55px_100px_minmax(0,1fr)_65px_80px_130px_110px_65px_120px] gap-2 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)] border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60 rounded-t-lg items-center">
                <div className="flex items-center gap-2 pl-0.5">
                  <input
                    type="checkbox"
                    title={isGroupAllSelected ? "Batalkan pilihan semua gambar di grup ini" : "Pilih semua gambar di grup ini"}
                    checked={isGroupAllSelected}
                    ref={el => {
                      if (el) el.indeterminate = isGroupPartiallySelected;
                    }}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleToggleSelectGroup(groupItemIds);
                    }}
                    className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-accent-blue)] focus:ring-[var(--color-accent-blue)] cursor-pointer shrink-0"
                  />
                  <span className="font-mono text-[11px] font-bold">NO</span>
                </div>
                <div>NO. GAMBAR</div>
                <div>JUDUL GAMBAR</div>
                <div className="text-center">SKALA</div>
                <div className="text-center">PRIORITAS</div>
                <div className="text-[var(--color-accent-blue)]">● PIC DRAFTER</div>
                <div>STATUS</div>
                <div className="text-center">PROGRESS</div>
                <div className="text-right pr-1">AKSI</div>
              </div>
              
              <Droppable droppableId={`group-${group.id}`}>
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="min-h-[50px] divide-y divide-[var(--color-border)]/50">
                    {groupItems.map((item, index) => {
                      const itemEditable = canEditItem(item);
                      const editTitle = getEditTooltip(item);

                      return (
                        <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={!isManager}>
                          {(provided) => (
                            <div 
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="flex flex-col lg:grid lg:grid-cols-[55px_100px_minmax(0,1fr)_65px_80px_130px_110px_65px_120px] gap-2 py-2.5 px-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors group bg-[var(--color-surface)] items-center"
                            >
                              {/* Selection & Drag & Index */}
                              <div className="w-full lg:w-auto flex items-center justify-between lg:justify-start gap-1.5 shrink-0">
                                <div className="flex items-center gap-1.5">
                                  <div 
                                    {...provided.dragHandleProps} 
                                    className={`text-[var(--color-text-secondary)] ${isManager ? 'opacity-40 group-hover:opacity-100 cursor-grab active:cursor-grabbing' : 'opacity-10 cursor-default'}`}
                                    title={!isManager ? "Menyusun urutan gambar hanya untuk Manager" : undefined}
                                  >
                                    <GripVertical className="w-3.5 h-3.5" />
                                  </div>
                                  <input
                                    type="checkbox"
                                    checked={selectedItemIds.includes(item.id)}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      handleToggleSelect(item.id);
                                    }}
                                    className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-accent-blue)] focus:ring-[var(--color-accent-blue)] cursor-pointer shrink-0"
                                    title="Pilih gambar untuk aksi massal (Bulk)"
                                  />
                                </div>
                                <span className="font-mono text-xs font-semibold text-[var(--color-text-tertiary)] lg:ml-0.5">
                                  #{index + 1}
                                </span>
                              </div>

                              {/* No. Gambar (Clean & Dedicated) */}
                              <div className="w-full lg:w-auto flex items-center">
                                <span className="font-mono text-xs font-bold text-[var(--color-text-primary)] px-2.5 py-0.5 rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)] inline-block tracking-wide whitespace-nowrap">
                                  {item.drawingNumber || '-'}
                                </span>
                              </div>

                              {/* Judul Gambar (Clean without inline scale badge) */}
                              <div className="w-full lg:w-auto min-w-0 pr-2">
                                <p className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] truncate" title={item.drawingName}>
                                  {item.drawingName}
                                </p>
                                {item.notes && (
                                  <p className="text-[11px] text-[var(--color-text-tertiary)] truncate mt-0.5">
                                    {item.notes}
                                  </p>
                                )}
                              </div>

                              {/* DEDICATED KOLOM SKALA RAPI (AutoCAD Standard Column) */}
                              <div className="w-full lg:w-auto flex items-center justify-between lg:justify-center">
                                <span className="lg:hidden text-[11px] font-bold text-[var(--color-text-tertiary)]">SKALA:</span>
                                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] shadow-xs tracking-wider inline-flex items-center justify-center text-center min-w-[54px]">
                                  {formatScale(item.scale)}
                                </span>
                              </div>

                              {/* DEDICATED KOLOM PRIORITAS TERPISAH */}
                              <div className="w-full lg:w-auto flex items-center justify-between lg:justify-center">
                                <span className="lg:hidden text-[11px] font-bold text-[var(--color-text-tertiary)]">PRIORITAS:</span>
                                {renderPriorityBadge(item.priority)}
                              </div>

                              {/* REDESIGNED POSISI PIC - PROMINENT DEDICATED COLUMN */}
                              <div className="w-full lg:w-auto flex items-center justify-between lg:justify-start gap-1.5 min-w-0">
                                <span className="lg:hidden text-[11px] font-bold text-[var(--color-text-tertiary)]">PIC:</span>
                                {item.picName ? (
                                  <button
                                    type="button"
                                    onClick={() => isManager && setQuickAssignItem(item)}
                                    disabled={!isManager}
                                    title={isManager ? "Klik untuk ganti atau lepas PIC Drafter" : `PIC Drafter: ${item.picName}`}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent-blue)]/60 transition-all text-left w-full group/pic min-w-0"
                                  >
                                    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center text-[11px] font-bold shrink-0 shadow-sm">
                                      {item.picName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                                    </div>
                                    <div className="truncate min-w-0">
                                      <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate block group-hover/pic:text-[var(--color-accent-blue)]">
                                        {item.picName}
                                      </span>
                                    </div>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => isManager ? setQuickAssignItem(item) : undefined}
                                    disabled={!isManager}
                                    title={isManager ? "Tugaskan PIC Drafter untuk gambar ini" : "Belum ada PIC"}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed text-xs font-medium transition-all w-full ${
                                      isManager 
                                        ? 'border-amber-400/60 dark:border-amber-500/60 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 cursor-pointer shadow-sm' 
                                        : 'border-[var(--color-border)] text-[var(--color-text-tertiary)] opacity-60 cursor-default'
                                    }`}
                                  >
                                    <UserPlus className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                    <span className="truncate">{isManager ? "+ Tugaskan PIC" : "Belum Ada PIC"}</span>
                                  </button>
                                )}
                              </div>

                              {/* Status & KET */}
                              <div className="w-full lg:w-auto flex items-center justify-between lg:justify-start">
                                <span className="lg:hidden text-[11px] font-bold text-[var(--color-text-tertiary)]">STATUS:</span>
                                <div className="flex items-center gap-1.5 w-full max-w-[108px]">
                                  <span 
                                    className={`w-2 h-2 rounded-full shrink-0 shadow-xs ${
                                      item.status === 'Selesai' ? 'bg-emerald-500 ring-2 ring-emerald-400/20' :
                                      item.status === 'Proses' ? 'bg-cyan-500 ring-2 ring-cyan-400/20' :
                                      item.status === 'Review' ? 'bg-amber-500 ring-2 ring-amber-400/20' :
                                      item.status === 'Revisi' ? 'bg-rose-500 ring-2 ring-rose-400/20' : 'bg-slate-400'
                                    }`} 
                                    title={`Status KET AutoCAD: ${item.status}`}
                                  />
                                  {canEditItem(item) ? (
                                    <select
                                      value={item.status}
                                      onChange={(e) => {
                                        const nextStatus = e.target.value as DrawingItemStatus;
                                        updateItem(item.id, { status: nextStatus });
                                      }}
                                      className={`text-[11px] font-semibold py-0.5 px-1.5 rounded-md border cursor-pointer transition-all bg-[var(--color-surface)] w-full truncate ${
                                        item.status === 'Selesai' ? 'text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/80 dark:bg-emerald-950/60' :
                                        item.status === 'Proses' ? 'text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700/80 bg-cyan-50/80 dark:bg-cyan-950/60' :
                                        item.status === 'Review' ? 'text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700/80 bg-amber-50/80 dark:bg-amber-950/60' :
                                        item.status === 'Revisi' ? 'text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700/80 bg-rose-50/80 dark:bg-rose-950/60' :
                                        'text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80'
                                      }`}
                                      title="Klik untuk mengubah status gambar"
                                    >
                                      <option value="Belum Mulai" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 font-medium py-1">Belum Mulai</option>
                                      <option value="Proses" className="bg-white text-cyan-700 dark:bg-slate-900 dark:text-cyan-300 font-medium py-1">Proses</option>
                                      <option value="Review" className="bg-white text-amber-700 dark:bg-slate-900 dark:text-amber-300 font-medium py-1">Review</option>
                                      <option value="Revisi" className="bg-white text-rose-700 dark:bg-slate-900 dark:text-rose-300 font-medium py-1">Revisi</option>
                                      <option value="Selesai" className="bg-white text-emerald-700 dark:bg-slate-900 dark:text-emerald-300 font-medium py-1">Selesai</option>
                                      <option value="Hold" className="bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300 font-medium py-1">Hold</option>
                                    </select>
                                  ) : (
                                    <Badge 
                                      variant={item.status === 'Selesai' ? 'success' : item.status === 'Revisi' ? 'danger' : 'info'} 
                                      className="text-[11px] px-2 py-0.5 font-semibold truncate"
                                    >
                                      {item.status}
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* DEDICATED PROGRESS COLUMN */}
                              <div className="w-full lg:w-auto flex items-center justify-between lg:justify-center">
                                <span className="lg:hidden text-[11px] font-bold text-[var(--color-text-tertiary)]">PROGRESS:</span>
                                <div className="w-12 flex flex-col items-center justify-center">
                                  <span className="text-[11px] font-mono font-bold leading-none text-[var(--color-text-primary)]">{item.progress}%</span>
                                  <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-1 mt-1 overflow-hidden">
                                    <div 
                                      className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all" 
                                      style={{ width: `${item.progress}%` }} 
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* DEDICATED AKSI COLUMN */}
                              <div className="w-full lg:w-auto flex items-center justify-between lg:justify-end gap-1">
                                <span className="lg:hidden text-[11px] font-bold text-[var(--color-text-tertiary)]">AKSI:</span>
                                <div className="flex items-center gap-0.5 sm:gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    title={item.picName ? `Kirim Email Pengingat ke PIC (${item.picName})` : "Kirim Email Pengingat"}
                                    onClick={() => setSelectedItemForEmail(item)}
                                    className="h-7 w-7 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                                  >
                                    <Mail className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    disabled={!itemEditable}
                                    title={editTitle}
                                    onClick={() => {
                                      if (!itemEditable) {
                                        toast.error(editTitle);
                                        return;
                                      }
                                      setEditingItem({ ...item, isNew: false });
                                    }}
                                    className="h-7 w-7 text-[var(--color-accent-blue)]"
                                  >
                                    <FileEdit className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    disabled={!isManager}
                                    title={!isManager ? "Akses terbatas: Memerlukan izin Kelola Proyek" : "Duplikasi Gambar"}
                                    onClick={() => {
                                      if (!isManager) {
                                        toast.error("Akses terbatas");
                                        return;
                                      }
                                      duplicateItem(item.id);
                                    }}
                                    className="h-7 w-7 text-[var(--color-text-secondary)]"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    disabled={!isManager}
                                    title={!isManager ? "Akses terbatas: Memerlukan izin Kelola Proyek" : "Hapus Gambar"}
                                    onClick={() => {
                                      if (!isManager) {
                                        toast.error("Akses terbatas: Anda tidak memiliki wewenang menghapus gambar.");
                                        return;
                                      }
                                      setItemToDelete(item);
                                    }}
                                    className="h-7 w-7 text-[var(--color-accent-red)] hover:bg-[var(--color-accent-red)]/10"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                    {groupItems.length === 0 && (
                      <div className="py-8 text-center text-[var(--color-text-secondary)] text-sm italic">
                        Belum ada gambar dalam grup ini. Klik "+ Tambah Gambar" untuk memulai.
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </Card>
          );
        })}

        {/* Unassigned Items */}
        {(() => {
           const unassigned = items
             .filter(i => !i.groupId)
             .filter(i => i.drawingName.toLowerCase().includes(search.toLowerCase()) || 
                          i.drawingNumber.toLowerCase().includes(search.toLowerCase()) ||
                          (i.picName && i.picName.toLowerCase().includes(search.toLowerCase())))
             .sort((a, b) => a.sortOrder - b.sortOrder);

           const unassignedIds = unassigned.map(i => i.id);
           const isUnassignedAllSelected = unassignedIds.length > 0 && unassignedIds.every(id => selectedItemIds.includes(id));
           const isUnassignedPartiallySelected = unassignedIds.some(id => selectedItemIds.includes(id)) && !isUnassignedAllSelected;

           if (unassigned.length > 0) {
             return (
              <Card className="p-4 mb-6 shadow-sm border-[var(--color-border)]">
                <div className="flex justify-between items-center mb-3 pb-3 border-b border-[var(--color-border)]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm tracking-wide text-[var(--color-text-primary)] uppercase flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm bg-slate-400 inline-block" />
                      Tanpa Grup
                    </h3>
                    <span className="text-[11px] font-mono text-[var(--color-text-tertiary)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded-full border border-[var(--color-border)]">
                      {unassigned.length} Gambar
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    disabled={!isManager || unassigned.length === 0}
                    title={!isManager ? "Akses terbatas: Memerlukan izin Kelola Proyek" : "Urutkan nomor gambar tanpa grup secara berurutan"}
                    onClick={() => {
                      if (!isManager) {
                        toast.error("Akses terbatas: Anda tidak memiliki wewenang mengurutkan nomor gambar.");
                        return;
                      }
                      renumberGroupItems(null);
                    }}
                    className="h-8 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent-blue)]"
                  >
                    <ListOrdered className="w-3.5 h-3.5 mr-1" /> Urutkan No.
                  </Button>
                </div>

                {/* Redesigned Table Column Headers - Tanpa Grup */}
                <div className="hidden lg:grid grid-cols-[55px_100px_minmax(0,1fr)_65px_80px_130px_110px_65px_120px] gap-2 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)] border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60 rounded-t-lg items-center">
                  <div className="flex items-center gap-2 pl-0.5">
                    <input
                      type="checkbox"
                      title={isUnassignedAllSelected ? "Batalkan pilihan semua gambar tanpa grup" : "Pilih semua gambar tanpa grup"}
                      checked={isUnassignedAllSelected}
                      ref={el => {
                        if (el) el.indeterminate = isUnassignedPartiallySelected;
                      }}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleSelectGroup(unassignedIds);
                      }}
                      className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-accent-blue)] focus:ring-[var(--color-accent-blue)] cursor-pointer shrink-0"
                    />
                    <span className="font-mono text-[11px] font-bold">NO</span>
                  </div>
                  <div>NO. GAMBAR</div>
                  <div>JUDUL GAMBAR</div>
                  <div className="text-center">SKALA</div>
                  <div className="text-center">PRIORITAS</div>
                  <div className="text-[var(--color-accent-blue)]">● PIC DRAFTER</div>
                  <div>STATUS</div>
                  <div className="text-center">PROGRESS</div>
                  <div className="text-right pr-1">AKSI</div>
                </div>

                <Droppable droppableId="group-unassigned">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="min-h-[50px] divide-y divide-[var(--color-border)]/50">
                      {unassigned.map((item, index) => {
                        const itemEditable = canEditItem(item);
                        const editTitle = getEditTooltip(item);

                        return (
                          <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={!isManager}>
                            {(provided) => (
                              <div 
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className="flex flex-col lg:grid lg:grid-cols-[55px_100px_minmax(0,1fr)_65px_80px_130px_110px_65px_120px] gap-2 py-2.5 px-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors group bg-[var(--color-surface)] items-center"
                              >
                                {/* Selection & Drag & Index */}
                                <div className="w-full lg:w-auto flex items-center justify-between lg:justify-start gap-1.5 shrink-0">
                                  <div className="flex items-center gap-1.5">
                                    <div 
                                      {...provided.dragHandleProps} 
                                      className={`text-[var(--color-text-secondary)] ${isManager ? 'opacity-40 group-hover:opacity-100 cursor-grab active:cursor-grabbing' : 'opacity-10 cursor-default'}`}
                                      title={!isManager ? "Menyusun urutan gambar hanya untuk Manager" : undefined}
                                    >
                                      <GripVertical className="w-3.5 h-3.5" />
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={selectedItemIds.includes(item.id)}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        handleToggleSelect(item.id);
                                      }}
                                      className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-accent-blue)] focus:ring-[var(--color-accent-blue)] cursor-pointer shrink-0"
                                      title="Pilih gambar untuk aksi massal (Bulk)"
                                    />
                                  </div>
                                  <span className="font-mono text-xs font-semibold text-[var(--color-text-tertiary)] lg:ml-0.5">
                                    #{index + 1}
                                  </span>
                                </div>

                                {/* No. Gambar (Clean & Dedicated) */}
                                <div className="w-full lg:w-auto flex items-center">
                                  <span className="font-mono text-xs font-bold text-[var(--color-text-primary)] px-2.5 py-0.5 rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)] inline-block tracking-wide whitespace-nowrap">
                                    {item.drawingNumber || '-'}
                                  </span>
                                </div>

                                {/* Judul Gambar */}
                                <div className="w-full lg:w-auto min-w-0 pr-2">
                                  <p className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] truncate" title={item.drawingName}>
                                    {item.drawingName}
                                  </p>
                                  {item.notes && (
                                    <p className="text-[11px] text-[var(--color-text-tertiary)] truncate mt-0.5">
                                      {item.notes}
                                    </p>
                                  )}
                                </div>

                                {/* DEDICATED KOLOM SKALA RAPI (AutoCAD Standard Column) */}
                                <div className="w-full lg:w-auto flex items-center justify-between lg:justify-center">
                                  <span className="lg:hidden text-[11px] font-bold text-[var(--color-text-tertiary)]">SKALA:</span>
                                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] shadow-xs tracking-wider inline-flex items-center justify-center text-center min-w-[54px]">
                                    {formatScale(item.scale)}
                                  </span>
                                </div>

                                {/* DEDICATED KOLOM PRIORITAS TERPISAH */}
                                <div className="w-full lg:w-auto flex items-center justify-between lg:justify-center">
                                  <span className="lg:hidden text-[11px] font-bold text-[var(--color-text-tertiary)]">PRIORITAS:</span>
                                  {renderPriorityBadge(item.priority)}
                                </div>

                                {/* REDESIGNED POSISI PIC */}
                                <div className="w-full lg:w-auto flex items-center justify-between lg:justify-start gap-1.5 min-w-0">
                                  <span className="lg:hidden text-[11px] font-bold text-[var(--color-text-tertiary)]">PIC:</span>
                                  {item.picName ? (
                                    <button
                                      type="button"
                                      onClick={() => isManager && setQuickAssignItem(item)}
                                      disabled={!isManager}
                                      title={isManager ? "Klik untuk ganti atau lepas PIC Drafter" : `PIC Drafter: ${item.picName}`}
                                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent-blue)]/60 transition-all text-left w-full group/pic min-w-0"
                                    >
                                      <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center text-[11px] font-bold shrink-0 shadow-sm">
                                        {item.picName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                                      </div>
                                      <div className="truncate min-w-0">
                                        <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate block group-hover/pic:text-[var(--color-accent-blue)]">
                                          {item.picName}
                                        </span>
                                      </div>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => isManager ? setQuickAssignItem(item) : undefined}
                                      disabled={!isManager}
                                      title={isManager ? "Tugaskan PIC Drafter untuk gambar ini" : "Belum ada PIC"}
                                      className={`flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed text-xs font-medium transition-all w-full ${
                                        isManager 
                                          ? 'border-amber-400/60 dark:border-amber-500/60 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 cursor-pointer shadow-sm' 
                                          : 'border-[var(--color-border)] text-[var(--color-text-tertiary)] opacity-60 cursor-default'
                                      }`}
                                    >
                                      <UserPlus className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                      <span className="truncate">{isManager ? "+ Tugaskan PIC" : "Belum Ada PIC"}</span>
                                    </button>
                                  )}
                                </div>

                                {/* Status & KET */}
                                <div className="w-full lg:w-auto flex items-center justify-between lg:justify-start">
                                  <span className="lg:hidden text-[11px] font-bold text-[var(--color-text-tertiary)]">STATUS:</span>
                                  <div className="flex items-center gap-1.5 w-full max-w-[108px]">
                                    <span 
                                      className={`w-2 h-2 rounded-full shrink-0 shadow-xs ${
                                        item.status === 'Selesai' ? 'bg-emerald-500 ring-2 ring-emerald-400/20' :
                                        item.status === 'Proses' ? 'bg-cyan-500 ring-2 ring-cyan-400/20' :
                                        item.status === 'Review' ? 'bg-amber-500 ring-2 ring-amber-400/20' :
                                        item.status === 'Revisi' ? 'bg-rose-500 ring-2 ring-rose-400/20' : 'bg-slate-400'
                                      }`} 
                                      title={`Status KET AutoCAD: ${item.status}`}
                                    />
                                    {canEditItem(item) ? (
                                      <select
                                        value={item.status}
                                        onChange={(e) => {
                                          const nextStatus = e.target.value as DrawingItemStatus;
                                          updateItem(item.id, { status: nextStatus });
                                        }}
                                        className={`text-[11px] font-semibold py-0.5 px-1.5 rounded-md border cursor-pointer transition-all bg-[var(--color-surface)] w-full truncate ${
                                          item.status === 'Selesai' ? 'text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/80 dark:bg-emerald-950/60' :
                                          item.status === 'Proses' ? 'text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700/80 bg-cyan-50/80 dark:bg-cyan-950/60' :
                                          item.status === 'Review' ? 'text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700/80 bg-amber-50/80 dark:bg-amber-950/60' :
                                          item.status === 'Revisi' ? 'text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700/80 bg-rose-50/80 dark:bg-rose-950/60' :
                                          'text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80'
                                        }`}
                                        title="Klik untuk mengubah status gambar"
                                      >
                                        <option value="Belum Mulai" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 font-medium py-1">Belum Mulai</option>
                                        <option value="Proses" className="bg-white text-cyan-700 dark:bg-slate-900 dark:text-cyan-300 font-medium py-1">Proses</option>
                                        <option value="Review" className="bg-white text-amber-700 dark:bg-slate-900 dark:text-amber-300 font-medium py-1">Review</option>
                                        <option value="Revisi" className="bg-white text-rose-700 dark:bg-slate-900 dark:text-rose-300 font-medium py-1">Revisi</option>
                                        <option value="Selesai" className="bg-white text-emerald-700 dark:bg-slate-900 dark:text-emerald-300 font-medium py-1">Selesai</option>
                                        <option value="Hold" className="bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300 font-medium py-1">Hold</option>
                                      </select>
                                    ) : (
                                      <Badge 
                                        variant={item.status === 'Selesai' ? 'success' : item.status === 'Revisi' ? 'danger' : 'info'} 
                                        className="text-[11px] px-2 py-0.5 font-semibold truncate"
                                      >
                                        {item.status}
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                {/* DEDICATED PROGRESS COLUMN */}
                                <div className="w-full lg:w-auto flex items-center justify-between lg:justify-center">
                                  <span className="lg:hidden text-[11px] font-bold text-[var(--color-text-tertiary)]">PROGRESS:</span>
                                  <div className="w-12 flex flex-col items-center justify-center">
                                    <span className="text-[11px] font-mono font-bold leading-none text-[var(--color-text-primary)]">{item.progress}%</span>
                                    <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-1 mt-1 overflow-hidden">
                                      <div 
                                        className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all" 
                                        style={{ width: `${item.progress}%` }} 
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* DEDICATED AKSI COLUMN */}
                                <div className="w-full lg:w-auto flex items-center justify-between lg:justify-end gap-1">
                                  <span className="lg:hidden text-[11px] font-bold text-[var(--color-text-tertiary)]">AKSI:</span>
                                  <div className="flex items-center gap-0.5">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      title={item.picName ? `Kirim Email Pengingat ke PIC (${item.picName})` : "Kirim Email Pengingat"}
                                      onClick={() => setSelectedItemForEmail(item)}
                                      className="h-7 w-7 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                                    >
                                      <Mail className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      disabled={!itemEditable}
                                      title={editTitle}
                                      onClick={() => {
                                        if (!itemEditable) {
                                          toast.error(editTitle);
                                          return;
                                        }
                                        setEditingItem({ ...item, isNew: false });
                                      }}
                                      className="h-7 w-7 text-[var(--color-accent-blue)]"
                                    >
                                      <FileEdit className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      disabled={!isManager}
                                      title={!isManager ? "Akses terbatas: Memerlukan izin Kelola Proyek" : "Duplikasi Gambar"}
                                      onClick={() => {
                                        if (!isManager) {
                                          toast.error("Akses terbatas");
                                          return;
                                        }
                                        duplicateItem(item.id);
                                      }}
                                      className="h-7 w-7 text-[var(--color-text-secondary)]"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      disabled={!isManager}
                                      title={!isManager ? "Akses terbatas: Memerlukan izin Kelola Proyek" : "Hapus Gambar"}
                                      onClick={() => {
                                        if (!isManager) {
                                          toast.error("Akses terbatas: Anda tidak memiliki wewenang menghapus gambar.");
                                          return;
                                        }
                                        setItemToDelete(item);
                                      }}
                                      className="h-7 w-7 text-[var(--color-accent-red)] hover:bg-[var(--color-accent-red)]/10"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </Card>
             );
           }
           return null;
        })()}
      </DragDropContext>

      {groups.length === 0 && items.length === 0 && (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-1">Belum ada daftar gambar</h3>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mb-6">
            Buat grup gambar pertama atau gunakan template standar proyek.
          </p>
          <div className="flex gap-3">
            <Button 
              disabled={!isManager}
              title={!isManager ? "Akses terbatas: Memerlukan izin Kelola Proyek (Owner / Admin / Project Leader)" : "Buat Grup"}
              onClick={() => {
                if (!isManager) {
                  toast.error("Akses terbatas: Anda tidak memiliki wewenang membuat grup gambar.");
                  return;
                }
                setEditingGroup({ isNew: true });
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Buat Grup
            </Button>
          </div>
        </Card>
      )}

      {/* Edit Group Modal */}
      <Modal isOpen={!!editingGroup} onClose={() => setEditingGroup(null)} title={editingGroup?.isNew ? 'Grup Baru' : 'Edit Grup'}>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!isManager) {
            toast.error("Akses terbatas: Anda tidak memiliki izin mengelola grup.");
            return;
          }
          const target = e.target as any;
          if (editingGroup.isNew) {
            await createGroup(target.name.value, ''); // Project ID injected by context
          } else {
            await updateGroup(editingGroup.id, target.name.value);
          }
          setEditingGroup(null);
        }} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nama Grup</label>
            <Input name="name" defaultValue={editingGroup?.groupName || ''} required />
          </div>
          <div className="flex justify-between pt-4">
            {!editingGroup?.isNew ? (
              <Button 
                type="button" 
                variant="ghost" 
                className="text-[var(--color-accent-red)] hover:bg-[var(--color-accent-red)]/10" 
                disabled={!isManager}
                title={!isManager ? "Akses terbatas: Memerlukan izin Kelola Proyek" : "Hapus Grup"}
                onClick={() => {
                  if (!isManager) {
                    toast.error("Akses terbatas: Anda tidak memiliki wewenang menghapus grup.");
                    return;
                  }
                  const g = editingGroup;
                  setEditingGroup(null);
                  setGroupToDelete(g);
                }}
              >
                <Trash2 className="w-4 h-4 mr-1.5" /> Hapus Grup
              </Button>
            ) : <div/>}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditingGroup(null)}>Batal</Button>
              <Button type="submit" disabled={!isManager} title={!isManager ? "Akses terbatas: Memerlukan izin Kelola Proyek" : undefined}>Simpan</Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit Item Modal */}
      <Modal 
        isOpen={!!editingItem} 
        onClose={() => setEditingItem(null)} 
        title={editingItem?.isNew ? 'Gambar Baru' : isRestrictedTeamEdit ? 'Perbarui Status Gambar (Anggota Tim)' : 'Edit Gambar'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={async (e) => {
          e.preventDefault();
          const target = e.target as any;

          if (isRestrictedTeamEdit) {
            // TEAM role only edits status, progress, notes
            const statusVal = target.status.value as DrawingItemStatus;
            const progressVal = parseInt(target.progress.value) || 0;
            const notesVal = target.notes.value || '';
            await updateItem(editingItem.id, {
              status: statusVal,
              progress: progressVal,
              notes: notesVal
            });
            setEditingItem(null);
            return;
          }

          if (editingItem.isNew) {
            if (!isManager) {
              toast.error("Akses terbatas: Anda tidak memiliki wewenang membuat gambar baru.");
              return;
            }
            const picUser = teamUsers.find(u => u.name === target.picName?.value);
            const data = {
              drawingNumber: target.drawingNumber.value,
              drawingName: target.drawingName.value,
              scale: formatScale(target.scale.value),
              priority: target.priority.value as DrawingPriority,
              status: target.status.value as DrawingItemStatus,
              progress: parseInt(target.progress.value) || 0,
              deadline: target.deadline.value || null,
              notes: target.notes.value || '',
              groupId: editingItem.groupId || null,
              sortOrder: items.length
            };
            await createItem({ 
              ...data, 
              picId: picUser?.id || '', 
              picName: target.picName?.value || '', 
              revisionCount: 0, 
              isDeleted: false 
            } as any);
          } else {
            if (!canEditItem(editingItem)) {
              toast.error("Akses terbatas: Anda tidak memiliki wewenang mengedit gambar ini.");
              return;
            }
            const picUser = teamUsers.find(u => u.name === target.picName?.value);
            const data: any = {
              drawingNumber: target.drawingNumber.value,
              drawingName: target.drawingName.value,
              scale: formatScale(target.scale.value),
              priority: target.priority.value as DrawingPriority,
              status: target.status.value as DrawingItemStatus,
              progress: parseInt(target.progress.value) || 0,
              deadline: target.deadline.value || null,
              notes: target.notes.value || '',
              groupId: editingItem.groupId || null,
              sortOrder: editingItem.sortOrder
            };
            if (isManager && target.picName) {
              data.picName = target.picName.value;
              data.picId = picUser?.id || editingItem.picId || '';
            }
            const revNote = target.revNote?.value;
            await updateItem(editingItem.id, data, revNote);
          }
          setEditingItem(null);
        }} className="space-y-4">
          
          {/* Banner for TEAM role */}
          {isRestrictedTeamEdit && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold">Mode Anggota Tim (Aturan Bisnis #9):</span> Anda hanya dapat mengubah <strong>Status</strong>, <strong>Progress</strong>, dan <strong>Catatan</strong>. Atribut teknis (No. Gambar, Nama, Skala, Prioritas, Deadline, PIC) dikunci dan hanya dapat diubah oleh Manager.
              </div>
            </div>
          )}

          {/* Row 1: Nomor Gambar, Skala, dan Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">No. Gambar *</label>
              <Input 
                name="drawingNumber" 
                defaultValue={editingItem?.drawingNumber || ''} 
                required 
                disabled={isRestrictedTeamEdit}
                placeholder="Contoh: AR-0101"
                className={`font-mono text-sm font-semibold ${isRestrictedTeamEdit ? "opacity-60 cursor-not-allowed bg-black/5 dark:bg-white/5" : ""}`}
                title={isRestrictedTeamEdit ? "Hanya Manager yang dapat mengubah Nomor Gambar" : undefined}
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Skala Gambar</label>
              <Input 
                id="drawingScaleInput"
                name="scale" 
                defaultValue={editingItem?.scale ? formatScale(editingItem.scale) : '1 : 100'} 
                disabled={isRestrictedTeamEdit}
                className={`font-mono text-xs ${isRestrictedTeamEdit ? "opacity-60 cursor-not-allowed bg-black/5 dark:bg-white/5" : ""}`}
                placeholder="Contoh: 1 : 100 atau NTS"
                title={isRestrictedTeamEdit ? "Hanya Manager yang dapat mengubah Skala" : undefined}
              />
              {!isRestrictedTeamEdit && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {STANDARD_CAD_SCALES.slice(0, 7).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('drawingScaleInput') as HTMLInputElement;
                        if (input) input.value = preset;
                      }}
                      className="px-2 py-0.5 text-xs font-mono font-medium rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent-blue)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                      title={`Gunakan skala ${preset}`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Deadline</label>
              <Input 
                type="date" 
                name="deadline" 
                defaultValue={editingItem?.deadline || ''} 
                disabled={isRestrictedTeamEdit}
                className={isRestrictedTeamEdit ? "opacity-60 cursor-not-allowed bg-black/5 dark:bg-white/5" : ""}
                title={isRestrictedTeamEdit ? "Hanya Manager yang dapat mengubah Deadline" : undefined}
              />
            </div>
          </div>

          {/* Row 2: NAMA GAMBAR - FULL WIDTH & LEBIH PANJANG */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-primary)]">
                Nama Gambar *
              </label>
              <span className="text-[11px] text-[var(--color-text-tertiary)]">
                Judul lengkap lembar kerja
              </span>
            </div>
            <Input 
              name="drawingName" 
              defaultValue={editingItem?.drawingName || ''} 
              required 
              disabled={isRestrictedTeamEdit}
              placeholder="Contoh: Potongan Melintang Bangunan Utama & Detail Rangka Atap..."
              className={`h-11 text-sm font-medium w-full ${isRestrictedTeamEdit ? "opacity-60 cursor-not-allowed bg-black/5 dark:bg-white/5" : ""}`}
              title={isRestrictedTeamEdit ? "Hanya Manager yang dapat mengubah Nama Gambar" : undefined}
            />
          </div>

          {/* PIC DRAFTER ASSIGNMENT FIELD */}
          <div className="space-y-1 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40">
            <label className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-[var(--color-accent-blue)]" />
                PIC Drafter yang Bertanggung Jawab
              </span>
              {isRestrictedTeamEdit && <span className="text-xs opacity-70 font-normal">Terkunci (Khusus Manager)</span>}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <select
                disabled={isRestrictedTeamEdit}
                onChange={(e) => {
                  const input = document.getElementById('itemPicInput') as HTMLInputElement;
                  if (input && e.target.value) {
                    input.value = e.target.value;
                  }
                }}
                className={`flex h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-xs ${
                  isRestrictedTeamEdit ? "opacity-60 cursor-not-allowed" : ""
                }`}
                defaultValue=""
              >
                <option value="">-- Pilih dari Anggota Tim --</option>
                {teamUsers.map(u => (
                  <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                ))}
              </select>
              <Input 
                id="itemPicInput"
                name="picName" 
                defaultValue={editingItem?.picName || ''} 
                placeholder="Atau ketik nama PIC Drafter..."
                disabled={isRestrictedTeamEdit}
                className={`h-9 text-xs ${isRestrictedTeamEdit ? "opacity-60 cursor-not-allowed bg-black/5 dark:bg-white/5" : ""}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--color-text-primary)]">Prioritas</label>
              <select 
                name="priority" 
                defaultValue={editingItem?.priority || 'Normal'} 
                disabled={isRestrictedTeamEdit}
                title={isRestrictedTeamEdit ? "Hanya Manager yang dapat mengubah Prioritas" : undefined}
                className={`flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm focus:ring-2 ${isRestrictedTeamEdit ? "opacity-60 cursor-not-allowed bg-black/5 dark:bg-white/5" : ""}`}
              >
                <option value="Rendah">Rendah</option>
                <option value="Normal">Normal</option>
                <option value="Tinggi">Tinggi</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--color-text-primary)]">Status</label>
              <select 
                id="editItemStatusSelect"
                name="status" 
                defaultValue={editingItem?.status || 'Belum Mulai'} 
                onChange={(e) => {
                  const progInput = document.getElementById('editItemProgressInput') as HTMLInputElement;
                  if (progInput) {
                    const val = e.target.value;
                    const currentProg = parseInt(progInput.value) || 0;
                    if (val === 'Selesai') progInput.value = '100';
                    else if (val === 'Belum Mulai') progInput.value = '0';
                    else if (val === 'Proses' && (currentProg <= 0 || currentProg >= 100)) progInput.value = '50';
                    else if (val === 'Review' && (currentProg <= 0 || currentProg >= 100)) progInput.value = '80';
                    else if (val === 'Revisi' && (currentProg <= 0 || currentProg >= 100)) progInput.value = '40';
                  }
                }}
                className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm focus:ring-2"
              >
                <option value="Belum Mulai" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 font-medium py-1">Belum Mulai</option>
                <option value="Proses" className="bg-white text-cyan-700 dark:bg-slate-900 dark:text-cyan-300 font-medium py-1">Proses</option>
                <option value="Review" className="bg-white text-amber-700 dark:bg-slate-900 dark:text-amber-300 font-medium py-1">Review</option>
                <option value="Revisi" className="bg-white text-rose-700 dark:bg-slate-900 dark:text-rose-300 font-medium py-1">Revisi</option>
                <option value="Selesai" className="bg-white text-emerald-700 dark:bg-slate-900 dark:text-emerald-300 font-medium py-1">Selesai</option>
                <option value="Hold" className="bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300 font-medium py-1">Hold</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--color-text-primary)]">Progress (%)</label>
              <Input 
                id="editItemProgressInput"
                type="number" 
                name="progress" 
                min="0" 
                max="100" 
                defaultValue={editingItem?.progress || 0} 
                onChange={(e) => {
                  const statusSelect = document.getElementById('editItemStatusSelect') as HTMLSelectElement;
                  if (statusSelect) {
                    const progVal = parseInt(e.target.value) || 0;
                    if (progVal === 100) statusSelect.value = 'Selesai';
                    else if (progVal === 0 && statusSelect.value !== 'Hold') statusSelect.value = 'Belum Mulai';
                    else if (progVal > 0 && progVal < 100 && (statusSelect.value === 'Belum Mulai' || statusSelect.value === 'Selesai')) {
                      statusSelect.value = 'Proses';
                    }
                  }
                }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--color-text-primary)]">Deskripsi / Catatan</label>
            <Input name="notes" defaultValue={editingItem?.notes || ''} placeholder="Catatan atau instruksi gambar..." />
          </div>

          {!editingItem?.isNew && !isRestrictedTeamEdit && (
            <div className="space-y-1 p-3 bg-black/5 dark:bg-white/5 rounded-lg border border-[var(--color-border)]">
              <label className="text-sm font-medium flex items-center gap-2 text-[var(--color-text-primary)]">
                Catatan Revisi <Badge variant="warning">Opsional</Badge>
              </label>
              <Input name="revNote" placeholder="Catat perubahan untuk riwayat revisi..." />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setEditingItem(null)}>Batal</Button>
            <Button type="submit">Simpan</Button>
          </div>
        </form>
      </Modal>

      {/* Manual Reminder Email Modal */}
      {selectedItemForEmail && (
        <EmailReminderModal
          isOpen={Boolean(selectedItemForEmail)}
          onClose={() => setSelectedItemForEmail(null)}
          item={selectedItemForEmail}
          projectName={projectName}
        />
      )}

      {/* Apply Template Modal */}
      {projectId && (
        <ApplyTemplateModal
          isOpen={isApplyTemplateModalOpen}
          onClose={() => setIsApplyTemplateModalOpen(false)}
          projectId={projectId}
          projectName={projectName}
        />
      )}

      {/* Save as Template Modal */}
      <SaveAsTemplateModal
        isOpen={isSaveAsTemplateModalOpen}
        onClose={() => setIsSaveAsTemplateModalOpen(false)}
        projectName={projectName}
        groups={groups}
        items={items}
      />

      {/* Import Excel Modal */}
      <ImportExcelModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={importItems}
        existingGroups={groups}
        existingItems={items}
      />

      {/* Modal Ubah Status Massal */}
      {bulkModalType === 'status' && (
        <Modal
          isOpen={true}
          onClose={() => setBulkModalType(null)}
          title={`Ubah Status Massal (${selectedItemIds.length} Gambar)`}
        >
          <div className="space-y-4">
            <p className="text-xs text-[var(--color-text-secondary)]">
              Perubahan status akan langsung diterapkan ke semua gambar yang Anda centang. Persentase progress akan otomatis disinkronisasi sesuai aturan status kanonik.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Pilih Status Baru
              </label>
              <div className="grid grid-cols-1 gap-2">
                {(['Belum Mulai', 'Proses', 'Review', 'Revisi', 'Selesai'] as DrawingItemStatus[]).map((st) => (
                  <label
                    key={st}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      bulkStatus === st 
                        ? 'border-[var(--color-accent-blue)] bg-blue-500/5 ring-1 ring-[var(--color-accent-blue)]' 
                        : 'border-[var(--color-border)] hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="bulkStatus"
                        value={st}
                        checked={bulkStatus === st}
                        onChange={() => setBulkStatus(st)}
                        className="text-[var(--color-accent-blue)]"
                      />
                      <span className="text-xs font-medium text-[var(--color-text-primary)]">{st}</span>
                    </div>
                    <Badge variant={st === 'Selesai' ? 'success' : st === 'Revisi' ? 'danger' : 'info'} className="text-xs px-2.5 py-1">
                      {st === 'Belum Mulai' ? '0%' : st === 'Proses' ? '50%' : st === 'Review' ? '80%' : st === 'Revisi' ? '40%' : '100%'}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button variant="secondary" onClick={() => setBulkModalType(null)} disabled={bulkUpdating}>
                Batal
              </Button>
              <Button 
                variant="primary" 
                disabled={bulkUpdating}
                onClick={async () => {
                  setBulkUpdating(true);
                  try {
                    await bulkUpdateItems(selectedItemIds, { status: bulkStatus });
                    setBulkModalType(null);
                    setSelectedItemIds([]);
                  } catch (err: any) {
                    console.error("Failed bulk status:", err);
                  } finally {
                    setBulkUpdating(false);
                  }
                }}
              >
                {bulkUpdating ? 'Memproses...' : 'Terapkan Perubahan'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Ubah PIC Massal */}
      {bulkModalType === 'pic' && (
        <Modal
          isOpen={true}
          onClose={() => setBulkModalType(null)}
          title={`Tugaskan PIC Massal (${selectedItemIds.length} Gambar)`}
        >
          <div className="space-y-4">
            <p className="text-xs text-[var(--color-text-secondary)]">
              Pilih dari anggota tim atau ketik nama drafter baru yang bertanggung jawab atas {selectedItemIds.length} gambar terpilih.
            </p>

            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Pilih Anggota Tim
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value) setBulkPicName(e.target.value);
                  }}
                  className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs"
                  defaultValue=""
                >
                  <option value="">-- Pilih dari Anggota Tim Terdaftar --</option>
                  {teamUsers.map(u => (
                    <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Atau Ketik Nama PIC Manual
                </label>
                <Input
                  placeholder="Contoh: Budi Santoso / Drafter ME"
                  value={bulkPicName}
                  onChange={(e) => setBulkPicName(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button variant="secondary" onClick={() => setBulkModalType(null)} disabled={bulkUpdating}>
                Batal
              </Button>
              <Button 
                variant="primary" 
                disabled={bulkUpdating}
                onClick={async () => {
                  if (!bulkPicName.trim()) {
                    toast.error("Nama PIC tidak boleh kosong");
                    return;
                  }
                  setBulkUpdating(true);
                  try {
                    const picUser = teamUsers.find(u => u.name === bulkPicName.trim());
                    await bulkUpdateItems(selectedItemIds, { 
                      picName: bulkPicName.trim(),
                      picId: picUser?.id || ''
                    });
                    toast.success(`PIC ${selectedItemIds.length} gambar berhasil diubah ke "${bulkPicName.trim()}"`);
                    setBulkModalType(null);
                    setSelectedItemIds([]);
                  } catch (err: any) {
                    toast.error("Gagal menugaskan PIC: " + (err?.message || "Terjadi kesalahan"));
                  } finally {
                    setBulkUpdating(false);
                  }
                }}
              >
                {bulkUpdating ? 'Memproses...' : 'Tugaskan PIC'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Hapus Massal */}
      {bulkModalType === 'delete' && (
        <Modal
          isOpen={true}
          onClose={() => setBulkModalType(null)}
          title="Konfirmasi Hapus Massal"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 bg-rose-500/10 rounded-xl border border-rose-500/20 text-xs text-rose-800 dark:text-rose-200">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-900 dark:text-rose-100">
                  Anda akan menghapus {selectedItemIds.length} gambar kerja sekaligus.
                </p>
                <p className="mt-1">
                  Berkas ini akan dipindahkan ke arsip sampah (soft-delete).
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button variant="secondary" onClick={() => setBulkModalType(null)} disabled={bulkUpdating}>
                Batal
              </Button>
              <Button 
                variant="danger" 
                disabled={bulkUpdating}
                onClick={async () => {
                  setBulkUpdating(true);
                  try {
                    await bulkUpdateItems(selectedItemIds, { isDeleted: true });
                    toast.success(`${selectedItemIds.length} gambar berhasil dihapus.`);
                    setBulkModalType(null);
                    setSelectedItemIds([]);
                  } catch (err: any) {
                    toast.error("Gagal menghapus gambar: " + (err?.message || "Terjadi kesalahan"));
                  } finally {
                    setBulkUpdating(false);
                  }
                }}
              >
                {bulkUpdating ? 'Menghapus...' : 'Hapus Sekarang'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Drawing Item Confirmation Modal */}
      {itemToDelete && (
        <Modal
          isOpen={Boolean(itemToDelete)}
          onClose={() => setItemToDelete(null)}
          title="Konfirmasi Hapus Gambar"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
              <div className="text-sm">
                <p className="font-semibold">Apakah Anda yakin ingin menghapus gambar ini?</p>
                <div className="mt-2 p-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-mono text-[var(--color-text-primary)] space-y-1">
                  <div><span className="text-[var(--color-text-tertiary)]">No. Gambar:</span> <strong>{itemToDelete.drawingNumber || '-'}</strong></div>
                  <div><span className="text-[var(--color-text-tertiary)]">Judul:</span> <strong>{itemToDelete.drawingName}</strong></div>
                  {itemToDelete.picName && <div><span className="text-[var(--color-text-tertiary)]">PIC:</span> {itemToDelete.picName}</div>}
                </div>
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  Data gambar ini akan dihapus dari daftar proyek.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setItemToDelete(null)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={async () => {
                  const item = itemToDelete;
                  setItemToDelete(null);
                  try {
                    await deleteItem(item.id);
                    toast.success(`Gambar "${item.drawingName}" berhasil dihapus.`);
                  } catch (err: any) {
                    toast.error("Gagal menghapus gambar: " + (err?.message || "Terjadi kesalahan"));
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Hapus Gambar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Group Confirmation Modal */}
      {groupToDelete && (
        <Modal
          isOpen={Boolean(groupToDelete)}
          onClose={() => setGroupToDelete(null)}
          title="Konfirmasi Hapus Grup Gambar"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
              <div className="text-sm">
                <p className="font-semibold">Hapus grup "{groupToDelete.groupName}"?</p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Pilih apakah ingin menghapus seluruh gambar di dalam grup ini atau memindahkannya ke daftar "Tanpa Grup".
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setGroupToDelete(null)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  const grp = groupToDelete;
                  setGroupToDelete(null);
                  try {
                    await deleteGroup(grp.id, false);
                    toast.success(`Grup "${grp.groupName}" dihapus, gambar dipindahkan ke Tanpa Grup.`);
                  } catch (err: any) {
                    toast.error("Gagal menghapus grup: " + (err?.message || "Terjadi kesalahan"));
                  }
                }}
              >
                Hapus Grup Saja (Pertahankan Gambar)
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={async () => {
                  const grp = groupToDelete;
                  setGroupToDelete(null);
                  try {
                    await deleteGroup(grp.id, true);
                    toast.success(`Grup "${grp.groupName}" dan isinya berhasil dihapus.`);
                  } catch (err: any) {
                    toast.error("Gagal menghapus grup: " + (err?.message || "Terjadi kesalahan"));
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Hapus Grup & Semua Gambarnya
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Quick Assign PIC Modal */}
      {quickAssignItem && (
        <QuickAssignPICModal
          isOpen={Boolean(quickAssignItem)}
          onClose={() => setQuickAssignItem(null)}
          item={quickAssignItem}
          teamUsers={teamUsers}
          onAssign={async (picName, picId) => {
            await updateItem(quickAssignItem.id, { picName, picId });
            toast.success(`PIC "${picName || 'Dilepas'}" berhasil diperbarui.`);
          }}
        />
      )}

      {/* CAD Sheet Modal (AutoCAD Standard Format) */}
      <CADSheetModal
        isOpen={isCadSheetModalOpen}
        onClose={() => setIsCadSheetModalOpen(false)}
        projectName={projectName}
        groups={groups}
        items={items}
      />
    </div>
  );
}
