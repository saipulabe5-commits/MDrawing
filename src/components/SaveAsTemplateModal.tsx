import React, { useState } from "react";
import { useDrawingTemplates } from "../context/DrawingTemplateContext";
import { Modal, Button } from "./ui";
import { BookmarkPlus, Layers, FileText } from "lucide-react";
import { DrawingGroup, DrawingItem } from "../types";
import toast from "react-hot-toast";

interface SaveAsTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  groups: DrawingGroup[];
  items: DrawingItem[];
}

export function SaveAsTemplateModal({
  isOpen,
  onClose,
  projectName,
  groups,
  items,
}: SaveAsTemplateModalProps) {
  const { saveProjectAsTemplate } = useDrawingTemplates();
  const [templateName, setTemplateName] = useState(`Template - ${projectName}`);
  const [projectType, setProjectType] = useState("Residensial");
  const [description, setDescription] = useState(
    `Template master yang diekstrak dari gambar proyek "${projectName}".`
  );
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) {
      toast.error("Nama template wajib diisi.");
      return;
    }

    if (items.length === 0) {
      toast.error("Proyek ini belum memiliki item gambar untuk disimpan sebagai template.");
      return;
    }

    setLoading(true);
    try {
      await saveProjectAsTemplate(
        templateName.trim(),
        projectType.trim(),
        description.trim(),
        groups,
        items
      );
      onClose();
    } catch {
      // Error handled in context
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Simpan Proyek Sebagai Template Master" maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Source Summary Card */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80 text-xs space-y-1.5">
          <div className="text-slate-500 dark:text-slate-400">Sumber Data:</div>
          <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
            {projectName}
          </div>
          <div className="flex items-center gap-3 pt-1 text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              <strong>{groups.length}</strong> Grup Gambar
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-emerald-500" />
              <strong>{items.length}</strong> Lembar Gambar
            </span>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Template <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="contoh: Standar Gambar Rumah 2 Lantai"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tipe Proyek
            </label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-slate-100"
            >
              <option value="Residensial">Residensial (Rumah Tinggal, Villa)</option>
              <option value="Komersial">Komersial (Ruko, Kantor, Kafe)</option>
              <option value="Interior">Interior / Fit-Out</option>
              <option value="Industri">Industri / Gudang</option>
              <option value="Umum">Umum / Lainnya</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Deskripsi Template
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Catatan mengenai peruntukan atau spesifikasi template ini..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-zinc-700">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button type="submit" variant="primary" disabled={loading} className="gap-1.5">
            <BookmarkPlus className="w-4 h-4" />
            {loading ? "Menyimpan Template..." : "Simpan Sebagai Template"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
