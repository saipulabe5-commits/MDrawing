import React, { useState } from "react";
import * as LucideIcons from "lucide-react";
import { useAI } from "../../context/AIContext";
import { AIQuotaModal } from "./AIQuotaModal";

export const AIStatusBadge: React.FC = () => {
  const { quotaState, toggleOpen } = useAI();
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);

  const getStatusConfig = () => {
    switch (quotaState.status) {
      case "READY":
        return {
          dotClass: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]",
          label: "AI Ready",
          badgeClass: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60",
        };
      case "WARNING":
        return {
          dotClass: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]",
          label: "AI Warning",
          badgeClass: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60",
        };
      case "LIMITED":
        return {
          dotClass: "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]",
          label: "AI Limited",
          badgeClass: "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200/80 dark:border-orange-800/60",
        };
      case "LOCKED":
        return {
          dotClass: "bg-rose-500",
          label: "AI Locked",
          badgeClass: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/60",
        };
      case "RATE_LIMITED":
        return {
          dotClass: "bg-yellow-500 animate-pulse",
          label: "AI Paused",
          badgeClass: "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300 border-yellow-200/80 dark:border-yellow-800/60",
        };
      case "OFFLINE":
        return {
          dotClass: "bg-slate-400",
          label: "AI Offline",
          badgeClass: "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
        };
      case "BILLING_BLOCKED":
        return {
          dotClass: "bg-red-600",
          label: "AI Blocked",
          badgeClass: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200/80 dark:border-red-800/60",
        };
      default:
        return {
          dotClass: "bg-blue-500",
          label: quotaState.status,
          badgeClass: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60",
        };
    }
  };

  const statusConfig = getStatusConfig();
  const isMac = typeof navigator !== "undefined" && navigator.userAgent.toUpperCase().indexOf("MAC") >= 0;
  const shortcutLabel = isMac ? "⌘K" : "Ctrl+K";

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          onClick={toggleOpen}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xs cursor-pointer ${statusConfig.badgeClass}`}
          title={`MDrawing AI (${statusConfig.label}) - Tekan ${shortcutLabel} untuk membuka`}
        >
          <span className={`w-2 h-2 rounded-full ${statusConfig.dotClass}`} />
          <span className="tracking-tight">{statusConfig.label}</span>
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-medium">
            {shortcutLabel}
          </span>
        </button>

        <button
          onClick={() => setQuotaModalOpen(true)}
          className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          title="Lihat Status Quota & Kebijakan Zero-Billing"
        >
          <LucideIcons.Gauge className="w-4 h-4" />
        </button>
      </div>

      <AIQuotaModal isOpen={quotaModalOpen} onClose={() => setQuotaModalOpen(false)} />
    </>
  );
};
