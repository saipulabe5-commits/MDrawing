import React, { useState } from 'react';
import { DrawingGroup, DrawingItem } from '../types';
import { Button } from './ui';
import { 
  FileSpreadsheet, Printer, Download, Moon, Sun, 
  Layers, X, CheckCircle2, Clock, AlertCircle, RefreshCw
} from 'lucide-react';
import { exportDrawingListToPDF } from '../lib/exportUtils';
import { formatScale } from '../lib/scaleUtils';
import toast from 'react-hot-toast';

interface CADSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  projectCode?: string;
  groups: DrawingGroup[];
  items: DrawingItem[];
}

export function CADSheetModal({
  isOpen,
  onClose,
  projectName,
  projectCode,
  groups,
  items,
}: CADSheetModalProps) {
  const [theme, setTheme] = useState<'cad-dark' | 'paper-white'>('cad-dark');
  const [activeColumns, setActiveColumns] = useState<2 | 1>(2);

  if (!isOpen) return null;

  // Filter non-deleted items
  const validItems = items.filter(i => !i.isDeleted);

  // Group items by groupId
  const groupMap = new Map(groups.map(g => [g.id, g]));
  
  // Sorted groups by sortOrder
  const sortedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);
  
  // Also collect unassigned items if any
  const unassignedItems = validItems.filter(i => !i.groupId || !groupMap.has(i.groupId));
  
  // Prepare group blocks with items
  const groupBlocks = sortedGroups.map(grp => ({
    group: grp,
    items: validItems
      .filter(i => i.groupId === grp.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  })).filter(b => b.items.length > 0);

  if (unassignedItems.length > 0) {
    groupBlocks.push({
      group: {
        id: 'unassigned',
        projectId: '',
        groupCode: 'OTH',
        groupName: 'GAMBAR LAIN-LAIN',
        sortOrder: 999,
        createdAt: '',
        updatedAt: ''
      },
      items: unassignedItems.sort((a, b) => a.sortOrder - b.sortOrder)
    });
  }

  // Split groupBlocks into 2 columns (like in AutoCAD Sheet from user image)
  const totalItemCount = groupBlocks.reduce((acc, b) => acc + b.items.length, 0);
  const halfCount = Math.ceil(totalItemCount / 2);

  let leftBlocks: typeof groupBlocks = [];
  let rightBlocks: typeof groupBlocks = [];
  let currentCount = 0;

  groupBlocks.forEach(block => {
    if (currentCount < halfCount || leftBlocks.length === 0) {
      leftBlocks.push(block);
      currentCount += block.items.length;
    } else {
      rightBlocks.push(block);
    }
  });

  const handlePrint = () => {
    try {
      // Check if running inside an iframe (like AI Studio preview sandbox)
      if (window.self !== window.top) {
        toast.error('Fitur Cetak diblokir pada mode Preview ini. Silakan klik ikon "Buka di tab baru" (↗) di pojok kanan atas layar untuk menggunakan fitur Cetak.', {
          duration: 6000,
        });
      } else {
        window.print();
      }
    } catch (e) {
      window.print();
    }
  };

  const handleDownloadPdf = () => {
    exportDrawingListToPDF(projectName, groups, validItems, projectCode);
  };

  const isDark = theme === 'cad-dark';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div 
        className={`w-full max-w-6xl rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden transition-colors duration-300 border ${
          isDark 
            ? 'bg-[#0b0f17] text-white border-cyan-500/40 shadow-cyan-950/50' 
            : 'bg-white text-slate-900 border-slate-300 shadow-slate-400/30'
        }`}
      >
        {/* Top Control Bar (macOS CAD Toolset) */}
        <div 
          className={`flex flex-wrap items-center justify-between px-5 py-3.5 border-b gap-3 ${
            isDark 
              ? 'bg-[#0f1523] border-cyan-500/20' 
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold tracking-wider">
              <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
              AUTOCAD DRAWING SHEET
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide">
                DAFTAR GAMBAR — {projectName.toUpperCase()}
              </h2>
              <span className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
                {totalItemCount} Gambar Kerja Terdaftar • Standar Format CAD & IMB/PBG
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Theme Toggle */}
            <div className={`flex items-center p-0.5 rounded-lg border text-xs ${isDark ? 'bg-[#070b11] border-slate-800' : 'bg-white border-slate-200'}`}>
              <button
                type="button"
                onClick={() => setTheme('cad-dark')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all font-mono text-[11px] ${
                  isDark ? 'bg-cyan-500 text-black font-bold shadow-sm' : 'text-slate-600 hover:text-black'
                }`}
                title="Tampilan AutoCAD Model Space (Dark)"
              >
                <Moon className="w-3 h-3" /> CAD Model
              </button>
              <button
                type="button"
                onClick={() => setTheme('paper-white')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all font-mono text-[11px] ${
                  !isDark ? 'bg-slate-900 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title="Tampilan Kertas Gambar / Paper Space (Light)"
              >
                <Sun className="w-3 h-3" /> Paper Space
              </button>
            </div>

            {/* Layout Column Toggle */}
            <div className={`hidden sm:flex items-center p-0.5 rounded-lg border text-xs ${isDark ? 'bg-[#070b11] border-slate-800' : 'bg-white border-slate-200'}`}>
              <button
                type="button"
                onClick={() => setActiveColumns(2)}
                className={`px-2 py-1 rounded text-[11px] font-mono ${activeColumns === 2 ? (isDark ? 'bg-slate-800 text-cyan-400 font-bold' : 'bg-slate-200 text-black font-bold') : 'text-slate-400'}`}
              >
                2 Kolom
              </button>
              <button
                type="button"
                onClick={() => setActiveColumns(1)}
                className={`px-2 py-1 rounded text-[11px] font-mono ${activeColumns === 1 ? (isDark ? 'bg-slate-800 text-cyan-400 font-bold' : 'bg-slate-200 text-black font-bold') : 'text-slate-400'}`}
              >
                1 Kolom
              </button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadPdf}
              className="text-xs h-8 gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> PDF
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              className="text-xs h-8 gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak
            </Button>

            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-black'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CAD Sheet Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 print:p-0">
          <div 
            className={`w-full mx-auto p-6 sm:p-8 rounded-xl border transition-all ${
              isDark 
                ? 'bg-[#06090e] border-cyan-500/50 shadow-inner' 
                : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            {/* Sheet Title Bar (AutoCAD Header style) */}
            <div className="border-b-2 border-cyan-500 pb-3 mb-5 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
              <div>
                <span className={`text-[11px] font-mono tracking-widest uppercase block ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
                  SISTEM DOKUMEN GAMBAR KERJA & REGISTRASI
                </span>
                <h1 className={`text-xl sm:text-2xl font-black tracking-wider uppercase font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  DAFTAR GAMBAR {projectName}
                </h1>
              </div>
              <div className="text-right font-mono text-[11px]">
                <div className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                  BADAN USAHA: <strong className={isDark ? 'text-cyan-300' : 'text-slate-900'}>PT. ASA PERDANA MANDIRI</strong>
                </div>
                <div className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                  TANGGAL: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                </div>
              </div>
            </div>

            {/* Columns Grid */}
            <div className={`grid gap-6 ${activeColumns === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
              {/* Left Column Blocks */}
              <div className="space-y-6">
                {leftBlocks.map((block, bIdx) => (
                  <CADGroupTable 
                    key={block.group.id} 
                    block={block} 
                    isDark={isDark} 
                    startIndex={leftBlocks.slice(0, bIdx).reduce((acc, b) => acc + b.items.length, 0) + 1}
                  />
                ))}
              </div>

              {/* Right Column Blocks */}
              {activeColumns === 2 && rightBlocks.length > 0 && (
                <div className="space-y-6">
                  {rightBlocks.map((block, bIdx) => (
                    <CADGroupTable 
                      key={block.group.id} 
                      block={block} 
                      isDark={isDark} 
                      startIndex={
                        leftBlocks.reduce((acc, b) => acc + b.items.length, 0) + 
                        rightBlocks.slice(0, bIdx).reduce((acc, b) => acc + b.items.length, 0) + 1
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            {/* AutoCAD Title Block (Kop Gambar) at the bottom */}
            <div 
              className={`mt-8 pt-4 border-t-2 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono ${
                isDark ? 'border-cyan-500/60 bg-[#0c121d] text-slate-300 p-3 rounded-lg' : 'border-slate-400 bg-slate-100 text-slate-800 p-3 rounded-lg'
              }`}
            >
              <div>
                <span className="block text-[11px] font-semibold uppercase opacity-80">LEMBAR GAMBAR</span>
                <strong className={isDark ? 'text-cyan-300' : 'text-slate-900'}>REGISTER GAMBAR KERJA</strong>
              </div>
              <div>
                <span className="block text-[11px] font-semibold uppercase opacity-80">STATUS PROYEK</span>
                <span className={`inline-flex items-center gap-1 font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> FOR EXECUTION
                </span>
              </div>
              <div>
                <span className="block text-[11px] font-semibold uppercase opacity-80">DIGAMBAR (DRAFTER)</span>
                <span className="font-medium">TIM DRAFTER / PIC TERKAIT</span>
              </div>
              <div>
                <span className="block text-[11px] font-semibold uppercase opacity-80">DIPERIKSA & DISETUJUI</span>
                <span className={`font-bold ${isDark ? 'text-cyan-400' : 'text-slate-900'}`}>PROJECT LEADER / OWNER</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CADGroupTable({
  block,
  isDark,
  startIndex
}: {
  block: { group: DrawingGroup; items: DrawingItem[] };
  isDark: boolean;
  startIndex: number;
}) {
  return (
    <div className={`overflow-hidden rounded border font-mono text-xs ${
      isDark ? 'border-cyan-500/30' : 'border-slate-300'
    }`}>
      {/* Category Header Banner (AutoCAD Cyan/Magenta highlight) */}
      <div className={`px-3 py-1.5 font-bold tracking-wider text-[11px] uppercase flex items-center justify-between border-b ${
        isDark 
          ? 'bg-[#131d2e] text-[#ff2a85] border-cyan-500/30' 
          : 'bg-slate-100 text-slate-900 border-slate-300'
      }`}>
        <span className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          {block.group.groupName}
        </span>
        <span className={`text-xs font-semibold ${isDark ? 'text-cyan-400' : 'text-slate-600'}`}>
          {block.items.length} Gambar
        </span>
      </div>

      {/* Table Header */}
      <div className={`grid grid-cols-12 px-2.5 py-2 text-[11px] font-bold uppercase tracking-wider border-b ${
        isDark ? 'bg-[#0a0e16] text-cyan-400 border-cyan-500/20' : 'bg-slate-200 text-slate-800 border-slate-300'
      }`}>
        <div className="col-span-1 text-center">NO</div>
        <div className="col-span-3">NO GAMBAR</div>
        <div className="col-span-5">JUDUL GAMBAR</div>
        <div className="col-span-1 text-center">KET</div>
        <div className="col-span-2 text-center">SKALA</div>
      </div>

      {/* Table Rows */}
      <div className={`divide-y ${isDark ? 'divide-cyan-500/10' : 'divide-slate-200'}`}>
        {block.items.map((item, idx) => {
          // Determine bullet status color (matching AutoCAD green/cyan dot)
          let dotColor = '#10b981'; // Green (Selesai)
          if (item.status === 'Proses') dotColor = '#06b6d4'; // Cyan
          else if (item.status === 'Review') dotColor = '#eab308'; // Yellow
          else if (item.status === 'Revisi') dotColor = '#ef4444'; // Red
          else if (item.status === 'Belum Mulai') dotColor = '#64748b'; // Gray

          return (
            <div
              key={item.id}
              className={`grid grid-cols-12 px-2.5 py-1.5 items-center transition-colors ${
                isDark 
                  ? 'hover:bg-cyan-500/5 text-slate-200' 
                  : 'hover:bg-slate-50 text-slate-900'
              }`}
            >
              {/* NO */}
              <div className="col-span-1 text-center font-mono text-[11px] font-medium opacity-80">
                {startIndex + idx}
              </div>

              {/* NO GAMBAR */}
              <div className={`col-span-3 font-mono font-bold text-[11px] truncate ${
                isDark ? 'text-cyan-300' : 'text-blue-800'
              }`}>
                {item.drawingNumber || '-'}
              </div>

              {/* JUDUL GAMBAR + PIC Drafter subtitle */}
              <div className="col-span-5 pr-1 min-w-0">
                <div className={`font-semibold text-[11px] truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`} title={item.drawingName}>
                  {item.drawingName}
                </div>
                {item.picName && (
                  <div className={`text-[11px] font-medium truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    PIC: {item.picName}
                  </div>
                )}
              </div>

              {/* KET (● circular bullet point matching user Image 1) */}
              <div className="col-span-1 text-center flex items-center justify-center">
                <span 
                  className="w-2.5 h-2.5 rounded-full inline-block shadow-sm" 
                  style={{ backgroundColor: dotColor }}
                  title={`Status: ${item.status} (${item.progress}%)`}
                />
              </div>

              {/* SKALA (Neatly formatted & centered) */}
              <div className={`col-span-2 text-center font-mono text-[11px] font-bold tracking-wide truncate ${
                isDark ? 'text-amber-400/90' : 'text-amber-800'
              }`}>
                {formatScale(item.scale)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
