import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import * as LucideIcons from 'lucide-react';
import { cn, ConfirmModal } from '../components/ui';
import { AIStatusBadge } from '../components/ai/AIStatusBadge';
import { AICommandModal } from '../components/ai/AICommandModal';

function TopBar({ onMenuClick, onLogoutClick }: { onMenuClick: () => void; onLogoutClick: () => void }) {
  const { appUser } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <header className="h-14 border-b border-[var(--color-border)] bg-white dark:bg-slate-900 flex items-center justify-between px-4 sticky top-0 z-40 shadow-xs">
      <div className="flex items-center gap-3">
        <button 
          onClick={onMenuClick} 
          className="md:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300"
          title="Buka Menu"
        >
          <LucideIcons.Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-tight text-[var(--color-text-primary)] hidden md:block">MDrawing</span>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-[var(--color-border)] rounded-full px-2.5 py-0.5 hidden lg:inline-block">
            Sistem Manajemen Gambar & Keuangan Proyek
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* AI Agent macOS Status Capsule */}
        <AIStatusBadge />

        {/* Theme Toggle Button */}
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
          title={`Ganti ke Tema ${theme === 'dark' ? 'Terang (Light)' : 'Gelap (Dark)'}`}
        >
          {theme === 'dark' ? <LucideIcons.Sun className="w-4 h-4 text-amber-400" /> : <LucideIcons.Moon className="w-4 h-4 text-slate-700" />}
        </button>
        
        {/* User Avatar & Logout */}
        <div className="flex items-center gap-2 pl-1 border-l border-slate-200 dark:border-slate-800">
          <div 
            className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-xs cursor-default"
            title={`${appUser?.name || 'User'} (${appUser?.role || 'VIEWER'})`}
          >
            {appUser?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <button
            onClick={onLogoutClick}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-300 dark:hover:border-rose-900 text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 text-xs font-semibold transition-all shadow-xs cursor-pointer"
            title="Keluar dari akun (Logout)"
          >
            <LucideIcons.LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function Sidebar({ isOpen, onClose, onLogoutClick }: { isOpen: boolean; onClose: () => void; onLogoutClick: () => void }) {
  const { appUser } = useAuth();
  
  // This will be expanded in later phases. Just Foundation for Phase 1.
  const menuGroups = [
    {
      title: "PRODUKSI GAMBAR",
      items: [
        { label: "Dashboard", path: "/", icon: LucideIcons.LayoutDashboard, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/50" },
        { label: "Proyek", path: "/projects", icon: LucideIcons.FolderOpen, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/50" },
        { label: "Template Gambar", path: "/templates", icon: LucideIcons.BookTemplate, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/50" },
        { label: "Klien", path: "/clients", icon: LucideIcons.Users, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/50" },
        { label: "Vendor", path: "/vendors", icon: LucideIcons.Building2, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-950/50" },
      ]
    },
    {
      title: "KEUANGAN & LAPORAN",
      items: [
        { label: "Laporan Konsolidasi", path: "/reports", icon: LucideIcons.BarChart3, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/50" },
        { label: "Audit Log Finansial", path: "/financial-audit", icon: LucideIcons.ShieldCheck, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/50" },
      ]
    },
    {
      title: "SISTEM & AUDIT",
      items: [
        { label: "Log Aktivitas", path: "/activity-log", icon: LucideIcons.Activity, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/50" },
        { label: "Panduan Pengguna", path: "/guide", icon: LucideIcons.BookOpen, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/50" },
        { label: "Pengaturan", path: "/settings", icon: LucideIcons.Settings, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800" },
      ]
    }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar with solid macOS background */}
      <aside className={cn(
        "fixed md:sticky top-0 left-0 z-40 h-screen w-64 border-r border-[var(--color-border)] bg-slate-50 dark:bg-slate-900 transition-transform duration-300 ease-in-out flex flex-col shrink-0 shadow-sm md:shadow-none",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-[var(--color-border)] bg-white/70 dark:bg-black/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs tracking-wider">
              MD
            </div>
            <div className="min-w-0">
              <span className="font-bold text-sm tracking-tight text-[var(--color-text-primary)] block leading-tight">MDrawing</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium truncate leading-none">PT. Asa Perdana Mandiri</span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="md:hidden p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
          >
            <LucideIcons.X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {menuGroups.map((group, idx) => (
            <div key={idx}>
              <h4 className="px-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {group.title}
              </h4>
              <nav className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => { if (window.innerWidth < 768) onClose(); }}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-all group",
                      isActive 
                        ? "bg-blue-600 text-white shadow-xs font-semibold" 
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        <div className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0",
                          isActive 
                            ? "bg-white/20 text-white" 
                            : cn(item.bg, item.color)
                        )}>
                          <item.icon className="w-4 h-4" />
                        </div>
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}
        </div>
        
        {/* User Card Footer */}
        <div className="p-3 border-t border-[var(--color-border)] bg-white/50 dark:bg-black/20 shrink-0">
          <div className="flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                {appUser?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{appUser?.name || 'saipul abe'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide truncate">{appUser?.role || 'OWNER'}</p>
                </div>
              </div>
            </div>
            <button
              onClick={onLogoutClick}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0 cursor-pointer"
              title="Keluar / Logout"
            >
              <LucideIcons.LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { simulatedRole, setSimulatedRole, realAppUser, logOut } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        onLogoutClick={() => setShowLogoutModal(true)} 
      />
      <main className="flex-1 flex flex-col min-w-0">
        <TopBar 
          onMenuClick={() => setSidebarOpen(true)} 
          onLogoutClick={() => setShowLogoutModal(true)} 
        />
        {simulatedRole && (
          <div className="bg-amber-500/15 dark:bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <span className="font-semibold px-2 py-0.5 rounded bg-amber-500 text-white text-[11px] uppercase tracking-wider">
                Mode Uji Peran
              </span>
              <span>
                Sedang menguji tampilan & hak akses sebagai <strong>{simulatedRole}</strong> (Akun Asli: {realAppUser?.role || 'OWNER'})
              </span>
            </div>
            <button
              onClick={() => setSimulatedRole(null)}
              className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-medium text-[11px] transition-colors shadow-sm"
            >
              Kembali ke Peran Asli ({realAppUser?.role || 'OWNER'})
            </button>
          </div>
        )}
        <div className="flex-1 p-4 md:p-6">
          <Outlet />
        </div>
      </main>
      <AICommandModal />
      <ConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={async () => {
          await logOut();
        }}
        title="Konfirmasi Keluar Akun"
        message="Apakah Anda yakin ingin keluar dari akun MDrawing? Sesi kerja Anda saat ini akan diakhiri dan dialihkan kembali ke layar login."
        confirmLabel="Ya, Keluar Akun"
        cancelLabel="Batal"
        variant="danger"
      />
    </div>
  );
}
