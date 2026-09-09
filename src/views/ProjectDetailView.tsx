import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProjects } from '../context/ProjectContext';
import { DrawingProvider, useDrawings } from '../context/DrawingContext';
import { FinanceProvider } from '../context/FinanceContext';
import { VendorProvider } from '../context/VendorContext';
import { ExpenseProvider } from '../context/ExpenseContext';
import { TransmittalProvider } from '../context/TransmittalContext';
import { usePermissions } from '../hooks/usePermissions';
import { Button, Card, SegmentedControl, Modal, Input } from '../components/ui';
import { ArrowLeft, Plus, Upload, Download, Layers, BookmarkPlus } from 'lucide-react';
import { ProjectListView } from './project/ProjectListView';
import { ProjectKanbanView } from './project/ProjectKanbanView';
import { ProjectDeadlineView } from './project/ProjectDeadlineView';
import { ProjectRevisionView } from './project/ProjectRevisionView';
import { ProjectFinanceView } from './project/ProjectFinanceView';
import { ProjectVendorView } from './project/ProjectVendorView';
import { ProjectTransmittalView } from './project/ProjectTransmittalView';
import { ImportExcelModal } from '../components/ImportExcelModal';
import { ApplyTemplateModal } from '../components/ApplyTemplateModal';
import { SaveAsTemplateModal } from '../components/SaveAsTemplateModal';
import { exportDrawingListToExcel, exportDrawingListToPDF } from '../lib/exportUtils';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

function ProjectDetailContent() {
  const { id } = useParams<{id: string}>();
  const { projects } = useProjects();
  const { groups, items, loading, importItems, createGroup } = useDrawings();
  const { canManageProjects, canViewFinance, canViewVendorCost } = usePermissions();
  const [viewMode, setViewMode] = useState('list');
  const [search, setSearch] = useState('');
  const [activeModal, setActiveModal] = useState<'none' | 'import' | 'applyTemplate' | 'saveTemplate'>('none');

  const project = projects.find(p => p.id === id);

  if (!project) return <div className="p-4">Project not found</div>;
  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="w-8 h-8 border-4 border-[var(--color-accent-blue)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const canSeeVendor = canViewVendorCost() || canViewFinance();
  const isPlanning = project.status === 'Planning' || (project.workflowStage && project.workflowStage !== 'ACTIVE');

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* PLANNING / DRAFT NOTICE BANNER */}
      {isPlanning && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                Proyek Dalam Tahap Penyusunan (Setup Wizard)
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Tahap saat ini: <strong>{project.workflowStage || 'PROJECT_SETUP'}</strong>. Lengkapi parameter komersial, tim, dan gambar kerja sebelum aktivasi resmi.
              </p>
            </div>
          </div>
          <Link to={`/projects/${project.id}/wizard`}>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 font-semibold shadow-sm">
              Buka Setup Wizard →
            </Button>
          </Link>
        </div>
      )}

      {/* Header & Command Center Info */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-[var(--color-surface)] p-5 rounded-2xl border border-[var(--color-border)] shadow-sm">
        <div className="flex items-center gap-3.5">
          <Link to="/projects">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-mono font-bold text-[var(--color-text-secondary)] bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded">
                {project.projectCode}
              </span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                project.status === 'Berjalan' 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              }`}>
                {project.status}
              </span>
              {project.workflowStage && (
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Stage: {project.workflowStage}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">{project.projectName}</h1>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Klien: <strong className="text-[var(--color-text-primary)]">{project.clientName}</strong> &middot; {items.length} Gambar &middot; {project.projectLeaderName ? `Project Leader: ${project.projectLeaderName}` : 'Leader belum ditunjuk'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <SegmentedControl 
            options={[
              {label: 'Gambar Kerja', value: 'list'}, 
              {label: 'Kanban', value: 'kanban'},
              {label: 'Deadline', value: 'deadline'},
              {label: 'Revisi', value: 'revisi'},
              {label: 'Transmittal', value: 'transmittal'},
              ...(canViewFinance() ? [{label: 'Keuangan', value: 'finance'}] : []),
              ...(canSeeVendor ? [{label: 'Vendor', value: 'vendor'}] : [])
            ]} 
            value={viewMode} 
            onChange={setViewMode} 
          />
          {canManageProjects() && (
            <>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => setActiveModal('applyTemplate')}
                title="Terapkan Template Master ke Proyek Ini"
              >
                <Layers className="w-4 h-4 mr-1.5 text-blue-500" /> Template
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => setActiveModal('saveTemplate')}
                disabled={items.length === 0}
                title="Simpan susunan gambar proyek saat ini sebagai template master baru"
              >
                <BookmarkPlus className="w-4 h-4 mr-1.5 text-purple-500" /> Simpan
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => setActiveModal('import')}
              >
                <Upload className="w-4 h-4 mr-1.5 text-emerald-500" /> Excel
              </Button>
              <Button variant="secondary" size="sm" onClick={() => exportDrawingListToPDF(project.projectName, groups, items)}>
                <Download className="w-3.5 h-3.5 mr-1" /> PDF
              </Button>
              <Button variant="secondary" size="sm" onClick={() => exportDrawingListToExcel(project.projectName, groups, items)}>
                <Download className="w-3.5 h-3.5 mr-1" /> Excel
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="relative">
        {viewMode !== 'finance' && viewMode !== 'vendor' && viewMode !== 'transmittal' && (
          <Input 
            placeholder="Cari nomor atau nama gambar..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-96"
          />
        )}
      </div>

      {viewMode === 'list' && (
        <ProjectListView 
          search={search} 
          projectName={project.projectName} 
          projectId={id!} 
        />
      )}
      {viewMode === 'kanban' && <ProjectKanbanView search={search} />}
      {viewMode === 'deadline' && (
        <ProjectDeadlineView 
          search={search} 
          projectName={project.projectName} 
        />
      )}
      {viewMode === 'revisi' && <ProjectRevisionView search={search} />}
      {viewMode === 'transmittal' && <ProjectTransmittalView project={project} />}
      {viewMode === 'finance' && canViewFinance() && <ProjectFinanceView />}
      {viewMode === 'vendor' && canSeeVendor && <ProjectVendorView projectId={id!} />}

      {/* SINGLE MODAL CONTROLLER */}
      <ImportExcelModal 
        isOpen={activeModal === 'import'} 
        onClose={() => setActiveModal('none')} 
        onImport={importItems}
        existingGroups={groups}
        existingItems={items}
      />

      <ApplyTemplateModal
        isOpen={activeModal === 'applyTemplate'}
        onClose={() => setActiveModal('none')}
        projectId={id!}
        projectName={project.projectName}
      />

      <SaveAsTemplateModal
        isOpen={activeModal === 'saveTemplate'}
        onClose={() => setActiveModal('none')}
        projectName={project.projectName}
        groups={groups}
        items={items}
      />
    </div>
  );
}

export function ProjectDetailView() {
  const { id } = useParams<{id: string}>();
  if (!id) return null;
  return (
    <DrawingProvider projectId={id}>
      <TransmittalProvider projectId={id}>
        <FinanceProvider projectId={id}>
          <VendorProvider projectId={id}>
            <ExpenseProvider projectId={id}>
              <ProjectDetailContent />
            </ExpenseProvider>
          </VendorProvider>
        </FinanceProvider>
      </TransmittalProvider>
    </DrawingProvider>
  );
}
