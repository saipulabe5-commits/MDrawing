import React, { useState } from "react";
import { useDrawingTemplates } from "../context/DrawingTemplateContext";
import { Modal, Button, Badge, ConfirmModal } from "./ui";
import { Layers, CheckCircle2, AlertTriangle, ArrowRight, BookOpen } from "lucide-react";
import toast from "react-hot-toast";

interface ApplyTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

export function ApplyTemplateModal({ isOpen, onClose, projectId, projectName }: ApplyTemplateModalProps) {
  const { templates, loadingTemplates, applyTemplateToProject } = useDrawingTemplates();
  const [selectedId, setSelectedId] = useState<string>("");
  const [strategy, setStrategy] = useState<"append" | "overwrite">("append");
  const [loading, setLoading] = useState(false);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

  // Auto select first template if available
  React.useEffect(() => {
    if (templates.length > 0 && !selectedId) {
      setSelectedId(templates[0].id);
    }
  }, [templates, selectedId]);

  if (!isOpen) return null;

  const executeApply = async () => {
    setLoading(true);
    try {
      await applyTemplateToProject(projectId, selectedId, strategy);
      onClose();
    } catch {
      // Error handled inside context toast
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!selectedId) {
      toast.error("Pilih salah satu template terlebih dahulu.");
      return;
    }

    if (strategy === "overwrite") {
      setShowOverwriteConfirm(true);
      return;
    }

    await executeApply();
  };

  const selectedTemplate = templates.find((t) => t.id === selectedId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Terapkan Template Gambar ke Proyek" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {/* Project info card */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80 text-xs">
          <div className="text-slate-500 dark:text-slate-400">Target Proyek:</div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
            {projectName}
          </div>
        </div>

        {/* Template Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Pilih Template Gambar Master:
          </label>
          {loadingTemplates ? (
            <div className="py-8 text-center text-xs text-slate-500">Memuat template...</div>
          ) : templates.length === 0 ? (
            <div className="p-6 text-center border border-dashed border-slate-200 dark:border-zinc-700 rounded-xl">
              <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Belum ada template master yang tersimpan.
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Buka menu "Template Gambar" untuk membuat atau mengimpor template master default.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[220px] overflow-y-auto p-1">
              {templates.map((tpl) => {
                const isSelected = tpl.id === selectedId;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => setSelectedId(tpl.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20"
                        : "border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                        {tpl.templateName}
                      </span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mb-1.5 font-medium">
                      <span className="bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                        {tpl.projectType || "Umum"}
                      </span>
                      <span>{tpl.groupCount || 0} grup</span>
                      <span>•</span>
                      <span>{tpl.itemCount || 0} gambar</span>
                    </div>
                    {tpl.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                        {tpl.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Strategy Selection */}
        {selectedTemplate && (
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-zinc-700">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Metode Penerapan ke Proyek:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  strategy === "append"
                    ? "border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 text-slate-900 dark:text-slate-100"
                    : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="apply_strategy"
                  value="append"
                  checked={strategy === "append"}
                  onChange={() => setStrategy("append")}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-semibold">Gabungkan (Append)</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Tambahkan grup & gambar baru dari template tanpa menghapus gambar yang sudah ada.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  strategy === "overwrite"
                    ? "border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 text-slate-900 dark:text-slate-100"
                    : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="apply_strategy"
                  value="overwrite"
                  checked={strategy === "overwrite"}
                  onChange={() => setStrategy("overwrite")}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-semibold text-amber-700 dark:text-amber-400">Ganti Semua (Overwrite)</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Hapus semua grup & gambar saat ini dan gantikan seluruhnya dengan isi template.
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-zinc-700">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleApply}
            disabled={loading || !selectedId}
            className="gap-1.5"
          >
            <Layers className="w-4 h-4" />
            {loading ? "Menerapkan Template..." : "Terapkan Template Ini"}
          </Button>
        </div>
      </div>
      <ConfirmModal
        isOpen={showOverwriteConfirm}
        onClose={() => setShowOverwriteConfirm(false)}
        onConfirm={executeApply}
        title="Konfirmasi Ganti Semua"
        message="PERINGATAN: Opsi 'Ganti Semua' akan menghapus seluruh grup dan item gambar yang ada di proyek ini saat ini dan menggantikannya dengan isi template. Lanjutkan?"
        confirmLabel="Ya, Ganti Semua"
        cancelLabel="Batal"
        variant="danger"
      />
    </Modal>
  );
}
