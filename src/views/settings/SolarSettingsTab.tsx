import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge } from '../../components/ui';
import { 
  Sparkles, Key, CheckCircle2, AlertTriangle, RefreshCw, 
  ExternalLink, ShieldCheck, Eye, EyeOff, Cpu, FileCheck2, Zap
} from 'lucide-react';
import { SolarAiService, SolarConfig } from '../../services/solarAiService';
import toast from 'react-hot-toast';

export const SolarSettingsTab: React.FC = () => {
  const [config, setConfig] = useState<SolarConfig>({
    apiKey: '',
    model: 'solar-pro',
    isConfigured: false,
  });
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    valid?: boolean;
    latencyMs?: number;
    message?: string;
  } | null>(null);

  useEffect(() => {
    SolarAiService.loadConfig().then((cfg) => {
      setConfig(cfg);
      if (cfg.lastTestedAt) {
        setTestResult({
          valid: cfg.lastTestStatus === 'SUCCESS',
          latencyMs: cfg.lastTestLatency,
          message: cfg.lastTestStatus === 'SUCCESS' ? 'Koneksi terverifikasi' : 'Uji koneksi terakhir gagal',
        });
      }
    });
  }, []);

  const handleTestConnection = async () => {
    setIsValidating(true);
    setTestResult(null);
    try {
      const res = await SolarAiService.validateApiKey(undefined, config.model);
      setTestResult(res);
      if (res.valid) {
        toast.success(res.message);
        setConfig((prev) => ({
          ...prev,
          isConfigured: true,
          lastTestedAt: new Date().toISOString(),
          lastTestStatus: 'SUCCESS',
          lastTestLatency: res.latencyMs,
        }));
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      setTestResult({
        valid: false,
        message: err.message || 'Gagal menguji koneksi Upstage Solar',
      });
      toast.error('Gagal menguji koneksi: ' + (err.message || 'Error'));
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await SolarAiService.saveConfig({
        model: config.model,
      });
      setConfig(updated);
      toast.success('Pengaturan model Upstage Solar Pro berhasil disimpan!');
    } catch (err: any) {
      toast.error('Gagal menyimpan pengaturan: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                Integrasi AI Upstage Solar 4 Pro
              </h3>
              <Badge variant={config.isConfigured ? 'success' : 'warning'}>
                {config.isConfigured ? 'Aktif Terhubung' : 'Belum Dikonfigurasi'}
              </Badge>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] max-w-2xl">
              Model canggih dari Upstage untuk audit mendalam gambar arsitektur, deteksi kesalahan perhitungan RAB / PPN 11%, pengecekan kepatuhan dokumen legal (SPK/Penawaran/BAST), serta asisten cerdas proaktif.
            </p>
          </div>

          <a
            href="https://console.upstage.ai/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-amber-600 hover:border-amber-300 transition-colors shrink-0"
          >
            <span>Dapatkan API Key di Upstage Console</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Main Configuration Card */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
          <div>
            <h4 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-500" />
              Status Kredensial Server Upstage Solar
            </h4>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Kunci API disimpan secara aman di environment server (<code className="text-amber-600 dark:text-amber-400">UPSTAGE_API_KEY</code>) untuk mencegah pembajakan dari browser.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                Status Integrasi Server
              </span>
              <Badge variant={config.isConfigured ? 'success' : 'warning'}>
                {config.isConfigured ? 'Kunci Server Terpasang' : 'Kunci Server Belum Diatur'}
              </Badge>
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
              Untuk mengaktifkan atau mengganti API Key, tetapkan variabel <code className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[10px]">UPSTAGE_API_KEY=up_...</code> pada berkas <code className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[10px]">.env</code> server Anda.
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <label className="text-xs font-bold text-[var(--color-text-secondary)] block mb-2">
              Pilihan Model Upstage Solar
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`relative flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  config.model === 'solar-pro'
                    ? 'border-amber-500 bg-amber-500/5 ring-1 ring-amber-500'
                    : 'border-[var(--color-border)] hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <input
                  type="radio"
                  name="solarModel"
                  value="solar-pro"
                  checked={config.model === 'solar-pro'}
                  onChange={() => setConfig({ ...config, model: 'solar-pro' })}
                  className="mt-1 text-amber-600 focus:ring-amber-500"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--color-text-primary)]">Solar 4 Pro (Flagship)</span>
                    <Badge variant="warning">Rekomendasi Utama</Badge>
                  </div>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">
                    Model penalaran terbaik untuk deteksi kesalahan RAB rumit, formula pajak, dan analisis klausul hukum dokumen kontrak.
                  </p>
                </div>
              </label>

              <label
                className={`relative flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  config.model === 'solar-mini'
                    ? 'border-amber-500 bg-amber-500/5 ring-1 ring-amber-500'
                    : 'border-[var(--color-border)] hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <input
                  type="radio"
                  name="solarModel"
                  value="solar-mini"
                  checked={config.model === 'solar-mini'}
                  onChange={() => setConfig({ ...config, model: 'solar-mini' })}
                  className="mt-1 text-amber-600 focus:ring-amber-500"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--color-text-primary)]">Solar Mini</span>
                    <Badge variant="outline">Ekonomis & Cepat</Badge>
                  </div>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">
                    Model ringan dan responsif untuk konsultasi asisten harian dan pengecekan cepat.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Test Status Indicator */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                testResult.valid
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
              }`}
            >
              {testResult.valid ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <p className="font-semibold">{testResult.message}</p>
                {testResult.latencyMs && (
                  <p className="text-[11px] opacity-80">
                    Waktu respon API: <strong>{testResult.latencyMs} ms</strong>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Buttons: Test & Save */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--color-border)]">
            <Button
              type="button"
              variant="secondary"
              onClick={handleTestConnection}
              disabled={isValidating}
              className="gap-2 text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin' : ''}`} />
              {isValidating ? 'Menguji Koneksi...' : 'Uji Koneksi Server Solar AI'}
            </Button>

            <Button
              type="submit"
              disabled={isSaving}
              className="gap-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
            >
              <ShieldCheck className="w-4 h-4" />
              {isSaving ? 'Menyimpan...' : 'Simpan Pilihan Model'}
            </Button>
          </div>
        </form>
      </div>

      {/* Feature Capabilities Spotlight */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
            1. Deteksi Kesalahan Cerdas
          </h4>
          <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
            Mendeteksi anomali perhitungan volume x harga satuan, kesalahan penulisan diskon, formula pajak PPN 11%, serta inkonsistensi nomor lembar gambar CAD.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <FileCheck2 className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
            2. Cek Dokumen & Legalitas
          </h4>
          <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
            Audit kepatuhan klausul SPK, penawaran harga, dan invoice resmi terhadap standar industri konstruksi & hukum komersial Indonesia (IAI & SNI).
          </p>
        </div>

        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Zap className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
            3. AI Assistant Spesialis AEC
          </h4>
          <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
            Asisten cerdas terintegrasi pada shortcut Cmd+K / Ctrl+K yang dapat langsung menjawab dan mengaudit data proyek Anda dengan penalaran Solar 4 Pro.
          </p>
        </div>
      </div>
    </div>
  );
};
