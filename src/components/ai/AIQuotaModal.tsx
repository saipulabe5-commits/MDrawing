import React from "react";
import * as LucideIcons from "lucide-react";
import { useAI } from "../../context/AIContext";

interface AIQuotaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIQuotaModal: React.FC<AIQuotaModalProps> = ({ isOpen, onClose }) => {
  const { quotaState, manualRetryQuota } = useAI();

  if (!isOpen) return null;

  const getStatusBadge = () => {
    switch (quotaState.status) {
      case "READY":
        return {
          bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          label: "Siap Digunakan (Free-Tier)",
          icon: LucideIcons.CheckCircle2,
        };
      case "WARNING":
        return {
          bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          label: "Peringatan Batas Quota",
          icon: LucideIcons.AlertTriangle,
        };
      case "LIMITED":
        return {
          bg: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
          label: "Mode Hemat Aktif (Economy Mode)",
          icon: LucideIcons.ZapOff,
        };
      case "LOCKED":
        return {
          bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
          label: "Terkunci (Quota Habis)",
          icon: LucideIcons.Lock,
        };
      case "RATE_LIMITED":
        return {
          bg: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
          label: "Batas Kecepatan (RPM)",
          icon: LucideIcons.Clock,
        };
      case "OFFLINE":
        return {
          bg: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
          label: "Offline",
          icon: LucideIcons.WifiOff,
        };
      case "BILLING_BLOCKED":
        return {
          bg: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
          label: "Diblokir (Kebijakan Zero-Billing)",
          icon: LucideIcons.ShieldAlert,
        };
      default:
        return {
          bg: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
          label: quotaState.status,
          icon: LucideIcons.Info,
        };
    }
  };

  const statusBadge = getStatusBadge();
  const StatusIcon = statusBadge.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-quota-title"
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <LucideIcons.Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 id="ai-quota-title" className="font-bold text-base text-slate-900 dark:text-slate-100">
                Status Quota AI (Free-Tier Only)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kebijakan Zero-Billing PT. Asa Perdana Mandiri
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <LucideIcons.X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Banner */}
        <div className={`flex items-center gap-3 p-3.5 rounded-xl border ${statusBadge.bg}`}>
          <StatusIcon className="w-5 h-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold">{statusBadge.label}</p>
            <p className="text-[11px] opacity-80 mt-0.5 leading-snug">
              {quotaState.reason || "AI beroperasi normal di bawah batas gratis provider."}
            </p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Request Sesi Ini</p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
              {quotaState.sessionRequests} <span className="text-xs font-normal text-slate-400">/ 40</span>
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Request Hari Ini</p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
              {quotaState.dailyRequests} <span className="text-xs font-normal text-slate-400">/ 200</span>
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Estimasi Token Hari Ini</p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
              {quotaState.estimatedTokens.toLocaleString("id-ID")}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Biaya Tambahan</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              Rp 0 <span className="text-[11px] font-normal text-slate-400">(Gratis)</span>
            </p>
          </div>
        </div>

        {/* Policy Checklist */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-2">
              <LucideIcons.ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Model Aktif
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200">
              {quotaState.model}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-2">
              <LucideIcons.ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Mode Billing
            </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">FREE_ONLY</span>
          </div>

          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-2">
              <LucideIcons.ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Fallback Model Berbayar
            </span>
            <span className="font-semibold text-rose-500">NONAKTIF (Dicegah)</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={() => {
              manualRetryQuota();
              onClose();
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5"
          >
            <LucideIcons.RefreshCw className="w-3.5 h-3.5" />
            Cek Ulang Status
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
