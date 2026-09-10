import React, { useState, useEffect } from 'react';
import { useProjects } from '../context/ProjectContext';
import { Button, Card, Badge, Input, Modal } from '../components/ui';
import { Plus, Search, FolderKanban, BookTemplate, Info, Settings, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DrawingTemplate, Project } from '../types';
import { ProjectSettingsModal } from '../components/project/ProjectSettingsModal';
import toast from 'react-hot-toast';

export function ProjectsView() {
  const { projects, loadingProjects, createProject, deleteProject } = useProjects();
  const { canManageProjects } = usePermissions();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  // Form states
  const [projectName, setProjectName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [projectType, setProjectType] = useState('');
  const [clientName, setClientName] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<'Planning' | 'Berjalan' | 'Hold' | 'Selesai' | 'Cancelled'>('Planning');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Templates list for dropdown
  const [templates, setTemplates] = useState<DrawingTemplate[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'drawingTemplates'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as DrawingTemplate);
      setTemplates(list);
    }, (err) => console.error("Error fetching templates in ProjectsView:", err));
    return () => unsub();
  }, []);

  // Auto-generate canonical project code when modal opens
  useEffect(() => {
    if (isNewModalOpen && !projectCode && projects.length >= 0) {
      const year = new Date().getFullYear();
      const prefix = `PRJ-${year}-`;
      let maxSequence = 0;
      
      projects.forEach(p => {
        if (p.projectCode && p.projectCode.startsWith(prefix)) {
          const seqStr = p.projectCode.substring(prefix.length);
          const seq = parseInt(seqStr, 10);
          if (!isNaN(seq) && seq > maxSequence) {
            maxSequence = seq;
          }
        }
      });
      
      const nextSequence = maxSequence + 1;
      setProjectCode(`${prefix}${nextSequence.toString().padStart(3, '0')}`);
    }
  }, [isNewModalOpen, projects, projectCode]);

  const filteredProjects = projects.filter(p => 
    p.projectName.toLowerCase().includes(search.toLowerCase()) || 
    p.projectCode.toLowerCase().includes(search.toLowerCase())
  );

  const selectedTemplateObj = templates.find((t) => t.id === selectedTemplateId);

  const handleTemplateChange = (tplId: string) => {
    setSelectedTemplateId(tplId);
    if (tplId) {
      const tpl = templates.find((t) => t.id === tplId);
      if (tpl?.projectType && !projectType) {
        setProjectType(tpl.projectType);
      }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createProject(
        {
          projectName,
          projectCode,
          projectType,
          clientName,
          location,
          status,
          startDate: new Date().toISOString().split('T')[0],
          targetDate: new Date().toISOString().split('T')[0],
          description: selectedTemplateObj ? `Dibuat dari template: ${selectedTemplateObj.templateName}` : '',
          members: []
        },
        selectedTemplateId || undefined
      );
      setIsNewModalOpen(false);
      // Reset
      setProjectName('');
      setProjectCode('');
      setProjectType('');
      setClientName('');
      setLocation('');
      setSelectedTemplateId('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Planning': return 'info';
      case 'Berjalan': return 'info';
      case 'Selesai': return 'success';
      case 'Hold': return 'warning';
      case 'Cancelled': return 'danger';
      default: return 'default';
    }
  };

  const handleDelete = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProject(projectToDelete.id);
      toast.success('Proyek berhasil dihapus');
      setProjectToDelete(null);
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus proyek');
    }
  };

  if (loadingProjects) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--color-accent-blue)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">Proyek</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Kelola daftar proyek dan gambar kerja.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
            <Input 
              placeholder="Cari proyek..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {canManageProjects() && (
            <Link to="/projects/new">
              <Button className="shrink-0">
                <Plus className="w-4 h-4 mr-2" />
                Proyek Baru (Wizard)
              </Button>
            </Link>
          )}
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <div className="w-16 h-16 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
            <FolderKanban className="w-8 h-8 text-[var(--color-text-secondary)]" />
          </div>
          <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-1">Tidak ada proyek</h3>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mb-6">
            Belum ada proyek yang ditambahkan atau tidak ada yang cocok dengan pencarian Anda.
          </p>
          {canManageProjects() && (
            <Link to="/projects/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" /> Buat Proyek Pertama (Wizard)
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <div key={project.id} className="relative group">
              <Link to={`/projects/${project.id}`}>
                <Card className="p-5 hover:border-[var(--color-accent-blue)] transition-all cursor-pointer h-full flex flex-col group relative">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant={getStatusColor(project.status) as any}>{project.status}</Badge>
                      {project.workflowStage && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          {project.workflowStage}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 relative z-10" onClick={e => e.preventDefault()}>
                      {canManageProjects() && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[var(--color-bg-primary)] p-1 rounded-md shadow-sm border border-[var(--color-border)] absolute right-full mr-2 top-0 whitespace-nowrap">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 px-2 text-xs" 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setProjectToEdit(project);
                            }}
                          >
                            <Settings className="w-3.5 h-3.5 mr-1" /> Edit
                          </Button>
                          <div className="w-px h-4 bg-[var(--color-border)]"></div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setProjectToDelete(project);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus
                          </Button>
                        </div>
                      )}
                      <div className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] tracking-wide shadow-sm flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-blue)] opacity-70"></span>
                        {project.projectCode}
                      </div>
                    </div>
                  </div>
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent-blue)] transition-colors line-clamp-2">
                    {project.projectName}
                  </h3>
                  <div className="mt-auto pt-4 space-y-1">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      <span className="font-medium text-[var(--color-text-primary)]">Klien:</span> {project.clientName}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      <span className="font-medium text-[var(--color-text-primary)]">Lokasi:</span> {project.location}
                    </p>
                    {project.status === 'Planning' && (
                      <div className="pt-2">
                        <Link 
                          to={`/projects/${project.id}/wizard`} 
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center text-xs font-semibold text-[var(--color-accent-blue)] hover:underline"
                        >
                          Lanjutkan Setup Wizard →
                        </Link>
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="Buat Proyek Baru">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nama Proyek *</label>
              <Input required value={projectName} onChange={e => setProjectName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Kode Proyek *</label>
              <Input required value={projectCode} onChange={e => setProjectCode(e.target.value)} />
            </div>
          </div>

          {/* Pilihan Template Gambar */}
          <div className="space-y-1.5 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                <BookTemplate className="w-3.5 h-3.5 text-[var(--color-accent-blue)]" />
                Template Gambar Kerja (Opsional)
              </label>
              {templates.length === 0 && (
                <span className="text-[11px] text-[var(--color-text-tertiary)]">Belum ada template tersimpan</span>
              )}
            </div>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]"
            >
              <option value="">-- Tanpa Template (Mulai Proyek Kosong) --</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.templateName} ({tpl.projectType || 'Umum'} • {tpl.groupCount || 0} Grup, {tpl.itemCount || 0} Gambar)
                </option>
              ))}
            </select>
            {selectedTemplateObj && (
              <div className="flex items-start gap-2 pt-1 text-[11px] text-[var(--color-text-secondary)]">
                <Info className="w-3.5 h-3.5 mt-0.5 text-[var(--color-accent-blue)] shrink-0" />
                <span>
                  {selectedTemplateObj.description || 'Template akan membuat grup dan seluruh item gambar secara otomatis.'}
                </span>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Jenis / Bidang Pekerjaan</label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'Arsitektur', label: 'Arsitektur' },
                { id: 'Struktur', label: 'Struktur' },
                { id: 'MEP', label: 'MEP' },
                { id: 'Interior', label: 'Interior' },
                { id: 'Masterplan', label: 'Masterplan' },
                { id: 'Infrastruktur', label: 'Infrastruktur' },
                { id: 'QS', label: 'Quantity Surveyor (QS)' }
              ].map(type => {
                const isSelected = projectType.split(', ').includes(type.id);
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      const types = projectType.split(', ').filter(Boolean);
                      if (isSelected) {
                        setProjectType(types.filter(t => t !== type.id).join(', '));
                      } else {
                        setProjectType([...types, type.id].join(', '));
                      }
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isSelected 
                        ? 'bg-[var(--color-accent-blue)] text-white shadow-sm border-[var(--color-accent-blue)]' 
                        : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
                    } border`}
                  >
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nama Klien *</label>
              <Input required value={clientName} onChange={e => setClientName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Lokasi</label>
              <Input value={location} onChange={e => setLocation(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Status Awal</label>
            <select 
              value={status} 
              onChange={(e) => setStatus(e.target.value as any)}
              className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]"
            >
              <option value="Planning">Planning</option>
              <option value="Berjalan">Berjalan</option>
              <option value="Hold">Hold</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsNewModalOpen(false)}>Batal</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Membuat Proyek & Gambar..." : "Buat Proyek"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Project Settings Modal */}
      {projectToEdit && (
        <ProjectSettingsModal
          isOpen={!!projectToEdit}
          onClose={() => setProjectToEdit(null)}
          project={projectToEdit}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!projectToDelete} onClose={() => setProjectToDelete(null)} title="Hapus Proyek">
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-red-600 dark:text-red-500" />
            </div>
            <h3 className="text-lg font-medium text-[var(--color-text-primary)]">Hapus Proyek?</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-2">
              Anda yakin ingin menghapus proyek <strong>{projectToDelete?.projectName}</strong>? Tindakan ini tidak dapat dibatalkan dan semua data terkait proyek ini akan hilang.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
            <Button variant="ghost" onClick={() => setProjectToDelete(null)}>Batal</Button>
            <Button className="bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete}>
              Ya, Hapus Proyek
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
