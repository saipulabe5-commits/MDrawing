import React, { useState } from "react";
import { DrawingItem } from "../types";
import { Modal, Button } from "./ui";
import { Mail, Send, AlertCircle, CheckCircle, ExternalLink, Calendar, Clock, User } from "lucide-react";
import { sendManualReminderEmail } from "../lib/emailService";
import toast from "react-hot-toast";

interface EmailReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: DrawingItem | null;
  projectName: string;
}

export function EmailReminderModal({ isOpen, onClose, item, projectName }: EmailReminderModalProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [testPreviewUrl, setTestPreviewUrl] = useState<string | null>(null);

  // Sync initial state when item changes
  React.useEffect(() => {
    if (item) {
      setRecipientEmail(item.picEmail || "");
      setRecipientName(item.picName || "");
      setCustomNote("");
      setTestPreviewUrl(null);
    }
  }, [item]);

  if (!item) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail || !recipientEmail.includes("@")) {
      toast.error("Harap masukkan alamat email PIC yang valid.");
      return;
    }

    setLoading(true);
    setTestPreviewUrl(null);
    try {
      const res = await sendManualReminderEmail({
        recipientEmail,
        recipientName: recipientName || item.picName || "PIC",
        drawingNumber: item.drawingNumber,
        drawingName: item.drawingName,
        projectName,
        deadlineDate: item.deadline ? new Date(item.deadline).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-",
        progress: item.progress,
        status: item.status,
        notes: item.notes,
        customNote: customNote.trim() || undefined,
      });

      toast.success(res.message || "Email pengingat berhasil dikirim!");
      if (res.previewUrl) {
        setTestPreviewUrl(res.previewUrl);
      } else {
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim email pengingat.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Kirim Pengingat Email ke PIC" maxWidth="max-w-lg">
      <form onSubmit={handleSend} className="space-y-4">
        {/* Drawing Context Card */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80 text-xs space-y-2">
          <div className="flex items-center justify-between font-medium">
            <span className="font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded text-[11px] font-semibold">
              {item.drawingNumber}
            </span>
            <span className="text-[var(--color-text-secondary)]">{projectName}</span>
          </div>
          <div className="font-medium text-slate-800 dark:text-slate-100 text-sm">
            {item.drawingName}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 text-[var(--color-text-secondary)] border-t border-slate-200/60 dark:border-zinc-700/60">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              <span>Deadline: <strong className="text-slate-700 dark:text-slate-200">{item.deadline || "-"}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>Progress: <strong className="text-slate-700 dark:text-slate-200">{item.progress}%</strong></span>
            </div>
          </div>
        </div>

        {/* Email form fields */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email Penerima (PIC) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="contoh: pic@perusahaan.com"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-slate-100"
              />
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Penerima
            </label>
            <div className="relative">
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Nama PIC (opsional)"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-slate-100"
              />
              <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Pesan Tambahan (Opsional)
            </label>
            <textarea
              rows={3}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Tambahkan catatan khusus terkait revisi atau instruksi pengerjaan..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Ethereal test message preview banner if returned */}
        {testPreviewUrl && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 dark:text-emerald-200 flex-1">
              <div className="font-semibold mb-0.5">Email Terkirim (Simulator Dev)</div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mb-2">
                Email pengingat berhasil dikirim melalui simulator test email. Anda dapat melihat pratinjau rendering HTML aslinya:
              </p>
              <a
                href={testPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800"
              >
                Lihat Rendering Email <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-zinc-700">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {testPreviewUrl ? "Tutup" : "Batal"}
          </Button>
          <Button type="submit" variant="primary" disabled={loading} className="gap-1.5">
            <Send className="w-4 h-4" />
            {loading ? "Mengirim..." : "Kirim Email"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
