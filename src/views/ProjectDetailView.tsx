import React, { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useProjects } from '../context/ProjectContext';
import { DrawingProvider, useDrawings } from '../context/DrawingContext';
import { FinanceProvider } from '../context/FinanceContext';
import { VendorProvider } from '../context/VendorContext';
import { ExpenseProvider } from '../context/ExpenseContext';
import { TransmittalProvider } from '../context/TransmittalContext';
import { usePermissions } from '../hooks/usePermissions';
import { Button, Card, Badge } from '../components/ui';
import { 
  ArrowLeft, 
  Layers, 
  Settings, 
  LayoutDashboard, 
  FileCode2, 
  DollarSign, 
  Building2, 
  FileText,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { ProjectSummaryView } from './project/ProjectSummaryView';
import { ProjectDrawingsWorkspace } from './project/ProjectDrawingsWorkspace';
import { ProjectFinanceView } from './project/ProjectFinanceView';
import { ProjectVendorView } from './project/ProjectVendorView';
import { ProjectDocumentsWorkspace } from './project/ProjectDocumentsWorkspace';
import { ProjectSettingsModal } from '../components/project/ProjectSettingsModal';

function ProjectDetailContent() {
  const { id } = useParams<{id: string}>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects } = useProjects();
  const { items, loading } = useDrawings();
  const { canManageProjects, canViewFinance, canViewVendorCost } = usePermissions();

  const urlTab = searchParams.get('tab');
  const [activeWorkspace, setActiveWorkspace] = useState<'overview' | 'drawings' | 'finance' | 'vendor' | 'documents'>(
    (urlTab as any) || 'overview'
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Sync tab with URL query parameter
  useEffect(() => {
    if (urlTab && ['overview', 'drawings', 'finance', 'vendor', 'documents'].includes(urlTab)) {
      setActiveWorkspace(urlTab as any);
    }
  }, [urlTab]);

  const handleSwitchWorkspace = (workspaceKey: 'overview' | 'drawings' | 'finance' | 'vendor' | 'documents') => {
    setActiveWorkspace(workspaceKey);
    setSearchParams({ tab: workspaceKey });
  };

  const project = projects.find(p => p.id === id);

  if (!project) {
    return (
      <div className="p-8 text-center max-w-md mx-auto bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] mt-12">
        <h3 className="text-base font-bold text-[var(--color-text-primary)]">Proyek Tidak Ditemukan</h3>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
          Proyek dengan ID ini tidak tersedia atau Anda tidak memiliki hak akses.
        </p>
        <Link to="/projects">
          <Button size="sm" className="mt-4 bg-blue-600 text-white font-semibold">
            Kembali ke Daftar Proyek
          </Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const canSeeVendor = canViewVendorCost() || canViewFinance();
  const isPlanning = project.status === 'Planning' || (project.workflowStage && project.workflowStage !== 'ACTIVE');

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto">
      {/* 1. PLANNING / SETUP WIZARD NOTICE BANNER */}
      {isPlanning && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--color-text-primary)]">
                Proyek Dalam Tahap Penyusunan ({project.workflowStage || 'PROJECT_SETUP'})
              </h3>
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                Lengkapi parameter komersial, tim gambar, dan template sebelum aktivasi resmi.
              </p>
            </div>
          </div>
          <Link to={`/projects/${project.id}/wizard`}>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 text-xs font-semibold shadow-xs">
              Lengkapi di Setup Wizard →
            </Button>
          </Link>
        </div>
      )}

      {/* 2. COMPACT PROJECT HEADER (CANONICAL CONTEXT) */}
      <div className="bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Project identity */}
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/projects">
            <Button variant="ghost" size="icon" className="shrink-0" title="Kembali ke Daftar Proyek">
              <ArrowLeft className="w-4 h-4 text-slate-500" />
            </Button>
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-[var(--color-border)] text-slate-800 dark:text-slate-200">
                {project.projectCode}
              </span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                project.status === 'Berjalan'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              }`}>
                {project.status}
              </span>
              {project.workflowStage && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 hidden sm:inline-block">
                  Stage: {project.workflowStage}
                </span>
              )}
            </div>

            <h1 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)] truncate">
              {project.projectName}
            </h1>
            <p className="text-xs text-[var(--color-text-secondary)] truncate">
              Klien: <strong className="text-[var(--color-text-primary)]">{project.clientName}</strong> &bull; {items.length} Lembar Gambar &bull; PIC Leader: {project.projectLeaderName || 'Belum ditugaskan'}
            </p>
          </div>
        </div>

        {/* Right: Settings and Wizard quick actions */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          {canManageProjects() && (
            <>
              <Link to={`/projects/${project.id}/wizard`}>
                <Button variant="secondary" size="sm" className="text-xs font-semibold shadow-xs">
                  <Layers className="w-3.5 h-3.5 mr-1 text-blue-500" />
                  <span>Setup Wizard</span>
                </Button>
              </Link>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsSettingsOpen(true)}
                className="text-xs font-semibold shadow-xs"
                title="Pengaturan Proyek"
              >
                <Settings className="w-3.5 h-3.5 text-slate-500 mr-1" />
                <span>Pengaturan</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 3. THE 5 PRIMARY WORKSPACES NAVIGATION BAR */}
      <div className="flex items-center gap-1.5 p-1.5 bg-[var(--color-bg-secondary)] dark:bg-white/5 rounded-2xl border border-[var(--color-border)] overflow-x-auto shadow-xs">
        {/* 1. Ringkasan */}
        <button
          onClick={() => handleSwitchWorkspace('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeWorkspace === 'overview'
              ? 'bg-[var(--color-surface)] text-[var(--color-accent-blue)] border border-[var(--color-border)] shadow-xs'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>1. Ringkasan</span>
        </button>

        {/* 2. Gambar */}
        <button
          onClick={() => handleSwitchWorkspace('drawings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeWorkspace === 'drawings'
              ? 'bg-[var(--color-surface)] text-[var(--color-accent-blue)] border border-[var(--color-border)] shadow-xs'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <FileCode2 className="w-4 h-4" />
          <span>2. Gambar ({items.length})</span>
        </button>

        {/* 3. Keuangan */}
        {canViewFinance() && (
          <button
            onClick={() => handleSwitchWorkspace('finance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeWorkspace === 'finance'
                ? 'bg-[var(--color-surface)] text-emerald-600 dark:text-emerald-400 border border-[var(--color-border)] shadow-xs'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>3. Keuangan</span>
          </button>
        )}

        {/* 4. Vendor */}
        {canSeeVendor && (
          <button
            onClick={() => handleSwitchWorkspace('vendor')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeWorkspace === 'vendor'
                ? 'bg-[var(--color-surface)] text-cyan-600 dark:text-cyan-400 border border-[var(--color-border)] shadow-xs'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>4. Vendor</span>
          </button>
        )}

        {/* 5. Dokumen */}
        <button
          onClick={() => handleSwitchWorkspace('documents')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeWorkspace === 'documents'
              ? 'bg-[var(--color-surface)] text-purple-600 dark:text-purple-400 border border-[var(--color-border)] shadow-xs'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>5. Dokumen</span>
        </button>
      </div>

      {/* 4. WORKSPACE CONTENT AREA */}
      <div>
        {activeWorkspace === 'overview' && (
          <ProjectSummaryView
            project={project}
            onNavigateTab={(tab) => handleSwitchWorkspace(tab as any)}
          />
        )}

        {activeWorkspace === 'drawings' && (
          <ProjectDrawingsWorkspace
            projectId={project.id}
            projectName={project.projectName}
          />
        )}

        {activeWorkspace === 'finance' && canViewFinance() && (
          <ProjectFinanceView />
        )}

        {activeWorkspace === 'vendor' && canSeeVendor && (
          <ProjectVendorView
            projectId={project.id}
          />
        )}

        {activeWorkspace === 'documents' && (
          <ProjectDocumentsWorkspace
            projectId={project.id}
            projectName={project.projectName}
          />
        )}
      </div>

      {/* PROJECT SETTINGS MODAL */}
      <ProjectSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        project={project}
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
