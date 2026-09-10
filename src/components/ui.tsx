import React, { forwardRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as LucideIcons from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---- BUTTON ----
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseClass = "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg";
    
    const variants = {
      primary: "bg-[var(--color-accent-blue)] text-white hover:bg-opacity-90 shadow-sm",
      secondary: "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-black/5 dark:hover:bg-white/10 shadow-sm",
      ghost: "hover:bg-black/5 dark:hover:bg-white/10 text-[var(--color-text-primary)]",
      danger: "bg-[var(--color-accent-red)] text-white hover:bg-opacity-90 shadow-sm",
    };
    
    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
      icon: "h-10 w-10",
    };

    return (
      <button
        ref={ref}
        className={cn(baseClass, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

// ---- CARD ----
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn("bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-sm overflow-hidden", className)} 
      {...props}
    >
      {children}
    </div>
  );
}

// ---- INPUT ----
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string, label: string }[] }>(
  ({ className, options, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "w-full px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-sm transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)] focus:border-transparent",
          "text-[var(--color-text-primary)] font-medium",
          "disabled:opacity-75 disabled:bg-black/[0.04] dark:disabled:bg-white/[0.06] disabled:cursor-not-allowed",
          className
        )}
        {...props}
      >
        {options.map((opt, i) => (
          <option key={i} value={opt.value} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">{opt.label}</option>
        ))}
      </select>
    );
  }
);

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, ...props }, ref) => {
    return (
      <div className="w-full space-y-1">
        {label && (
          <label className="block text-xs font-semibold text-[var(--color-text-primary)]">
            {label}
          </label>
        )}
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] font-medium transition-colors placeholder:text-[var(--color-text-secondary)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-blue)] focus-visible:border-transparent disabled:cursor-not-allowed disabled:bg-black/[0.04] dark:disabled:bg-white/[0.06] disabled:text-[var(--color-text-primary)] disabled:opacity-75",
            error && "border-red-500",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

// ---- MODAL (macOS Window Chrome) ----
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
  showTrafficLights?: boolean;
}

export function Modal({ isOpen, onClose, title, children, className, maxWidth, showTrafficLights = true }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/20 dark:bg-black/40 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={cn(
                "pointer-events-auto w-full bg-[var(--color-surface)]/95 backdrop-blur-xl border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col",
                maxWidth || "max-w-lg",
                className
              )}
            >
              {/* Window Chrome Header */}
              <div className="h-12 border-b border-[var(--color-border)] flex items-center justify-center relative select-none">
                {showTrafficLights && (
                  <div className="absolute left-4 flex gap-2">
                    <button onClick={onClose} className="w-3 h-3 rounded-full bg-[#FF5F56] hover:bg-[#FF5F56]/80 flex items-center justify-center group">
                      <LucideIcons.X className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" />
                    </button>
                    <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                    <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
                  </div>
                )}
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
              </div>
              <div className="p-6 overflow-y-auto max-h-[80vh]">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---- TOGGLE SWITCH ----
export function Toggle({ checked, onChange, disabled }: { checked: boolean, onChange: (v: boolean) => void, disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-blue)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-[var(--color-accent-green)]" : "bg-black/10 dark:bg-white/10"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ---- BADGE ----
export function Badge({ children, variant = 'default', className }: { children: React.ReactNode, variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline' | 'purple', className?: string }) {
  const variants = {
    default: "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 font-bold",
    success: "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/60 font-bold",
    warning: "bg-amber-100 dark:bg-amber-950/70 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60 font-bold",
    danger: "bg-rose-100 dark:bg-rose-950/70 text-rose-950 dark:text-rose-200 border border-rose-300 dark:border-rose-700/60 font-bold",
    info: "bg-blue-100 dark:bg-blue-950/70 text-blue-950 dark:text-blue-200 border border-blue-300 dark:border-blue-700/60 font-bold",
    outline: "border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 bg-white/70 dark:bg-slate-800/40 font-bold",
    purple: "bg-purple-100 dark:bg-purple-950/70 text-purple-950 dark:text-purple-200 border border-purple-300 dark:border-purple-700/60 font-bold",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap leading-none tracking-wide", variants[variant], className)}>
      {children}
    </span>
  );
}

// ---- SEGMENTED CONTROL ----
export function SegmentedControl({ options, value, onChange }: { options: {label: string, value: string}[], value: string, onChange: (v: string) => void }) {
  return (
    <div className="inline-flex bg-slate-200/70 dark:bg-white/10 p-1 rounded-xl border border-[var(--color-border)] flex-wrap gap-0.5">
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap",
              isActive ? "text-[var(--color-text-primary)] font-semibold shadow-xs" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="segmented-highlight"
                className="absolute inset-0 bg-[var(--color-surface)] rounded-lg shadow-xs border border-[var(--color-border)]"
                initial={false}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---- CONFIRM MODAL (macOS In-App Alert) ----
export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Konfirmasi Tindakan",
  message,
  confirmLabel = "Lanjutkan",
  cancelLabel = "Batal",
  variant = "danger",
  isLoading = false
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="flex items-start gap-3.5">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
            variant === 'danger' ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
          )}>
            <LucideIcons.AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {message}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--color-border)]">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button 
            variant={variant === 'danger' ? 'danger' : 'primary'} 
            size="sm" 
            disabled={isLoading}
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

