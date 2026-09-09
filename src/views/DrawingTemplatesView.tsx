import React, { useState } from 'react';
import { useDrawingTemplates } from '../context/DrawingTemplateContext';
import { usePermissions } from '../hooks/usePermissions';
import { Button, Card, Badge, Modal, Input } from '../components/ui';
import { CADSheetModal } from '../components/CADSheetModal';
import {
  BookTemplate,
  Plus,
  Search,
  Settings2,
  Trash2,
  Copy,
  FileEdit,
  ArrowLeft,
  GripVertical,
  DownloadCloud,
  Layers,
  FileText,
  AlertCircle,
  FolderPlus,
  ListOrdered,
  CheckSquare,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { DrawingTemplate, DrawingTemplateGroup, DrawingTemplateItem, DrawingGroup, DrawingItem, DrawingPriority } from '../types';
import { formatScale, STANDARD_CAD_SCALES } from '../lib/scaleUtils';
import { generateSequentialDrawingNumbers } from '../lib/drawingNumberUtils';
import toast from 'react-hot-toast';

export function DrawingTemplatesView() {
  const {
    templates,
    loadingTemplates,
    selectedTemplateId,
    setSelectedTemplateId,
    selectedTemplate,
    groups,
    items,
    loadingDetail,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    createGroup,
    updateGroup,
    deleteGroup,
    reorderGroups,
    createItem,
    updateItem,
    deleteItem,
    duplicateItem,
    reorderItems,
    renumberGroupItems,
    importSeedTemplates,
  } = useDrawingTemplates();

  const { canManageProjects, role } = usePermissions();
  const isManager = canManageProjects();

  // Filters & search
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Multi-selection state for template items
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isCadSheetModalOpen, setIsCadSheetModalOpen] = useState(false);

  // Modals state
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DrawingTemplate | null>(null);
  const [tplFormName, setTplFormName] = useState('');
  const [tplFormType, setTplFormType] = useState('');
  const [tplFormDesc, setTplFormDesc] = useState('');

  // Group Modal
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<DrawingTemplateGroup | null>(null);
  const [groupFormName, setGroupFormName] = useState('');

  // Item Modal
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DrawingTemplateItem | null>(null);
  const [itemTargetGroupId, setItemTargetGroupId] = useState<string>('');
  const [itemFormNumber, setItemFormNumber] = useState('');
  const [itemFormName, setItemFormName] = useState('');
  const [itemFormScale, setItemFormScale] = useState('1:100');
  const [itemFormNotes, setItemFormNotes] = useState('');

  // Delete Confirm Modal
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'TEMPLATE' | 'GROUP' | 'ITEM';
    id: string;
    name: string;
  } | null>(null);

  // Seed loading
  const [isSeeding, setIsSeeding] = useState(false);

  // Filtered visible items in the editor
  const visibleItems = items.filter(
    (i) =>
      i.drawingName.toLowerCase().includes(search.toLowerCase()) ||
      i.drawingNumber.toLowerCase().includes(search.toLowerCase()) ||
      (i.notes && i.notes.toLowerCase().includes(search.toLowerCase()))
  );
  const isAllSelected = visibleItems.length > 0 && visibleItems.every((i) => selectedItemIds.includes(i.id));

  const handleToggleSelect = (id: string) => {
    setSelectedItemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleToggleSelectGroup = (groupItemIds: string[]) => {
    if (groupItemIds.length === 0) return;
    const allGroupSelected = groupItemIds.every((id) => selectedItemIds.includes(id));
    if (allGroupSelected) {
      setSelectedItemIds((prev) => prev.filter((id) => !groupItemIds.includes(id)));
    } else {
      setSelectedItemIds((prev) => Array.from(new Set([...prev, ...groupItemIds])));
    }
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(visibleItems.map((i) => i.id));
    }
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    if (!isManager || selectedItemIds.length === 0) return;
    if (!window.confirm(`Hapus ${selectedItemIds.length} gambar terpilih dari template ini?`)) return;
    const idsToDelete = [...selectedItemIds];
    setSelectedItemIds([]);
    try {
      for (const id of idsToDelete) {
        await deleteItem(id);
      }
      toast.success(`${idsToDelete.length} gambar berhasil dihapus dari template.`);
    } catch (err) {
      toast.error('Gagal menghapus beberapa gambar template.');
    }
  };

  const handleBulkSetScale = async (scale: string) => {
    if (!isManager || selectedItemIds.length === 0) return;
    const formatted = formatScale(scale);
    const idsToUpdate = [...selectedItemIds];
    setSelectedItemIds([]);
    try {
      for (const id of idsToUpdate) {
        await updateItem(id, { scale: formatted });
      }
      toast.success(`Skala diubah ke ${formatted} untuk ${idsToUpdate.length} gambar template.`);
    } catch (err) {
      toast.error('Gagal memperbarui skala gambar.');
    }
  };

  // Convert template groups and items to DrawingGroup & DrawingItem format for CADSheetModal
  const cadGroups: DrawingGroup[] = groups.map((g) => ({
    id: g.id,
    projectId: selectedTemplate?.id || '',
    groupCode: g.groupCode || 'AR',
    groupName: g.groupName,
    sortOrder: g.sortOrder,
    createdAt: g.createdAt || '',
    updatedAt: g.updatedAt || '',
  }));

  const cadItems: DrawingItem[] = items.map((i) => ({
    id: i.id,
    projectId: selectedTemplate?.id || '',
    groupId: i.groupId,
    drawingNumber: i.drawingNumber,
    drawingName: i.drawingName,
    scale: i.scale || '1 : 100',
    picId: '',
    picName: 'Standar AutoCAD',
    deadline: null,
    status: 'Belum Mulai',
    progress: 0,
    priority: 'Normal',
    notes: i.notes || '',
    revisionCount: 0,
    isDeleted: false,
    sortOrder: i.sortOrder,
    createdBy: '',
    createdAt: i.createdAt || '',
    updatedAt: i.updatedAt || '',
  }));

  // --- Handlers for Template ---
  const handleOpenCreateTemplate = () => {
    if (!isManager) {
      toast.error('Akses terbatas: Memerlukan wewenang Owner/Admin/Project Leader');
      return;
    }
    setEditingTemplate(null);
    setTplFormName('');
    setTplFormType('Residensial');
    setTplFormDesc('');
    setIsTemplateModalOpen(true);
  };

  const handleOpenEditTemplate = (tpl: DrawingTemplate, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isManager) {
      toast.error('Akses terbatas: Memerlukan wewenang Owner/Admin/Project Leader');
      return;
    }
    setEditingTemplate(tpl);
    setTplFormName(tpl.templateName);
    setTplFormType(tpl.projectType || '');
    setTplFormDesc(tpl.description || '');
    setIsTemplateModalOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplFormName.trim()) return;

    try {
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, {
          templateName: tplFormName.trim(),
          projectType: tplFormType.trim() || 'Umum',
          description: tplFormDesc.trim(),
        });
      } else {
        const newId = await createTemplate({
          templateName: tplFormName.trim(),
          projectType: tplFormType.trim() || 'Umum',
          description: tplFormDesc.trim(),
        });
        setSelectedTemplateId(newId);
      }
      setIsTemplateModalOpen(false);
    } catch (err: any) {
      console.error(err);
    }
  };

  // --- Handlers for Groups ---
  const handleOpenCreateGroup = () => {
    if (!isManager || !selectedTemplateId) return;
    setEditingGroup(null);
    setGroupFormName('');
    setIsGroupModalOpen(true);
  };

  const handleOpenEditGroup = (grp: DrawingTemplateGroup) => {
    if (!isManager) return;
    setEditingGroup(grp);
    setGroupFormName(grp.groupName);
    setIsGroupModalOpen(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupFormName.trim() || !selectedTemplateId) return;

    try {
      if (editingGroup) {
        await updateGroup(editingGroup.id, groupFormName.trim());
      } else {
        await createGroup(selectedTemplateId, groupFormName.trim());
      }
      setIsGroupModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  // --- Handlers for Items ---
  const handleOpenCreateItem = (groupId: string) => {
    if (!isManager || !selectedTemplateId) return;
    setEditingItem(null);
    setItemTargetGroupId(groupId);
    const grp = groups.find((g) => g.id === groupId);
    const grpItems = items
      .filter((i) => i.groupId === groupId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const nextNumbers = generateSequentialDrawingNumbers([...grpItems, { drawingNumber: '' }], grp?.groupName);
    const suggestedNextNumber = nextNumbers[nextNumbers.length - 1] || '';
    setItemFormNumber(suggestedNextNumber);
    setItemFormName('');
    setItemFormScale('1:100');
    setItemFormNotes('');
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item: DrawingTemplateItem) => {
    if (!isManager) return;
    setEditingItem(item);
    setItemTargetGroupId(item.groupId);
    setItemFormNumber(item.drawingNumber);
    setItemFormName(item.drawingName);
    setItemFormScale(item.scale || '1:100');
    setItemFormNotes(item.notes || '');
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemFormName.trim() || !selectedTemplateId) return;

    try {
      const normalizedScale = formatScale(itemFormScale);
      if (editingItem) {
        await updateItem(editingItem.id, {
          groupId: itemTargetGroupId || editingItem.groupId,
          drawingNumber: itemFormNumber.trim(),
          drawingName: itemFormName.trim(),
          scale: normalizedScale,
          notes: itemFormNotes.trim(),
        });
      } else {
        await createItem(selectedTemplateId, itemTargetGroupId, {
          drawingNumber: itemFormNumber.trim(),
          drawingName: itemFormName.trim(),
          scale: normalizedScale,
          notes: itemFormNotes.trim(),
        });
      }
      setIsItemModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  // --- Drag & Drop ---
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    if (!isManager) {
      toast.error('Akses terbatas: Memerlukan wewenang Manager');
      return;
    }

    // Check if reordering groups
    if (result.type === 'GROUP') {
      const reordered = Array.from(groups);
      const [removed] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, removed);
      await reorderGroups(reordered);
      return;
    }

    const sourceDroppable = result.source.droppableId;
    const destDroppable = result.destination.droppableId;
    const sourceGroupId = sourceDroppable.replace('tpl-group-', '');
    const destGroupId = destDroppable.replace('tpl-group-', '');

    // Reordering within the same group
    if (sourceDroppable === destDroppable) {
      const group = groups.find((g) => g.id === sourceGroupId);
      const groupItems = items
        .filter((i) => i.groupId === sourceGroupId)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      if (groupItems.length <= 1) return;

      const [removed] = groupItems.splice(result.source.index, 1);
      groupItems.splice(result.destination.index, 0, removed);

      const newNumbers = generateSequentialDrawingNumbers(groupItems, group?.groupName);
      const updatedItems = groupItems.map((itm, idx) => ({
        ...itm,
        sortOrder: idx + 1,
        drawingNumber: newNumbers[idx] || itm.drawingNumber,
      }));

      await reorderItems(updatedItems);
      toast.success('Urutan & nomor gambar template diperbarui', { id: 'tpl-reorder-toast', duration: 2000 });
    } else {
      // Reordering between different groups
      const sourceGroup = groups.find((g) => g.id === sourceGroupId);
      const destGroup = groups.find((g) => g.id === destGroupId);

      const sourceItems = items
        .filter((i) => i.groupId === sourceGroupId)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const destItems = items
        .filter((i) => i.groupId === destGroupId)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const [removed] = sourceItems.splice(result.source.index, 1);
      const movedItemWithNewGroup = { ...removed, groupId: destGroupId };
      destItems.splice(result.destination.index, 0, movedItemWithNewGroup);

      const destNumbers = generateSequentialDrawingNumbers(destItems, destGroup?.groupName);
      const updatedDestItems = destItems.map((itm, idx) => ({
        ...itm,
        sortOrder: idx + 1,
        groupId: destGroupId,
        drawingNumber: destNumbers[idx] || itm.drawingNumber,
      }));

      const sourceNumbers = generateSequentialDrawingNumbers(sourceItems, sourceGroup?.groupName);
      const updatedSourceItems = sourceItems.map((itm, idx) => ({
        ...itm,
        sortOrder: idx + 1,
        drawingNumber: sourceNumbers[idx] || itm.drawingNumber,
      }));

      await reorderItems([...updatedDestItems, ...updatedSourceItems]);
      toast.success(
        `Gambar template dipindahkan ke grup "${destGroup?.groupName || 'Grup Baru'}" & nomor diurutkan`,
        { id: 'tpl-cross-reorder-toast', duration: 2500 }
      );
    }
  };

  // --- Import Seed ---
  const handleImportSeed = async () => {
    if (!isManager) {
      toast.error('Akses terbatas: Hanya Owner/Manager yang dapat mengimpor template.');
      return;
    }
    setIsSeeding(true);
    try {
      await importSeedTemplates();
    } catch (err) {
      // Toast already handled
    } finally {
      setIsSeeding(false);
    }
  };

  // --- Confirm Deletion ---
  const executeDelete = async () => {
    if (!deleteTarget || !isManager) return;
    try {
      if (deleteTarget.type === 'TEMPLATE') {
        await deleteTemplate(deleteTarget.id);
      } else if (deleteTarget.type === 'GROUP') {
        await deleteGroup(deleteTarget.id);
      } else if (deleteTarget.type === 'ITEM') {
        await deleteItem(deleteTarget.id);
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Unique project types for filter
  const uniqueTypes = Array.from(new Set(templates.map((t) => t.projectType || 'Umum'))).filter(Boolean);

  const filteredTemplates = templates.filter((tpl) => {
    const matchesSearch =
      tpl.templateName.toLowerCase().includes(search.toLowerCase()) ||
      (tpl.description && tpl.description.toLowerCase().includes(search.toLowerCase())) ||
      (tpl.projectType && tpl.projectType.toLowerCase().includes(search.toLowerCase()));

    const matchesType = typeFilter === 'ALL' || (tpl.projectType || 'Umum') === typeFilter;
    return matchesSearch && matchesType;
  });

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
      {/* ============================================================ */}
      {/* 1. DETAIL / EDITOR VIEW (WHEN TEMPLATE IS SELECTED)          */}
      {/* ============================================================ */}
      {selectedTemplate ? (
        <div className="space-y-6">
          {/* Top Header Action Bar - Matching ProjectListView Exactly */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedTemplateId(null);
                  setSelectedItemIds([]);
                }}
                className="gap-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                <ArrowLeft className="w-4 h-4" /> Kembali
              </Button>
              <div className="h-5 w-px bg-[var(--color-border)]" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                    {selectedTemplate.templateName}
                  </h2>
                  <Badge variant="default" className="text-xs">
                    {selectedTemplate.projectType || 'Umum'}
                  </Badge>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {selectedTemplate.description || 'Kelola grup, daftar gambar standar, dan pengaturan nomor berurutan.'}
                </p>
              </div>
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
                  {isAllSelected ? 'Batal Pilih Semua' : 'Pilih Semua'}
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
                disabled={!isManager}
                title={!isManager ? 'Akses terbatas: Memerlukan izin Kelola Proyek' : 'Edit Informasi Nama & Tipe Template'}
                onClick={() => handleOpenEditTemplate(selectedTemplate)}
              >
                <FileEdit className="w-3.5 h-3.5 mr-1.5 text-purple-500" /> Edit Info
              </Button>

              <Button
                variant="primary"
                size="sm"
                disabled={!isManager}
                title={!isManager ? 'Akses terbatas: Memerlukan izin Kelola Proyek' : 'Buat Grup Baru dalam Template'}
                onClick={handleOpenCreateGroup}
              >
                <Plus className="w-4 h-4 mr-1.5" /> Buat Grup
              </Button>
            </div>
          </div>

          {/* Bulk Selection Action Bar (Sticky floating when items selected) */}
          {selectedItemIds.length > 0 && (
            <div className="sticky top-[60px] z-30 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-2 border-blue-500/40 dark:border-blue-500/60 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl ring-1 ring-blue-500/20 transition-all duration-200 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-xs font-mono font-bold">
                  {selectedItemIds.length} Gambar Terpilih
                </Badge>
                <span className="text-xs text-[var(--color-text-secondary)]">Aksi Cepat Massal:</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-[var(--color-text-tertiary)]">Set Skala:</span>
                  {['1 : 100', '1 : 50', '1 : 20', 'NTS'].map((scalePreset) => (
                    <button
                      key={scalePreset}
                      type="button"
                      onClick={() => handleBulkSetScale(scalePreset)}
                      className="px-2.5 py-1 text-xs font-mono font-semibold rounded bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent-blue)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                      {scalePreset}
                    </button>
                  ))}
                </div>
                <div className="h-4 w-px bg-[var(--color-border)]" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="text-xs text-[var(--color-accent-red)] hover:bg-[var(--color-accent-red)]/10"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus Terpilih
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedItemIds([])}
                  className="text-xs"
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Batal
                </Button>
              </div>
            </div>
          )}

          {/* Search bar inside template */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor atau judul gambar template..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Groups and Items Listing */}
          {loadingDetail ? (
            <div className="py-16 text-center text-sm text-[var(--color-text-secondary)]">
              <div className="animate-spin w-6 h-6 border-2 border-[var(--color-accent-blue)] border-t-transparent rounded-full mx-auto mb-2" />
              Memuat data grup dan gambar template...
            </div>
          ) : groups.length === 0 ? (
            <Card className="p-10 text-center border-dashed">
              <FolderPlus className="w-12 h-12 text-[var(--color-text-tertiary)] mx-auto mb-3" />
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Belum Ada Grup Gambar</h3>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-md mx-auto mt-1 mb-5">
                Template ini belum memiliki grup atau gambar. Buat grup pertama untuk mulai menyusun daftar gambar kerja standar.
              </p>
              <Button
                variant="primary"
                size="sm"
                disabled={!isManager}
                onClick={handleOpenCreateGroup}
                className="mx-auto"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Buat Grup Sekarang
              </Button>
            </Card>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              {groups.map((group) => {
                const groupItems = items
                  .filter((i) => i.groupId === group.id)
                  .filter(
                    (i) =>
                      i.drawingName.toLowerCase().includes(search.toLowerCase()) ||
                      i.drawingNumber.toLowerCase().includes(search.toLowerCase()) ||
                      (i.notes && i.notes.toLowerCase().includes(search.toLowerCase()))
                  )
                  .sort((a, b) => a.sortOrder - b.sortOrder);

                const groupItemIds = groupItems.map((i) => i.id);
                const isGroupAllSelected = groupItemIds.length > 0 && groupItemIds.every((id) => selectedItemIds.includes(id));
                const isGroupPartiallySelected = groupItemIds.some((id) => selectedItemIds.includes(id)) && !isGroupAllSelected;

                return (
                  <Card key={group.id} className="p-4 mb-6 shadow-sm border-[var(--color-border)]">
                    {/* Group Header - Exactly matching ProjectListView.tsx */}
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
                          title={!isManager ? 'Akses terbatas: Memerlukan izin Kelola Proyek' : 'Edit Nama Grup'}
                          onClick={() => handleOpenEditGroup(group)}
                          className="h-7 w-7"
                        >
                          <Settings2 className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={!isManager}
                          title={!isManager ? 'Akses terbatas: Memerlukan izin Kelola Proyek' : 'Hapus Grup'}
                          onClick={() =>
                            setDeleteTarget({
                              type: 'GROUP',
                              id: group.id,
                              name: group.groupName,
                            })
                          }
                          className="h-7 w-7 text-[var(--color-accent-red)] hover:bg-[var(--color-accent-red)]/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!isManager || groupItems.length === 0}
                          title={!isManager ? 'Akses terbatas: Memerlukan izin Kelola Proyek' : 'Urutkan nomor gambar secara berurutan sesuai posisi saat ini'}
                          onClick={() => renumberGroupItems(group.id)}
                          className="h-8 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent-blue)]"
                        >
                          <ListOrdered className="w-3.5 h-3.5 mr-1" /> Urutkan No.
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!isManager}
                          title={!isManager ? 'Akses terbatas' : 'Tambah Gambar Baru ke Grup'}
                          onClick={() => handleOpenCreateItem(group.id)}
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
                          ref={(el) => {
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

                    <Droppable droppableId={`tpl-group-${group.id}`}>
                      {(provided) => (
                        <div
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className="min-h-[50px] divide-y divide-[var(--color-border)]/50"
                        >
                          {groupItems.map((item, index) => (
                            <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={!isManager}>
                              {(itemProvided) => (
                                <div
                                  ref={itemProvided.innerRef}
                                  {...itemProvided.draggableProps}
                                  className="flex flex-col lg:grid lg:grid-cols-[55px_100px_minmax(0,1fr)_65px_80px_130px_110px_65px_120px] gap-2 py-2.5 px-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors group bg-[var(--color-surface)] items-center"
                                >
                                  {/* Selection & Drag & Index */}
                                  <div className="w-full lg:w-auto flex items-center justify-between lg:justify-start gap-1.5 shrink-0">
                                    <div className="flex items-center gap-1.5">
                                      <div
                                        {...itemProvided.dragHandleProps}
                                        className={`text-[var(--color-text-secondary)] ${
                                          isManager
                                            ? 'opacity-40 group-hover:opacity-100 cursor-grab active:cursor-grabbing'
                                            : 'opacity-10 cursor-default'
                                        }`}
                                        title={!isManager ? 'Menyusun urutan gambar hanya untuk Manager' : undefined}
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
                                    <p
                                      className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] truncate"
                                      title={item.drawingName}
                                    >
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
                                    <span className="lg:hidden text-[11px] font-bold text-[var(--color-text-tertiary)]">
                                      SKALA:
                                    </span>
                                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] shadow-xs tracking-wider inline-flex items-center justify-center text-center min-w-[54px]">
                                      {formatScale(item.scale)}
                                    </span>
                                  </div>

                                  {/* DEDICATED KOLOM PRIORITAS TERPISAH */}
                                  <div className="w-full lg:w-auto flex items-center justify-between lg:justify-center">
                                    <span className="lg:hidden text-[11px] font-bold text-[var(--color-text-tertiary)]">
                                      PRIORITAS:
                                    </span>
                                    {renderPriorityBadge(item.priority)}
                                  </div>

                                  {/* POSISI PIC DRAFTER */}
                                  <div className="w-full lg:w-auto flex items-center justify-between lg:justify-start gap-1.5 min-w-0">
                                    <span className="lg:hidden text-[11px] font-bold text-[var(--color-text-tertiary)]">
                                      PIC:
                                    </span>
                                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-[var(--color-border)] text-[var(--color-text-tertiary)] text-xs font-medium w-full opacity-70">
                                      <span className="truncate">Auto-assign saat proyek</span>
                                    </div>
                                  </div>

                                  {/* Status & KET */}
                                  <div className="w-full lg:w-auto flex items-center justify-between lg:justify-start">
                                    <span className="lg:hidden text-[11px] font-bold text-[var(--color-text-tertiary)]">
                                      STATUS:
                                    </span>
                                    <div className="flex items-center gap-1.5 w-full max-w-[108px]">
                                      <span className="w-2 h-2 rounded-full shrink-0 shadow-xs bg-slate-400" />
                                      <Badge variant="info" className="text-[11px] px-2 py-0.5 font-semibold truncate">
                                        Belum Mulai
                                      </Badge>
                                    </div>
                                  </div>

                                  {/* DEDICATED PROGRESS COLUMN */}
                                  <div className="w-full lg:w-auto flex items-center justify-between lg:justify-center">
                                    <span className="lg:hidden text-[11px] font-bold text-[var(--color-text-tertiary)]">
                                      PROGRESS:
                                    </span>
                                    <div className="w-12 flex flex-col items-center justify-center">
                                      <span className="text-[11px] font-mono font-bold leading-none text-[var(--color-text-primary)]">
                                        0%
                                      </span>
                                      <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-1 mt-1 overflow-hidden">
                                        <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full w-0" />
                                      </div>
                                    </div>
                                  </div>

                                  {/* DEDICATED AKSI COLUMN */}
                                  <div className="w-full lg:w-auto flex items-center justify-between lg:justify-end gap-1">
                                    <span className="lg:hidden text-[11px] font-bold text-[var(--color-text-tertiary)]">
                                      AKSI:
                                    </span>
                                    <div className="flex items-center gap-0.5 sm:gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={!isManager}
                                        title="Edit Gambar Template"
                                        onClick={() => handleOpenEditItem(item)}
                                        className="h-7 w-7 text-[var(--color-accent-blue)]"
                                      >
                                        <FileEdit className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={!isManager}
                                        title="Duplikasi Gambar"
                                        onClick={() => duplicateItem(item)}
                                        className="h-7 w-7 text-[var(--color-text-secondary)]"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={!isManager}
                                        title="Hapus Gambar"
                                        onClick={() =>
                                          setDeleteTarget({
                                            type: 'ITEM',
                                            id: item.id,
                                            name: item.drawingName,
                                          })
                                        }
                                        className="h-7 w-7 text-[var(--color-accent-red)] hover:bg-[var(--color-accent-red)]/10"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
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
            </DragDropContext>
          )}
        </div>
      ) : (
        /* ============================================================ */
        /* 2. TEMPLATE LIST VIEW                                        */
        /* ============================================================ */
        <div className="space-y-6">
          {/* Header section with macOS flair */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight flex items-center gap-2">
                <BookTemplate className="w-5 h-5 text-[var(--color-accent-blue)]" />
                Template Gambar Kerja
              </h1>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Standarisasi paket daftar gambar kerja berdasarkan tipe bangunan arsitektur.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Seed Button (Owner / Manager only) */}
              <Button
                variant="secondary"
                size="sm"
                disabled={!isManager || isSeeding}
                title={
                  !isManager
                    ? 'Akses terbatas: Memerlukan izin Kelola Proyek'
                    : 'Impor 5 template standar awal (Rumah 1 Lantai, 2 Lantai, Gedung, dsb.)'
                }
                onClick={handleImportSeed}
                className="gap-1.5 text-xs"
              >
                <DownloadCloud className={`w-3.5 h-3.5 ${isSeeding ? 'animate-bounce' : ''}`} />
                {isSeeding ? 'Mengimpor...' : 'Import Template Contoh'}
              </Button>

              <Button
                variant="primary"
                size="sm"
                disabled={!isManager}
                title={!isManager ? 'Akses terbatas: Memerlukan izin Kelola Proyek' : 'Buat Template Baru'}
                onClick={handleOpenCreateTemplate}
                className="gap-1.5 text-xs"
              >
                <Plus className="w-4 h-4" />
                Buat Template
              </Button>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama template / deskripsi..."
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setTypeFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  typeFilter === 'ALL'
                    ? 'bg-[var(--color-accent-blue)] text-white shadow-sm'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                Semua Tipe
              </button>
              {uniqueTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    typeFilter === t
                      ? 'bg-[var(--color-accent-blue)] text-white shadow-sm'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Template Cards Grid */}
          {loadingTemplates ? (
            <div className="py-16 text-center text-sm text-[var(--color-text-secondary)]">
              <div className="animate-spin w-6 h-6 border-2 border-[var(--color-accent-blue)] border-t-transparent rounded-full mx-auto mb-2" />
              Memuat katalog template gambar kerja...
            </div>
          ) : filteredTemplates.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <BookTemplate className="w-12 h-12 text-[var(--color-text-tertiary)] mx-auto mb-3 opacity-60" />
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Belum Ada Template</h3>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto mt-1 mb-6">
                Tidak ditemukan template yang sesuai dengan filter atau pencarian Anda.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button variant="secondary" size="sm" onClick={handleImportSeed} disabled={!isManager || isSeeding}>
                  <DownloadCloud className="w-4 h-4 mr-1.5" />
                  Impor Contoh Standar
                </Button>
                <Button variant="primary" size="sm" onClick={handleOpenCreateTemplate} disabled={!isManager}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Buat Template Baru
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplateId(tpl.id)}
                  className="group relative flex flex-col justify-between p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm hover:shadow-md hover:border-[var(--color-accent-blue)]/50 transition-all duration-200 cursor-pointer"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <h3 className="font-semibold text-sm text-[var(--color-text-primary)] group-hover:text-[var(--color-accent-blue)] transition-colors line-clamp-1">
                        {tpl.templateName}
                      </h3>
                      <Badge variant="default" className="text-[11px] shrink-0 font-normal">
                        {tpl.projectType || 'Umum'}
                      </Badge>
                    </div>

                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 mb-4 leading-relaxed">
                      {tpl.description || 'Tidak ada deskripsi.'}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-tertiary)]">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 font-medium text-[var(--color-text-secondary)]">
                          <Layers className="w-3.5 h-3.5 text-[var(--color-accent-blue)]" />
                          {tpl.groupCount || 0} Grup
                        </span>
                        <span className="flex items-center gap-1 font-medium text-[var(--color-text-secondary)]">
                          <FileText className="w-3.5 h-3.5 text-[var(--color-accent-blue)]" />
                          {tpl.itemCount || 0} Gambar
                        </span>
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={!isManager}
                          title={!isManager ? 'Akses terbatas' : 'Edit Info Template'}
                          onClick={(e) => handleOpenEditTemplate(tpl, e)}
                          className="h-7 w-7 text-[var(--color-text-secondary)]"
                        >
                          <FileEdit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={!isManager}
                          title={!isManager ? 'Akses terbatas' : 'Hapus Template'}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({
                              type: 'TEMPLATE',
                              id: tpl.id,
                              name: tpl.templateName,
                            });
                          }}
                          className="h-7 w-7 text-[var(--color-accent-red)] hover:bg-[var(--color-accent-red)]/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. MODALS                                                    */}
      {/* ============================================================ */}

      {/* Template Modal (Create / Edit) */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title={editingTemplate ? 'Edit Informasi Template' : 'Buat Template Gambar Baru'}
      >
        <form onSubmit={handleSaveTemplate} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">Nama Template *</label>
            <Input
              required
              value={tplFormName}
              onChange={(e) => setTplFormName(e.target.value)}
              placeholder="Contoh: Rumah Tinggal 2 Lantai Mewah"
              className="text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">Tipe Bangunan / Proyek</label>
            <Input
              value={tplFormType}
              onChange={(e) => setTplFormType(e.target.value)}
              placeholder="Contoh: Residensial, Komersial, Interior"
              className="text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">Deskripsi Template</label>
            <textarea
              value={tplFormDesc}
              onChange={(e) => setTplFormDesc(e.target.value)}
              rows={3}
              placeholder="Jelaskan peruntukan atau lingkup gambar kerja dalam template ini..."
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsTemplateModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm">
              {editingTemplate ? 'Simpan Perubahan' : 'Buat & Mulai Isi Gambar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Group Modal (Create / Edit) */}
      <Modal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        title={editingGroup ? 'Edit Nama Grup Template' : 'Tambah Grup Gambar Template'}
      >
        <form onSubmit={handleSaveGroup} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">Nama Grup *</label>
            <Input
              required
              value={groupFormName}
              onChange={(e) => setGroupFormName(e.target.value)}
              placeholder="Contoh: AR-01 RENCANA TAPAK & DENAH"
              className="text-xs"
            />
            <p className="text-[11px] text-[var(--color-text-tertiary)]">
              Grup mengelompokkan gambar kerja sejenis (misal: Denah, Tampak & Potongan, Detail, ME).
            </p>
          </div>

          <div className="pt-3 flex justify-end gap-2.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsGroupModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm">
              {editingGroup ? 'Simpan Nama' : 'Tambah Grup'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Item Modal (Create / Edit) */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title={editingItem ? 'Edit Item Gambar Template' : 'Tambah Gambar ke Template'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveItem} className="space-y-4">
          {/* Row 1: Nomor Gambar & Skala Standar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Kode/Nomor *</label>
              <Input
                required
                value={itemFormNumber}
                onChange={(e) => setItemFormNumber(e.target.value)}
                placeholder="Contoh: AR-0101"
                className="font-mono text-sm font-semibold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Skala Standar</label>
              <Input
                id="templateScaleInput"
                value={itemFormScale}
                onChange={(e) => setItemFormScale(e.target.value)}
                placeholder="1 : 100, 1 : 50, NTS"
                className="font-mono text-xs"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {STANDARD_CAD_SCALES.slice(0, 7).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setItemFormScale(preset)}
                    className="px-2 py-0.5 text-xs font-mono font-medium rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent-blue)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: NAMA GAMBAR - FULL WIDTH & LEBAR */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-primary)]">
                Nama Gambar Kerja *
              </label>
              <span className="text-[11px] text-[var(--color-text-tertiary)]">
                Judul lengkap lembar kerja standar
              </span>
            </div>
            <Input
              required
              value={itemFormName}
              onChange={(e) => setItemFormName(e.target.value)}
              placeholder="Contoh: Potongan Melintang Bangunan Utama & Detail Rangka..."
              className="h-11 text-sm font-medium w-full"
            />
          </div>

          {/* Row 3: Catatan */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Catatan / Keterangan (Opsional)</label>
            <Input
              value={itemFormNotes}
              onChange={(e) => setItemFormNotes(e.target.value)}
              placeholder="Catatan standar lembar gambar..."
              className="text-xs"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsItemModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm">
              {editingItem ? 'Simpan Perubahan' : 'Tambahkan Gambar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Konfirmasi Hapus ${
          deleteTarget?.type === 'TEMPLATE'
            ? 'Template'
            : deleteTarget?.type === 'GROUP'
            ? 'Grup Template'
            : 'Gambar'
        }`}
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--color-accent-red)]/10 text-[var(--color-accent-red)]">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              Apakah Anda yakin ingin menghapus <strong>"{deleteTarget?.name}"</strong>?
              {deleteTarget?.type === 'TEMPLATE' && (
                <span className="block mt-1 text-[var(--color-text-secondary)]">
                  Seluruh grup dan gambar template di dalamnya akan ikut dihapus permanen. Proyek yang sudah dibuat sebelumnya tidak akan terpengaruh.
                </span>
              )}
              {deleteTarget?.type === 'GROUP' && (
                <span className="block mt-1 text-[var(--color-text-secondary)]">
                  Seluruh gambar template yang berada di grup ini akan ikut terhapus.
                </span>
              )}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button variant="danger" size="sm" onClick={executeDelete}>
              Ya, Hapus Sekarang
            </Button>
          </div>
        </div>
      </Modal>

      {/* CAD Sheet Modal for Template */}
      <CADSheetModal
        isOpen={isCadSheetModalOpen}
        onClose={() => setIsCadSheetModalOpen(false)}
        projectName={selectedTemplate?.templateName || 'Template Master'}
        projectCode={selectedTemplate?.projectType || 'MASTER-TPL'}
        groups={cadGroups}
        items={cadItems}
      />
    </div>
  );
}
