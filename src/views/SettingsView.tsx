import React, { useState } from 'react';
import { useDocument } from '../context/DocumentContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import { auth } from '../lib/firebase';
import { Button, Card, SegmentedControl, Input, Badge, Modal } from '../components/ui';
import { 
  Building, FileText, History, Shield, Download, 
  CheckCircle, AlertTriangle, Plus, Trash2, Key, 
  Lock, RefreshCw, Server, FileCheck, Users, Sun, Moon, Monitor,
  ShieldCheck, ShieldAlert
} from 'lucide-react';
import { CompanySettings, BankAccountInfo, PdfTemplate } from '../types';
import { runExportSecurityTest, ExportSecurityTestResult } from '../security/exportSecurityTest';
import { runDirtyDozenTestSuite, DirtyDozenSuiteSummary } from '../security/dirtyDozenTest';
import { UserPermissionsTab } from './settings/UserPermissionsTab';
import toast from 'react-hot-toast';

export function SettingsView() {
  const { user, appUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { role, isOwner } = usePermissions();
  const { companySettings, pdfTemplates, generatedDocuments, updateCompanySettings, updatePdfTemplate } = useDocument();

  const [activeTab, setActiveTab] = useState('company');
  const isAuthorizedToEdit = role === 'OWNER' || role === 'ADMIN';

  // Company Settings Form State
  const [companyForm, setCompanyForm] = useState<CompanySettings>(companySettings);
  const [isSavingCompany, setIsSavingCompany] = useState(false);

  // Bank account temporary modal/edit state
  const [bankAccounts, setBankAccounts] = useState<BankAccountInfo[]>(companySettings.bankAccounts || []);
  const [newBank, setNewBank] = useState({ bankName: '', accountNumber: '', accountHolder: '' });

  // Source Code Export state
  const [isExportingCode, setIsExportingCode] = useState(false);
  const [securityTestResult, setSecurityTestResult] = useState<ExportSecurityTestResult | null>(null);
  const [isRunningSecurityTest, setIsRunningSecurityTest] = useState(false);

  // Dirty Dozen Security Test Suite state
  const [dirtyDozenResult, setDirtyDozenResult] = useState<DirtyDozenSuiteSummary | null>(null);
  const [isRunningDirtyDozen, setIsRunningDirtyDozen] = useState(false);

  // Sync companyForm if companySettings changes externally
  React.useEffect(() => {
    setCompanyForm(companySettings);
    setBankAccounts(companySettings.bankAccounts || []);
  }, [companySettings]);

  // Handle save company settings
  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorizedToEdit) {
      toast.error('Hanya Owner dan Admin yang memiliki izin menyimpan profil perusahaan');
      return;
    }

    try {
      setIsSavingCompany(true);
      await updateCompanySettings({
        ...companyForm,
        bankAccounts,
      });
      toast.success('Profil Perusahaan & Legalitas berhasil diperbarui');
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan profil perusahaan');
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleAddBank = () => {
    if (!newBank.bankName || !newBank.accountNumber || !newBank.accountHolder) {
      toast.error('Isi semua data rekening bank');
      return;
    }
    const updated = [
      ...bankAccounts,
      {
        id: `bank-${Date.now()}`,
        bankName: newBank.bankName,
        accountNumber: newBank.accountNumber,
        accountHolder: newBank.accountHolder,
        isDefault: bankAccounts.length === 0,
      },
    ];
    setBankAccounts(updated);
    setNewBank({ bankName: '', accountNumber: '', accountHolder: '' });
  };

  const handleDeleteBank = (id: string) => {
    setBankAccounts(bankAccounts.filter((b) => b.id !== id));
  };

  const handleSetDefaultBank = (id: string) => {
    setBankAccounts(
      bankAccounts.map((b) => ({
        ...b,
        isDefault: b.id === id,
      }))
    );
  };

  // Handle Source Code Download
  const handleDownloadSourceCode = async () => {
    if (!isOwner()) {
      toast.error('Akses ditolak: Fitur unduh source code khusus untuk peran OWNER');
      return;
    }

    const toastId = toast.loading('Memvalidasi otorisasi & menyiapkan unduhan source code...');
    try {
      setIsExportingCode(true);

      const currentUser = user || auth.currentUser;
      if (!currentUser) {
        throw new Error('Sesi login tidak ditemukan. Silakan masuk terlebih dahulu.');
      }

      // 1. Force refresh token so it is not expired
      const token = await currentUser.getIdToken(true);
      if (!token) {
        throw new Error('Gagal mendapatkan ID token otentikasi. Silakan refresh halaman.');
      }

      toast.loading('Mengekstrak dan meredaksikan berkas source code...', { id: toastId });

      // 2. Fetch from endpoint with Bearer auth token and dual delivery
      const response = await fetch('/api/export-source-code', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        let serverError = `Gagal mengunduh (HTTP ${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData.error) serverError = errorData.error;
        } catch {
          const txt = await response.text().catch(() => '');
          if (txt) serverError = `${serverError}: ${txt.slice(0, 100)}`;
        }
        throw new Error(serverError);
      }

      // 3. Handle response as BLOB and trigger download with designated filename
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mdrawing-source-export.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      const sizeKb = (blob.size / 1024).toFixed(1);
      toast.success(`Source code berhasil diunduh (${sizeKb} KB, mdrawing-source-export.json)`, { id: toastId });
    } catch (err: any) {
      console.error('Error downloading source code:', err);
      toast.error(err.message || 'Gagal mengunduh source code', { id: toastId });
    } finally {
      setIsExportingCode(false);
    }
  };

  // Handle running security test suite
  const handleRunSecurityAudit = () => {
    setIsRunningSecurityTest(true);
    setTimeout(() => {
      const result = runExportSecurityTest();
      setSecurityTestResult(result);
      setIsRunningSecurityTest(false);
      if (result.success) {
        toast.success(`Audit Keamanan Lolos! ${result.totalTests} pengujian aman terverifikasi.`);
      } else {
        toast.error('Terdapat kegagalan pengujian keamanan redaksi!');
      }
    }, 400);
  };

  // Run Dirty Dozen Security Test Suite
  const handleRunDirtyDozen = async () => {
    setIsRunningDirtyDozen(true);
    try {
      const suiteResult = await runDirtyDozenTestSuite();
      setDirtyDozenResult(suiteResult);
      if (suiteResult.success) {
        toast.success(`Dirty Dozen Lolos 100%! Seluruh 12 skenario keamanan tervalidasi aman.`);
      } else {
        toast.error(`Perhatian: ${suiteResult.failedCount} skenario keamanan memerlukan audit.`);
      }
    } catch (e: any) {
      toast.error('Gagal menjalankan pengujian Dirty Dozen: ' + e.message);
    } finally {
      setIsRunningDirtyDozen(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header & Personal Profile Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              Pengaturan Sistem & Pengguna
            </h1>
            <Badge variant="purple">{appUser?.role || 'VIEWER'}</Badge>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Masuk sebagai <strong>{appUser?.name || appUser?.email}</strong> ({appUser?.email})
          </p>
        </div>

        {/* Theme Preferences: Light / Dark / System */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/70 dark:bg-white/10 border border-[var(--color-border)]">
          <button
            onClick={() => setTheme('light')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              theme === 'light' ? 'bg-white text-blue-700 shadow-xs border border-slate-200' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            Terang
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              theme === 'dark' ? 'bg-slate-800 text-blue-400 shadow-xs border border-slate-700' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Moon className="w-3.5 h-3.5 text-blue-400" />
            Gelap
          </button>
          <button
            onClick={() => setTheme('system')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              theme === 'system' ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-xs border border-slate-200 dark:border-slate-700' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Monitor className="w-3.5 h-3.5 text-slate-500" />
            Sistem
          </button>
        </div>
      </div>

      <SegmentedControl
        options={[
          { label: 'Profil Perusahaan & Legalitas', value: 'company' },
          { label: 'Hak Akses & Pengguna', value: 'permissions' },
          { label: 'Template Dokumen PDF', value: 'templates' },
          { label: 'Riwayat Dokumen Terbit', value: 'history' },
          { label: 'Keamanan & Source Code', value: 'security' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {/* TAB 1: Profil Perusahaan */}
      {activeTab === 'company' && (
        <form onSubmit={handleSaveCompany} className="space-y-6">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  Identitas Usaha & Badan Hukum
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Digunakan pada kop surat, invoice, penawaran harga, dan letterhead resmi.
                </p>
              </div>
              <Badge variant="outline">Legal Entity</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Nama Badan Hukum Resmi *
                </label>
                <Input
                  value={companyForm.companyName}
                  onChange={(e) => setCompanyForm({ ...companyForm, companyName: e.target.value })}
                  disabled={!isAuthorizedToEdit}
                  required
                />
                <span className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 block">
                  Nama legalitas PT untuk faktur & kontrak (PT. Asa Perdana Mandiri).
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Nama Brand Aplikasi / Produk *
                </label>
                <Input
                  value={companyForm.brandName}
                  onChange={(e) => setCompanyForm({ ...companyForm, brandName: e.target.value })}
                  disabled={!isAuthorizedToEdit}
                  required
                />
                <span className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 block">
                  Nama display produk di UI sistem (MDrawing).
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Tagline Perusahaan / Aplikasi
                </label>
                <Input
                  value={companyForm.tagline}
                  onChange={(e) => setCompanyForm({ ...companyForm, tagline: e.target.value })}
                  disabled={!isAuthorizedToEdit}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                  NPWP / Tax Identification Number
                </label>
                <Input
                  value={companyForm.taxId || ''}
                  onChange={(e) => setCompanyForm({ ...companyForm, taxId: e.target.value })}
                  disabled={!isAuthorizedToEdit}
                  placeholder="01.234.567.8-012.000"
                />
              </div>
            </div>

            <div className="border-t border-[var(--color-border)] pt-4">
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                Kontak & Alamat Kantor
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                    Alamat Lengkap
                  </label>
                  <Input
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                    disabled={!isAuthorizedToEdit}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                    Kota & Kode Pos
                  </label>
                  <Input
                    value={`${companyForm.city}, ${companyForm.postalCode}`}
                    onChange={(e) => {
                      const parts = e.target.value.split(',');
                      setCompanyForm({
                        ...companyForm,
                        city: parts[0]?.trim() || '',
                        postalCode: parts[1]?.trim() || '',
                      });
                    }}
                    disabled={!isAuthorizedToEdit}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                    No. Telepon Kantor
                  </label>
                  <Input
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                    disabled={!isAuthorizedToEdit}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                    Email Finance / Resmi
                  </label>
                  <Input
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    disabled={!isAuthorizedToEdit}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                    Website Resmi
                  </label>
                  <Input
                    value={companyForm.website || ''}
                    onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                    disabled={!isAuthorizedToEdit}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--color-border)] pt-4">
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                Penandatangan Dokumen Resmi (Signatory)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                    Nama & Gelar Penandatangan
                  </label>
                  <Input
                    value={companyForm.defaultSignatoryName}
                    onChange={(e) => setCompanyForm({ ...companyForm, defaultSignatoryName: e.target.value })}
                    disabled={!isAuthorizedToEdit}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                    Jabatan Penandatangan
                  </label>
                  <Input
                    value={companyForm.defaultSignatoryTitle}
                    onChange={(e) => setCompanyForm({ ...companyForm, defaultSignatoryTitle: e.target.value })}
                    disabled={!isAuthorizedToEdit}
                  />
                </div>
              </div>
            </div>

            {/* Bank Accounts */}
            <div className="border-t border-[var(--color-border)] pt-4 space-y-3">
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Rekening Bank Resmi Perusahaan
              </h4>
              <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--color-bg)] text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                    <tr>
                      <th className="py-2.5 px-3">Bank</th>
                      <th className="py-2.5 px-3">No. Rekening</th>
                      <th className="py-2.5 px-3">Atas Nama</th>
                      <th className="py-2.5 px-3 text-center">Default</th>
                      {isAuthorizedToEdit && <th className="py-2.5 px-3 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {bankAccounts.map((b) => (
                      <tr key={b.id}>
                        <td className="py-2.5 px-3 font-semibold text-[var(--color-text-primary)]">{b.bankName}</td>
                        <td className="py-2.5 px-3 font-mono">{b.accountNumber}</td>
                        <td className="py-2.5 px-3">{b.accountHolder}</td>
                        <td className="py-2.5 px-3 text-center">
                          {b.isDefault ? (
                            <Badge variant="success">Utama</Badge>
                          ) : (
                            isAuthorizedToEdit && (
                              <button
                                type="button"
                                onClick={() => handleSetDefaultBank(b.id)}
                                className="text-blue-500 hover:underline"
                              >
                                Jadikan Utama
                              </button>
                            )
                          )}
                        </td>
                        {isAuthorizedToEdit && (
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteBank(b.id)}
                              className="text-red-500 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {isAuthorizedToEdit && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
                  <Input
                    placeholder="Nama Bank (mis. BCA)"
                    value={newBank.bankName}
                    onChange={(e) => setNewBank({ ...newBank, bankName: e.target.value })}
                    className="text-xs"
                  />
                  <Input
                    placeholder="Nomor Rekening"
                    value={newBank.accountNumber}
                    onChange={(e) => setNewBank({ ...newBank, accountNumber: e.target.value })}
                    className="text-xs"
                  />
                  <Input
                    placeholder="Atas Nama"
                    value={newBank.accountHolder}
                    onChange={(e) => setNewBank({ ...newBank, accountHolder: e.target.value })}
                    className="text-xs"
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={handleAddBank}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Tambah Bank
                  </Button>
                </div>
              )}
            </div>

            {/* Terms */}
            <div className="border-t border-[var(--color-border)] pt-4 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Syarat & Ketentuan Standar Dokumen
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                    Syarat & Ketentuan Faktur (Invoice Terms)
                  </label>
                  <textarea
                    rows={4}
                    value={companyForm.invoiceTerms}
                    onChange={(e) => setCompanyForm({ ...companyForm, invoiceTerms: e.target.value })}
                    disabled={!isAuthorizedToEdit}
                    className="w-full p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-xs font-mono leading-relaxed"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                    Syarat & Ketentuan Penawaran (Quotation Terms)
                  </label>
                  <textarea
                    rows={4}
                    value={companyForm.quotationTerms}
                    onChange={(e) => setCompanyForm({ ...companyForm, quotationTerms: e.target.value })}
                    disabled={!isAuthorizedToEdit}
                    className="w-full p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-xs font-mono leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {isAuthorizedToEdit && (
              <div className="flex justify-end pt-4 border-t border-[var(--color-border)]">
                <Button type="submit" disabled={isSavingCompany}>
                  {isSavingCompany ? 'Menyimpan...' : 'Simpan Profil Perusahaan'}
                </Button>
              </div>
            )}
          </div>
        </form>
      )}

      {/* TAB 2: Hak Akses & Pengguna (User Permissions) */}
      {activeTab === 'permissions' && (
        <UserPermissionsTab />
      )}

      {/* TAB 3: Template Dokumen PDF */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4">
            <div className="border-b border-[var(--color-border)] pb-4">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                Kustomisasi Format & Template Dokumen PDF
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Atur judul dokumen, header, syarat ketentuan, dan aksen visual untuk setiap jenis dokumen resmi.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pdfTemplates.map((tpl) => (
                <div key={tpl.id} className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-[var(--color-text-primary)]">{tpl.name}</span>
                    <Badge variant="outline">{tpl.templateType}</Badge>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[var(--color-text-secondary)] block">Judul Header:</span>
                      <strong className="text-[var(--color-text-primary)]">{tpl.headerTitle}</strong>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-secondary)] block">Sub Header:</span>
                      <span className="text-[var(--color-text-primary)]">{tpl.subHeader}</span>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-secondary)] block">Catatan Kaki (Footer):</span>
                      <span className="text-[var(--color-text-secondary)]">{tpl.footerNote}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-xs">
                    <span className="text-[var(--color-text-secondary)]">
                      Kop Surat: {tpl.showLetterhead ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{tpl.primaryColor}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Riwayat Dokumen Terbit */}
      {activeTab === 'history' && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4">
          <div className="border-b border-[var(--color-border)] pb-4">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              Riwayat Dokumen yang Diterbitkan (Generated Documents Log)
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Daftar seluruh dokumen resmi yang telah diekspor atau dicetak melalui sistem MDrawing.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] font-semibold text-xs border-b border-[var(--color-border)]">
                <tr>
                  <th className="py-3 px-4">No. Dokumen</th>
                  <th className="py-3 px-4">Judul & Tipe</th>
                  <th className="py-3 px-4">Proyek</th>
                  <th className="py-3 px-4 text-center">Format</th>
                  <th className="py-3 px-4">Diterbitkan Oleh</th>
                  <th className="py-3 px-4">Waktu Terbit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {generatedDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[var(--color-text-secondary)]">
                      Belum ada riwayat dokumen yang diterbitkan.
                    </td>
                  </tr>
                ) : (
                  generatedDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[var(--color-text-primary)]">
                        {doc.documentNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[var(--color-text-primary)]">{doc.title}</div>
                        <span className="text-xs text-[var(--color-text-secondary)]">{doc.documentType}</span>
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--color-text-secondary)]">
                        {doc.projectName}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline">{doc.fileFormat}</Badge>
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--color-text-secondary)]">
                        {doc.createdByName}
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--color-text-secondary)]">
                        {new Date(doc.createdAt).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Keamanan, Audit & Unduh Source Code */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Owner Source Code Download Card */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                    Ekspor & Unduh Source Code Aplikasi
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Paket lengkap berkas source code proyek MDrawing dalam format JSON dengan proteksi redaksi credential otomatis.
                  </p>
                </div>
              </div>

              {isOwner() ? (
                <Button
                  onClick={handleDownloadSourceCode}
                  disabled={isExportingCode}
                  className="shrink-0"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  {isExportingCode ? 'Mengekspor & Meredaksikan...' : 'Unduh Source Code (JSON)'}
                </Button>
              ) : (
                <Badge variant="warning">Owner Only</Badge>
              )}
            </div>

            {/* Redaction Guarantee Banner */}
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                <Lock className="w-4 h-4" />
                Jaminan Keamanan & Redaksi Rahasia (Security Guarantee)
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Source code yang diekspor telah diproteksi secara otomatis oleh mesin redaksi server.
                Seluruh kredensial sensitif seperti Firebase API Keys, token rahasia, kunci privat,
                dan string koneksi telah disamarkan (`[REDACTED_...]`) sehingga aman untuk diarsipkan,
                diberikan ke auditor, atau disimpan secara offline tanpa risiko kebocoran data.
              </p>
            </div>
          </div>

          {/* THE DIRTY DOZEN - Master Security Test Suite (12 Skenario Master Prompt) */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                      Security Test Suite: "The Dirty Dozen"
                    </h3>
                    <Badge variant="purple">12 Skenario Master Prompt</Badge>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Audit komprehensif menguji 12 skenario keamanan Firestore Rules, anti-eskalasi peran, field-level restrictions, dan perlindungan endpoint server.
                  </p>
                </div>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleRunDirtyDozen}
                disabled={isRunningDirtyDozen}
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRunningDirtyDozen ? 'animate-spin' : ''}`} />
                {isRunningDirtyDozen ? 'Menguji Skenario Keamanan...' : 'Jalankan Dirty Dozen Suite'}
              </Button>
            </div>

            {dirtyDozenResult ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <div>
                      <span className="text-xs font-semibold text-[var(--color-text-primary)] block">
                        Hasil Uji Keamanan Dirty Dozen: {dirtyDozenResult.passedCount} dari {dirtyDozenResult.totalTests} Skenario Lolos (PASSED)
                      </span>
                      <span className="text-[11px] text-[var(--color-text-secondary)]">
                        Dijalankan pada {new Date(dirtyDozenResult.executedAt).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                  <Badge variant={dirtyDozenResult.success ? 'success' : 'danger'}>
                    {dirtyDozenResult.success ? '100% SECURE' : `${dirtyDozenResult.failedCount} GAGAL`}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dirtyDozenResult.results.map((scen) => (
                    <div
                      key={scen.id}
                      className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{scen.code}</span>
                          <span className="text-xs font-semibold text-[var(--color-text-primary)] line-clamp-1">{scen.name}</span>
                        </div>
                        <Badge variant={scen.status === 'PASSED' ? 'success' : 'danger'}>
                          {scen.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-2">
                        {scen.description}
                      </p>
                      <div className="pt-1.5 border-t border-[var(--color-border)]/50 flex items-center justify-between text-[11px] text-[var(--color-text-secondary)]">
                        <span>Konteks: <strong>{scen.roleContext}</strong></span>
                        <span>Hasil: <strong className={scen.actualResult === 'DENIED' ? 'text-amber-500' : 'text-emerald-500'}>{scen.actualResult}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-secondary)] italic">
                Klik tombol "Jalankan Dirty Dozen Suite" untuk memverifikasi seluruh skenario keamanan Firestore Rules & Server.
              </p>
            )}
          </div>

          {/* Interactive Security Test Suite Verification */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  Verifikasi Audit Mesin Redaksi Keamanan
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Jalankan uji validasi unit test untuk memverifikasi kehandalan deteksi pola kredensial sensitif.
                </p>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleRunSecurityAudit}
                disabled={isRunningSecurityTest}
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRunningSecurityTest ? 'animate-spin' : ''}`} />
                Jalankan Audit Keamanan
              </Button>
            </div>

            {securityTestResult ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-emerald-500" />
                    <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                      Hasil Pengujian: {securityTestResult.passed} dari {securityTestResult.totalTests} pengujian lolos
                    </span>
                  </div>
                  <Badge variant={securityTestResult.success ? 'success' : 'danger'}>
                    {securityTestResult.success ? 'PASSED 100%' : 'FAILED'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {securityTestResult.details.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-[var(--color-border)] text-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="text-[var(--color-text-primary)]">{item.test}</span>
                      </div>
                      <Badge variant="outline">{item.pattern}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-secondary)] italic">
                Klik tombol "Jalankan Audit Keamanan" untuk menguji mesin redaksi kredensial secara live.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
