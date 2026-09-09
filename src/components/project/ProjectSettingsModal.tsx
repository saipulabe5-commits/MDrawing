import React, { useState, useEffect } from 'react';
import { Modal, Input, Button } from '../ui';
import { useProjects } from '../../context/ProjectContext';
import { useFinance } from '../../context/FinanceContext';
import { Project } from '../../types';
import toast from 'react-hot-toast';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

export function ProjectSettingsModal({ isOpen, onClose, project }: ProjectSettingsModalProps) {
  const { updateProject } = useProjects();
  const { clients } = useFinance();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    projectName: '',
    projectCode: '',
    projectType: '',
    clientId: '',
    location: '',
  });

  useEffect(() => {
    if (isOpen && project) {
      setFormData({
        projectName: project.projectName || '',
        projectCode: project.projectCode || '',
        projectType: project.projectType || '',
        clientId: project.clientId || '',
        location: project.location || '',
      });
    }
  }, [isOpen, project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectName.trim()) {
      toast.error('Nama proyek wajib diisi');
      return;
    }
    
    setIsSubmitting(true);
    try {
      let clientName = project.clientName;
      let clientEmail = project.clientEmail;
      
      if (formData.clientId !== project.clientId) {
        const selectedClient = clients.find(c => c.id === formData.clientId);
        if (selectedClient) {
          clientName = selectedClient.clientName;
          clientEmail = selectedClient.email || '';
        }
      }

      await updateProject(project.id, {
        projectName: formData.projectName,
        projectCode: formData.projectCode,
        projectType: formData.projectType,
        clientId: formData.clientId,
        clientName: clientName,
        clientEmail: clientEmail,
        location: formData.location
      });
      toast.success('Pengaturan proyek berhasil disimpan');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan pengaturan proyek');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pengaturan Proyek">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">Nama Proyek</label>
            <Input 
              value={formData.projectName} 
              onChange={e => setFormData({...formData, projectName: e.target.value})} 
              placeholder="Contoh: Rumah Tinggal Bapak Budi"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">Kode Proyek</label>
            <Input 
              value={formData.projectCode} 
              onChange={e => setFormData({...formData, projectCode: e.target.value})} 
              placeholder="Contoh: RB-01"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">Tipe Proyek</label>
            <Input 
              value={formData.projectType} 
              onChange={e => setFormData({...formData, projectType: e.target.value})} 
              placeholder="Contoh: Residensial"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">Klien</label>
            <select
              className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
              value={formData.clientId}
              onChange={(e) => setFormData({...formData, clientId: e.target.value})}
            >
              <option value="">Pilih Klien (Opsional)</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.clientName} {c.companyName ? `(${c.companyName})` : ''}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--color-text-secondary)]">Lokasi Proyek</label>
          <Input 
            value={formData.location} 
            onChange={e => setFormData({...formData, location: e.target.value})} 
            placeholder="Contoh: Jakarta Selatan"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)] mt-6">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
