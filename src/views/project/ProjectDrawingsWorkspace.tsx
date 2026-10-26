import React, { useState } from 'react';
import { useDrawings } from '../../context/DrawingContext';
import { useProjects } from '../../context/ProjectContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Button, Card, Badge, Input } from '../../components/ui';
import { 
  Plus, 
  Layers, 
  Upload, 
  Download, 
  Search, 
  Kanban, 
  List, 
  Clock, 
  History, 
  Send,
  BookmarkPlus,
  FileSpreadsheet
} from 'lucide-react';
import { ProjectListView } from './ProjectListView';
import { ProjectKanbanView } from './ProjectKanbanView';
import { ProjectDeadlineView } from './ProjectDeadlineView';
import { ProjectRevisionView } from './ProjectRevisionView';
import { ProjectTransmittalView } from './ProjectTransmittalView';
import { ImportExcelModal } from '../../components/ImportExcelModal';
import { ApplyTemplateModal } from '../../components/ApplyTemplateModal';
import { SaveAsTemplateModal } from '../../components/SaveAsTemplateModal';
import { exportDrawingListToPDF, exportDrawingListToExcel } from '../../lib/exportUtils';
import { DrawingGroup, DrawingItem } from '../../types';

interface ProjectDrawingsWorkspaceProps {
  projectId: string;
  projectName: string;
}

export function ProjectDrawingsWorkspace({ projectId, projectName }: ProjectDrawingsWorkspaceProps) {
  const { groups, items, loading, importItems, createGroup, createItem } = useDrawings();
  const { projects } = useProjects();
  const { canManageProjects, canWriteProjectData } = usePermissions();
  const canEdit = canManageProjects() || canWriteProjectData(projectId);

  const [activeTab, setActiveTab] = useState<'register' | 'kanban' | 'deadline' | 'revisi' | 'transmittal'>('register');
  const [search, setSearch] = useState('');
  const [activeModal, setActiveModal] = useState<'none' | 'import' | 'applyTemplate' | 'saveTemplate'>('none');

  const project = projects.find(p => p.id === projectId) || {
    id: projectId,
    projectName: projectName,
    projectCode: 'PROJ',
    clientName: 'Client',
    status: 'Berjalan' as const,
    location: '-',
    projectType: 'Arsitektur',
    startDate: new Date().toISOString(),
    targetDate: new Date().toISOString(),
    description: '',
    members: [],
    createdBy: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const handleImport = async (importedGroups: Partial<DrawingGroup>[], importedItems: Partial<DrawingItem>[]) => {
    await importItems(importedGroups, importedItems);
    setActiveModal('none');
  };

  return (
    <div className="space-y-4">
      {/* 1. TOP CONTROL BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[var(--color-surface)] p-3.5 rounded-2xl border border-[var(--color-border)] shadow-xs">
        {/* Sub-view switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-[var(--color-border)] overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('register')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'register'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Register Gambar ({items.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'kanban'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Kanban className="w-3.5 h-3.5" />
            <span>Kanban Board</span>
          </button>

          <button
            onClick={() => setActiveTab('deadline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'deadline'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Jadwal Deadline</span>
          </button>

          <button
            onClick={() => setActiveTab('revisi')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'revisi'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Riwayat Revisi</span>
          </button>

          <button
            onClick={() => setActiveTab('transmittal')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'transmittal'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Transmittal</span>
          </button>
        </div>

        {/* Global Action Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveModal('applyTemplate')}
                className="text-xs font-semibold shadow-xs"
                title="Terapkan Template CAD Master"
              >
                <Layers className="w-3.5 h-3.5 mr-1 text-blue-500" />
                <span>Template</span>
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveModal('saveTemplate')}
                disabled={items.length === 0}
                className="text-xs font-semibold shadow-xs"
                title="Simpan susunan gambar ini sebagai template baru"
              >
                <BookmarkPlus className="w-3.5 h-3.5 mr-1 text-purple-500" />
                <span>Simpan Template</span>
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveModal('import')}
                className="text-xs font-semibold shadow-xs"
                title="Import Daftar Gambar dari Excel"
              >
                <Upload className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                <span>Import Excel</span>
              </Button>
            </>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportDrawingListToPDF(projectName, groups, items, project.projectCode)}
            className="text-xs font-semibold shadow-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1 text-slate-500" />
            <span>PDF</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportDrawingListToExcel(projectName, groups, items, project.projectCode)}
            className="text-xs font-semibold shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            <span>Excel</span>
          </Button>
        </div>
      </div>

      {/* 2. SEARCH BAR FOR DRAWING SUB-VIEWS */}
      {activeTab !== 'transmittal' && (
        <div className="w-full md:w-80">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor / nama gambar..."
            className="text-xs h-9 bg-[var(--color-surface)] shadow-xs"
          />
        </div>
      )}

      {/* 3. ACTIVE SUB-VIEW RENDER */}
      <div className="pt-1">
        {activeTab === 'register' && (
          <ProjectListView
            search={search}
            projectName={projectName}
            projectId={projectId}
          />
        )}

        {activeTab === 'kanban' && (
          <ProjectKanbanView search={search} />
        )}

        {activeTab === 'deadline' && (
          <ProjectDeadlineView search={search} projectName={projectName} />
        )}

        {activeTab === 'revisi' && (
          <ProjectRevisionView search={search} />
        )}

        {activeTab === 'transmittal' && (
          <ProjectTransmittalView project={project} />
        )}
      </div>

      {/* MODALS */}
      <ImportExcelModal
        isOpen={activeModal === 'import'}
        onClose={() => setActiveModal('none')}
        onImport={handleImport}
        existingGroups={groups}
        existingItems={items}
      />

      <ApplyTemplateModal
        isOpen={activeModal === 'applyTemplate'}
        onClose={() => setActiveModal('none')}
        projectId={projectId}
        projectName={projectName}
      />

      <SaveAsTemplateModal
        isOpen={activeModal === 'saveTemplate'}
        onClose={() => setActiveModal('none')}
        projectName={projectName}
        groups={groups}
        items={items}
      />
    </div>
  );
}
