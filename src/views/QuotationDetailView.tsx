import { setDoc,addDoc,updateDoc,deleteDoc } from '../lib/quotationWrites';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, onSnapshot, orderBy} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Quotation, Client, QuotationItem, QuotationHistoryEvent } from '../types';
import { Button, Card, Input, Badge, Modal, ConfirmModal } from '../components/ui';
import { 
  ArrowLeft, Save, FileText, CheckCircle2, ArrowRight, Eye, 
  Download, Send, Edit, Plus, Trash2, History, AlertCircle, ChevronDown, ChevronUp,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { buildQuotationPdf } from '../lib/pdfGenerator';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { usePermissions } from '../hooks/usePermissions';

export function QuotationDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const { canViewFinance, canDeleteQuotation, canEditFinance } = usePermissions();
  
  const [quotation, setQuotation] = useState<Partial<Quotation>>({
    status: 'DRAFT',
    revisionNumber: 0,
    items: [],
    subTotal: 0,
    taxPercentage: 11,
    tax: 0,
    discount: 0,
    grandTotal: 0,
    dpPercentage: 30,
    dpAmount: 0
  });
  
  const [clients, setClients] = useState<Client[]>([]);
  const [clientObj, setClientObj] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string>('scope');
  const [showClientModal, setShowClientModal] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [newClientData, setNewClientData] = useState<Partial<Client>>({ companyName: '', email: '', phone: '', address: '' });

  const handleSaveClient = async () => {
    if (!newClientData.companyName?.trim()) {
      toast.error('Nama Perusahaan/Klien wajib diisi');
      return;
    }
    setIsSavingClient(true);
    try {
      const clientId = uuidv4();
      const now = new Date().toISOString();
      await setDoc(doc(db, 'clients', clientId), {
        ...newClientData,
        id: clientId,
        createdAt: now,
        updatedAt: now
      });
      // Select it automatically
      setQuotation(prev => ({ ...prev, clientId }));
      setShowClientModal(false);
      setNewClientData({ companyName: '', email: '', phone: '', address: '' });
      toast.success('Klien baru berhasil ditambahkan');
    } catch (e: any) {
      toast.error('Gagal menambah klien: ' + e.message);
    } finally {
      setIsSavingClient(false);
    }
  };

  useEffect(() => {
    const qClients = query(collection(db, 'clients'), orderBy('companyName'));
    const unsub = onSnapshot(qClients, snap => {
      setClients(snap.docs.map(d => d.data() as Client));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (id && id !== 'new') {
      getDoc(doc(db, 'quotations', id)).then(snap => {
        if (snap.exists()) {
          const qData = snap.data() as Quotation;
          setQuotation(qData);
          if (qData.clientId) {
            getDoc(doc(db, 'clients', qData.clientId)).then(cSnap => {
              if (cSnap.exists()) setClientObj(cSnap.data() as Client);
            });
          }
        } else {
          toast.error("Penawaran tidak ditemukan");
          navigate('/pipeline');
        }
        setLoading(false);
      });
    } else {
      setQuotation(prev => ({
        ...prev,
        quotationNumber: `QUO-${new Date().getFullYear()}-${Math.floor(Math.random()*1000).toString().padStart(3, '0')}`,
        date: new Date().toISOString().split('T')[0],
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: [
          { id: uuidv4(), description: 'Jasa Desain Arsitektur', quantity: 1, unit: 'Paket', unitPrice: 0, totalPrice: 0 }
        ]
      }));
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (quotation.clientId && clients.length > 0) {
      const c = clients.find(cl => cl.id === quotation.clientId);
      if (c) setClientObj(c);
    }
  }, [quotation.clientId, clients]);

  // Recalculate totals
  useEffect(() => {
    if (quotation.items) {
      let itemsChanged = false;
      const newItems = quotation.items.map(item => {
        let expectedTotal = (item.quantity || 0) * (item.unitPrice || 0);
        if (Number.isNaN(expectedTotal)) expectedTotal = 0;
        
        if (item.totalPrice !== expectedTotal && !(Number.isNaN(item.totalPrice) && Number.isNaN(expectedTotal))) {
          itemsChanged = true;
          return { ...item, totalPrice: expectedTotal };
        }
        return item;
      });

      let subTotal = newItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
      if (Number.isNaN(subTotal)) subTotal = 0;
      
      const discount = quotation.discount || 0;
      let taxAmount = ((subTotal - discount) * (quotation.taxPercentage || 0)) / 100;
      if (Number.isNaN(taxAmount)) taxAmount = 0;
      
      let grandTotal = subTotal - discount + taxAmount;
      if (Number.isNaN(grandTotal)) grandTotal = 0;
      
      let dpAmount = (grandTotal * (quotation.dpPercentage || 0)) / 100;
      if (Number.isNaN(dpAmount)) dpAmount = 0;

      if (
        itemsChanged ||
        quotation.subTotal !== subTotal ||
        quotation.tax !== taxAmount ||
        quotation.grandTotal !== grandTotal ||
        quotation.dpAmount !== dpAmount
      ) {
        setQuotation(prev => ({
          ...prev,
          subTotal,
          tax: taxAmount,
          grandTotal,
          dpAmount,
          ...(itemsChanged ? { items: newItems } : {})
        }));
      }
    }
  }, [
    quotation.items, 
    quotation.discount, 
    quotation.taxPercentage, 
    quotation.dpPercentage,
    quotation.subTotal,
    quotation.tax,
    quotation.grandTotal,
    quotation.dpAmount
  ]);

  const recordHistory = async (docId: string, eventType: QuotationHistoryEvent['eventType'], qData: any, note?: string) => {
    const rawHistoryEvent: QuotationHistoryEvent = {
      id: uuidv4(),
      eventType,
      timestamp: new Date().toISOString(),
      userId: appUser?.uid || '',
      userName: appUser?.name || 'System',
      note,
      revisionNumber: qData.revisionNumber,
      snapshotTotal: qData.grandTotal
    };

    const historyEvent = JSON.parse(JSON.stringify(rawHistoryEvent));

    const newHistory = [...(qData.history || []), historyEvent];
    await updateDoc(doc(db, 'quotations', docId), { history: newHistory });
    setQuotation(prev => ({ ...prev, history: newHistory }));
  };

  const handleSave = async (silent = false) => {
    if (!quotation.clientId && quotation.status !== 'DRAFT') {
      toast.error('Pilih klien terlebih dahulu untuk menyimpan penawaran ini');
      return;
    }
    setIsSaving(true);
    try {
      const isNew = id === 'new';
      const now = new Date().toISOString();
      const rawQuoData = {
        ...quotation,
        updatedAt: now,
      };

      // Firestore rejects 'undefined' values, so we safely strip them out
      const quoData = JSON.parse(JSON.stringify(rawQuoData));

      if (isNew) {
        quoData.createdAt = now;
        quoData.createdBy = appUser?.uid || '';
        const docRef = await addDoc(collection(db, 'quotations'), quoData);
        await updateDoc(docRef, { id: docRef.id });
        await recordHistory(docRef.id, 'CREATED', quoData);
        if (!silent) toast.success('Penawaran berhasil dibuat');
        navigate(`/quotations/${docRef.id}`, { replace: true });
      } else {
        await updateDoc(doc(db, 'quotations', id!), quoData);
        if (!silent) toast.success('Penawaran berhasil diperbarui');
      }
    } catch (e: any) {
      console.error("Save error:", e);
      if (!silent) toast.error('Gagal menyimpan penawaran: ' + (e?.message || e));
    } finally {
      setIsSaving(false);
    }
  };

  const updateStatus = async (newStatus: Quotation['status'], eventType: QuotationHistoryEvent['eventType'], note?: string) => {
    if (!id || id === 'new') return;
    if (!quotation.clientId) {
      toast.error('Pilih klien terlebih dahulu untuk mengubah status penawaran');
      return;
    }
    try {
      // Must save current state first
      await handleSave(true);
      
      const updates: any = { 
        status: newStatus,
        updatedAt: new Date().toISOString()
      };

      if (newStatus === 'AGREED') {
        updates.agreedAt = new Date().toISOString();
        updates.agreedBy = appUser?.uid || 'system';
      }

      await updateDoc(doc(db, 'quotations', id), updates);
      setQuotation(prev => ({ ...prev, ...updates }));
      await recordHistory(id, eventType, quotation, note);
      
      toast.success(`Status diubah menjadi ${newStatus}`);
    } catch (e) {
      toast.error('Gagal mengubah status');
    }
  };

  const handleCreateRevision = async () => {
    if (!id || id === 'new') return;
    try {
      const reason = window.prompt("Alasan revisi:");
      if (reason === null) return;
      
      await handleSave(true); // Save current state
      
      const newRevisionNumber = (quotation.revisionNumber || 0) + 1;
      const now = new Date().toISOString();

      // 1. Mark current as REVISED
      await updateDoc(doc(db, 'quotations', id), {
        status: 'REVISED',
        updatedAt: now
      });
      await recordHistory(id, 'REVISED', quotation, `Direvisi ke Rev.${newRevisionNumber.toString().padStart(2, '0')}: ${reason}`);

      // 2. Create new document for new revision
      const rawNewQuoData = {
        ...quotation,
        revisionNumber: newRevisionNumber,
        status: 'DRAFT', // New revision starts as DRAFT or NEGOTIATION
        changeReason: reason,
        previousTotal: quotation.grandTotal,
        history: [], // Reset history for new document or carry over? Let's carry over for audit trail
        createdAt: now,
        updatedAt: now,
      };
      
      const newQuoData = JSON.parse(JSON.stringify(rawNewQuoData));
      
      // We don't want to copy the old ID
      delete newQuoData.id;

      const docRef = await addDoc(collection(db, 'quotations'), newQuoData);
      await updateDoc(docRef, { id: docRef.id });
      
      // Record creation of this revision
      const rawHistoryEvent: QuotationHistoryEvent = {
        id: uuidv4(),
        eventType: 'CREATED',
        timestamp: now,
        userId: appUser?.uid || '',
        userName: appUser?.name || 'System',
        note: `Dibuat dari Rev.${quotation.revisionNumber}: ${reason}`,
        revisionNumber: newRevisionNumber,
        snapshotTotal: newQuoData.grandTotal
      };
      
      const historyEvent = JSON.parse(JSON.stringify(rawHistoryEvent));
      
      const newHistory = [...(quotation.history || []), historyEvent];
      await updateDoc(docRef, { history: newHistory });

      toast.success(`Revisi baru dibuat: Rev.${newRevisionNumber.toString().padStart(2, '0')}`);
      navigate(`/quotations/${docRef.id}`, { replace: true });
    } catch (e) {
      toast.error('Gagal membuat revisi');
    }
  };

  const getPdfErrorMessage = (error: any) => {
    const msg = error?.message || '';
    if (msg.includes('autoTable')) return "Mesin PDF penawaran belum siap. Silakan coba lagi.";
    if (msg.includes('DATA_PENAWARAN_TIDAK_LENGKAP')) return "Data penawaran belum lengkap.";
    if (msg.includes('DATA_KLIEN_TIDAK_LENGKAP')) return "Data klien belum lengkap.";
    return "PDF penawaran gagal dibuat.";
  };

  const handlePreviewPDF = async () => {
    try {
      const pdf = buildQuotationPdf(quotation as Quotation, clientObj as Client, { preview: true });
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      const newWindow = window.open(url, '_blank');
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        toast.error("Preview PDF diblokir browser. Izinkan popup untuk membuka preview.");
      }
    } catch (e) {
      console.error('[QUOTATION_PDF_ERROR]', {
        quotationId: id,
        quotationNumber: quotation.quotationNumber,
        revisionNumber: quotation.revisionNumber,
        error: e
      });
      toast.error(getPdfErrorMessage(e));
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const pdf = buildQuotationPdf(quotation as Quotation, clientObj as Client, { preview: false });
      pdf.save(`${quotation.quotationNumber}_Rev${(quotation.revisionNumber || 0).toString().padStart(2, '0')}.pdf`);
    } catch (e) {
      console.error('[QUOTATION_PDF_ERROR]', {
        quotationId: id,
        quotationNumber: quotation.quotationNumber,
        revisionNumber: quotation.revisionNumber,
        error: e
      });
      toast.error(getPdfErrorMessage(e));
    }
  };

  const convertToProject = () => {
    if (quotation.status !== 'AGREED') {
      toast.error('Penawaran belum disepakati.');
      return;
    }
    navigate(`/projects/new?quoId=${quotation.id}`);
  };

  const handleCreateDownPaymentInvoice = () => {
    if (quotation.projectId) {
      navigate(`/projects/${quotation.projectId}?tab=finance&subTab=invoices`);
    } else {
      toast("Silakan selesaikan setup proyek terlebih dahulu agar nomor penagihan DP terintegrasi ke proyek.", { icon: "ℹ️" });
      convertToProject();
    }
  };

  const handleDeleteQuotation = async () => {
    if (!id || id === 'new') return;
    if (!canDeleteQuotation(quotation as any)) {
      toast.error('Akses ditolak: Anda tidak memiliki wewenang untuk menghapus penawaran ini.');
      setIsDeleteModalOpen(false);
      return;
    }
    try {
      await deleteDoc(doc(db, 'quotations', id));
      toast.success('Penawaran berhasil dihapus');
      navigate('/pipeline');
    } catch (e: any) {
      toast.error('Gagal menghapus penawaran: ' + (e.message || e));
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Memuat penawaran...</div>;

  const isAgreed = quotation.status === 'AGREED';
  const isReadOnly = isAgreed || quotation.status === 'REJECTED' || quotation.status === 'EXPIRED';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AGREED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'NEGOTIATION': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'REVISED': return 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200';
      case 'DRAFT': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'SENT': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'REJECTED':
      case 'EXPIRED': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const hasFinanceCapability = canViewFinance();

  return (
    <div className="max-w-5xl mx-auto pb-10">
      {!hasFinanceCapability && (
        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-3 text-amber-800 dark:text-amber-200 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Akses Terbatas: Akun Anda tidak memiliki hak akses finansial (canViewFinance). Rincian nilai dan harga penawaran disembunyikan.</span>
        </div>
      )}

      {/* STICKY HEADER */}
      <div className="sticky top-0 z-10 bg-[var(--color-surface)]/85 backdrop-blur-md border-b border-[var(--color-border)] pb-4 pt-4 mb-6 -mx-4 px-4 sm:-mx-6 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/pipeline')} className="px-2 shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Workspace Penawaran</h1>
                {quotation.status && <Badge className={getStatusColor(quotation.status)}>{quotation.status}</Badge>}
              </div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {quotation.quotationNumber} • Rev.{quotation.revisionNumber?.toString().padStart(2, '0')}
              </p>
            </div>
          </div>
          
          {/* Action Bar */}
        <div className="flex flex-wrap gap-2">
          {id !== 'new' && quotation.status === 'DRAFT' && !isReadOnly && canDeleteQuotation(quotation as any) && (
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(true)} className="gap-2 text-red-600 bg-red-50 hover:bg-red-100 border-red-200">
              <Trash2 className="w-4 h-4" /> Hapus
            </Button>
          )}

          {!isReadOnly && (
            <Button variant="secondary" onClick={() => handleSave()} disabled={isSaving} className="gap-2">
              <Save className="w-4 h-4" /> Simpan Draft
            </Button>
          )}
          
          <Button variant="secondary" onClick={handlePreviewPDF} className="gap-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200">
            <Eye className="w-4 h-4" /> Pratinjau Surat
          </Button>

          {id !== 'new' && (
            <Button 
              variant="secondary" 
              onClick={() => navigate(`/solar-audit?tab=errors&quoId=${id}`)}
              className="gap-2 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 border-amber-300"
              title="Audit kesalahan formula, pajak PPN 11%, dan kepatuhan dokumen via Upstage Solar 4 Pro"
            >
              <Sparkles className="w-4 h-4 text-amber-500" /> Cek Dokumen & Error (Solar AI)
            </Button>
          )}
          
          <Button variant="secondary" onClick={handleDownloadPDF} className="gap-2">
            <Download className="w-4 h-4" /> Download PDF
          </Button>

          {quotation.status === 'DRAFT' && id !== 'new' && (
            <Button onClick={() => updateStatus('SENT', 'SENT')} className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Send className="w-4 h-4" /> Kirim ke Owner
            </Button>
          )}

          {(quotation.status === 'SENT' || quotation.status === 'NEGOTIATION' || quotation.status === 'REVISED') && (
            <>
              {quotation.status !== 'NEGOTIATION' && (
                <Button variant="secondary" onClick={() => updateStatus('NEGOTIATION', 'NEGOTIATION_STARTED')} className="gap-2 text-amber-600 border-amber-200 hover:bg-amber-50">
                  <AlertCircle className="w-4 h-4" /> Mulai Negosiasi
                </Button>
              )}
              <Button variant="secondary" onClick={handleCreateRevision} className="gap-2 text-fuchsia-600 border-fuchsia-200 hover:bg-fuchsia-50">
                <Edit className="w-4 h-4" /> Buat Revisi (Rev.{((quotation.revisionNumber || 0) + 1).toString().padStart(2, '0')})
              </Button>
              <Button onClick={() => updateStatus('AGREED', 'AGREED')} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle2 className="w-4 h-4" /> Tandai Disepakati
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-6">
      {isAgreed && !quotation.projectId && (
        <Card className="p-6 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-emerald-800 dark:text-emerald-400 mb-1 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Penawaran Telah Disepakati
            </h3>
            <p className="text-sm text-emerald-700 dark:text-emerald-500">
              Commercial baseline telah dikunci. Anda siap menagih Uang Muka atau memulai proyek.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleCreateDownPaymentInvoice}
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-100 shrink-0 cursor-pointer"
            >
              Buat Invoice DP
            </Button>
            <Button onClick={convertToProject} className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-sm">
              Mulai Setup Proyek <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {quotation.projectId && (
        <Card className="p-6 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 shadow-sm">
          <h3 className="font-bold text-indigo-800 dark:text-indigo-400 mb-1">Terhubung dengan Proyek</h3>
          <p className="text-sm text-indigo-700 dark:text-indigo-500 mb-4">
            Penawaran ini merupakan commercial baseline untuk proyek operasional yang sedang berjalan.
          </p>
          <Button onClick={() => navigate(`/projects/${quotation.projectId}`)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            Buka Workspace Proyek
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* SECTION 1 & 2: INFO & CLIENT */}
          <Card className="p-6">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">1. Informasi Penawaran & Klien</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nomor Penawaran</label>
                <Input value={quotation.quotationNumber || ''} readOnly disabled className="bg-slate-50 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Tanggal</label>
                <Input type="date" value={quotation.date || ''} onChange={e => setQuotation({...quotation, date: e.target.value})} disabled={isReadOnly} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Berlaku Sampai</label>
                <Input type="date" value={quotation.validUntil || ''} onChange={e => setQuotation({...quotation, validUntil: e.target.value})} disabled={isReadOnly} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Klien</label>
                <div className="flex gap-2">
                  <select 
                    className="flex-1 h-10 px-3 border rounded-xl bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-hidden focus:ring-2 focus:ring-[var(--color-accent-blue)] disabled:opacity-50"
                    value={quotation.clientId || ''}
                    onChange={e => setQuotation({...quotation, clientId: e.target.value})}
                    disabled={isReadOnly}
                  >
                    <option value="">-- Pilih Klien --</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.companyName || c.clientName}</option>)}
                  </select>
                  {!isReadOnly && (
                    <Button 
                      variant="secondary" 
                      onClick={() => setShowClientModal(true)} 
                      className="px-3 shrink-0"
                      title="Tambah Klien Baru"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Pekerjaan</label>
                <Input 
                  value={quotation.projectName || ''} 
                  onChange={e => setQuotation({...quotation, projectName: e.target.value})}
                  disabled={isReadOnly}
                  placeholder="Misal: Desain Ruko"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Lokasi Proyek</label>
                <Input 
                  value={quotation.location || ''} 
                  onChange={e => setQuotation({...quotation, location: e.target.value})}
                  disabled={isReadOnly}
                  placeholder="Misal: Jakarta Selatan"
                />
              </div>
            </div>
          </Card>

          {/* SECTION 4: RINCIAN PEKERJAAN */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">2. Rincian Pekerjaan (Bill of Quantities)</h2>
              {!isReadOnly && (
                <Button size="sm" variant="secondary" onClick={() => {
                  setQuotation(prev => ({
                    ...prev,
                    items: [...(prev.items || []), { id: uuidv4(), description: '', quantity: 1, unit: 'Ls', unitPrice: 0, totalPrice: 0 }]
                  }))
                }} className="h-8 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Tambah Item
                </Button>
              )}
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold w-12">No</th>
                    <th className="px-3 py-2 font-semibold">Uraian</th>
                    <th className="px-3 py-2 font-semibold w-24">Qty</th>
                    <th className="px-3 py-2 font-semibold w-24">Satuan</th>
                    <th className="px-3 py-2 font-semibold w-36 text-right">Harga Satuan</th>
                    <th className="px-3 py-2 font-semibold w-36 text-right">Jumlah</th>
                    {!isReadOnly && <th className="px-3 py-2 font-semibold w-12"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {quotation.items?.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-2">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <Input 
                          value={item.description}
                          onChange={e => {
                            const newItems = [...(quotation.items || [])];
                            newItems[idx].description = e.target.value;
                            setQuotation({...quotation, items: newItems});
                          }}
                          disabled={isReadOnly}
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input 
                          type="number"
                          value={item.quantity}
                          onChange={e => {
                            const newItems = [...(quotation.items || [])];
                            newItems[idx].quantity = Number(e.target.value);
                            setQuotation({...quotation, items: newItems});
                          }}
                          disabled={isReadOnly}
                          className="h-8 text-sm text-center"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input 
                          value={item.unit}
                          onChange={e => {
                            const newItems = [...(quotation.items || [])];
                            newItems[idx].unit = e.target.value;
                            setQuotation({...quotation, items: newItems});
                          }}
                          disabled={isReadOnly}
                          className="h-8 text-sm text-center"
                        />
                      </td>
                      <td className="px-3 py-2">
                        {hasFinanceCapability ? (
                          <Input 
                            type="number"
                            value={item.unitPrice}
                            onChange={e => {
                              const newItems = [...(quotation.items || [])];
                              newItems[idx].unitPrice = Number(e.target.value);
                              setQuotation({...quotation, items: newItems});
                            }}
                            disabled={isReadOnly}
                            className="h-8 text-sm text-right"
                          />
                        ) : (
                          <div className="h-8 flex items-center justify-end text-sm text-slate-400 font-mono">
                            ••••••
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-300">
                        {hasFinanceCapability ? `Rp ${item.totalPrice.toLocaleString('id-ID')}` : 'Rp ••••••'}
                      </td>
                      {!isReadOnly && (
                        <td className="px-3 py-2 text-center">
                          <button 
                            onClick={() => {
                              const newItems = quotation.items?.filter((_, i) => i !== idx);
                              setQuotation({...quotation, items: newItems});
                            }}
                            className="text-slate-400 hover:text-rose-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {(!quotation.items || quotation.items.length === 0) && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                        Belum ada rincian pekerjaan
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 flex flex-col items-end gap-2 text-sm border-t pt-4">
              <div className="flex justify-between w-64 text-slate-500">
                <span>Subtotal:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {hasFinanceCapability ? `Rp ${quotation.subTotal?.toLocaleString('id-ID')}` : 'Rp ••••••'}
                </span>
              </div>
              <div className="flex justify-between w-64 items-center">
                <span className="text-slate-500">Diskon:</span>
                <div className="flex items-center gap-1">
                  <span>Rp</span>
                  {hasFinanceCapability ? (
                    <Input 
                      type="number" 
                      className="w-24 h-7 text-right text-sm" 
                      value={quotation.discount} 
                      onChange={e => setQuotation({...quotation, discount: Number(e.target.value)})}
                      disabled={isReadOnly}
                    />
                  ) : (
                    <span className="font-mono text-slate-400">••••••</span>
                  )}
                </div>
              </div>
              <div className="flex justify-between w-64 items-center">
                <span className="text-slate-500">PPN (%):</span>
                <select 
                   className="w-24 h-7 px-2 border rounded text-right text-sm bg-transparent"
                   value={quotation.taxPercentage}
                   onChange={e => setQuotation({...quotation, taxPercentage: Number(e.target.value)})}
                   disabled={isReadOnly || !hasFinanceCapability}
                >
                  <option value={0}>0% (Non-PPN)</option>
                  <option value={11}>11%</option>
                  <option value={12}>12%</option>
                </select>
              </div>
              <div className="flex justify-between w-64 text-slate-500">
                <span>Nilai PPN:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {hasFinanceCapability ? `Rp ${quotation.tax?.toLocaleString('id-ID')}` : 'Rp ••••••'}
                </span>
              </div>
              <div className="flex justify-between w-64 text-lg font-bold border-t pt-2 mt-1 text-[var(--color-accent-blue)]">
                <span>Grand Total:</span>
                <span>
                  {hasFinanceCapability ? `Rp ${quotation.grandTotal?.toLocaleString('id-ID')}` : 'Rp ••••••'}
                </span>
              </div>
            </div>
          </Card>

          {/* SECTION 7: SYARAT & KETENTUAN */}
          <Card className="p-6">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">3. Syarat & Ketentuan</h2>
            <div className="space-y-3">
              {/* Scope Accordion */}
              <div className="border rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-800/50">
                <button 
                  onClick={() => setExpandedSection(expandedSection === 'scope' ? '' : 'scope')}
                  className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span>Ruang Lingkup (Scope)</span>
                  {expandedSection === 'scope' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSection === 'scope' && (
                  <div className="p-3 pt-0">
                    <textarea 
                      className="w-full min-h-[80px] p-3 text-sm border rounded-lg bg-[var(--color-bg-primary)] resize-y focus:outline-hidden focus:ring-2 focus:ring-[var(--color-accent-blue)] disabled:opacity-50"
                      value={quotation.scopeOfWork || ''}
                      onChange={e => setQuotation({...quotation, scopeOfWork: e.target.value})}
                      disabled={isReadOnly}
                      placeholder="Jelaskan batasan ruang lingkup yang dikerjakan..."
                    />
                  </div>
                )}
              </div>

              {/* Exclusions Accordion */}
              <div className="border rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-800/50">
                <button 
                  onClick={() => setExpandedSection(expandedSection === 'exclusions' ? '' : 'exclusions')}
                  className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span>Pengecualian (Exclusions)</span>
                  {expandedSection === 'exclusions' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSection === 'exclusions' && (
                  <div className="p-3 pt-0">
                    <textarea 
                      className="w-full min-h-[80px] p-3 text-sm border rounded-lg bg-[var(--color-bg-primary)] resize-y focus:outline-hidden focus:ring-2 focus:ring-[var(--color-accent-blue)] disabled:opacity-50"
                      value={quotation.exclusions || ''}
                      onChange={e => setQuotation({...quotation, exclusions: e.target.value})}
                      disabled={isReadOnly}
                      placeholder="Jelaskan apa yang TIDAK termasuk dalam penawaran ini (ex: Biaya perizinan, tes tanah)..."
                    />
                  </div>
                )}
              </div>
              
              {/* Payment Terms Accordion */}
              <div className="border rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-800/50">
                <button 
                  onClick={() => setExpandedSection(expandedSection === 'payment' ? '' : 'payment')}
                  className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span>Syarat Pembayaran</span>
                  {expandedSection === 'payment' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSection === 'payment' && (
                  <div className="p-3 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Skema Pembayaran</label>
                        <Input 
                          value={quotation.paymentTerms || ''}
                          onChange={e => setQuotation({...quotation, paymentTerms: e.target.value})}
                          disabled={isReadOnly}
                          placeholder="Ex: DP 30%, Termin 1 40%, Pelunasan 30%"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Uang Muka (DP %)</label>
                        <div className="flex gap-2 items-center">
                          <Input 
                            type="number"
                            value={quotation.dpPercentage || 0}
                            onChange={e => setQuotation({...quotation, dpPercentage: Number(e.target.value)})}
                            disabled={isReadOnly}
                            className="w-20"
                          />
                          <span className="text-sm font-medium">Rp {quotation.dpAmount?.toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* General Terms Accordion */}
              <div className="border rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-800/50">
                <button 
                  onClick={() => setExpandedSection(expandedSection === 'general' ? '' : 'general')}
                  className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span>Ketentuan Umum & Lain-lain</span>
                  {expandedSection === 'general' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSection === 'general' && (
                  <div className="p-3 pt-0">
                    <textarea 
                      className="w-full min-h-[80px] p-3 text-sm border rounded-lg bg-[var(--color-bg-primary)] resize-y focus:outline-hidden focus:ring-2 focus:ring-[var(--color-accent-blue)] disabled:opacity-50"
                      value={quotation.termsAndConditions || ''}
                      onChange={e => setQuotation({...quotation, termsAndConditions: e.target.value})}
                      disabled={isReadOnly}
                      placeholder="Syarat lain yang disepakati..."
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* SIDEBAR: HISTORY & METADATA */}
        <div className="space-y-6">
          <Card className="p-5 border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
            <h3 className="font-bold text-sm mb-3 text-blue-800 dark:text-blue-400">Next Action</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {quotation.status === 'DRAFT' && "Simpan penawaran, lalu lihat Pratinjau Surat sebelum dikirim ke Klien."}
              {quotation.status === 'SENT' && "Tindak lanjuti dengan owner/klien untuk mulai proses negosiasi."}
              {(quotation.status === 'NEGOTIATION' || quotation.status === 'REVISED') && "Lakukan perubahan jika diperlukan dan buat Revisi baru."}
              {quotation.status === 'AGREED' && !quotation.projectId && "Buat Invoice DP atau langsung mulai setup Proyek."}
              {quotation.projectId && "Buka Workspace Proyek untuk memantau progress operasional."}
            </p>
          </Card>

          <Card className="p-5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
              <History className="w-4 h-4" /> Timeline Negosiasi
            </h3>
            <div className="space-y-4">
              {quotation.history && quotation.history.length > 0 ? (
                <div className="relative border-l border-slate-200 dark:border-slate-700 ml-2 space-y-4">
                  {[...quotation.history].reverse().map((event, i) => (
                    <div key={event.id} className="relative pl-4">
                      <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 ring-4 ring-slate-50 dark:ring-slate-900"></div>
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {event.eventType} (Rev.{event.revisionNumber.toString().padStart(2,'0')})
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {format(new Date(event.timestamp), 'dd MMM yyyy HH:mm', { locale: localeId })} oleh {event.userName}
                      </div>
                      {event.snapshotTotal !== undefined && (
                        <div className="text-xs font-semibold mt-0.5 text-blue-600">
                          Rp {event.snapshotTotal.toLocaleString('id-ID')}
                        </div>
                      )}
                      {event.note && (
                        <div className="text-[11px] mt-1 bg-white dark:bg-slate-800 border rounded p-1.5 italic text-slate-600">
                          "{event.note}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500 text-center py-4">Belum ada riwayat aktivitas</div>
              )}
            </div>
          </Card>

          <Card className="p-5 text-sm space-y-3">
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500">Tgl Dibuat</span>
              <span className="font-medium">{quotation.date ? format(new Date(quotation.date), 'dd MMM yyyy', { locale: localeId }) : '-'}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500">Valid Sampai</span>
              <span className="font-medium">{quotation.validUntil ? format(new Date(quotation.validUntil), 'dd MMM yyyy', { locale: localeId }) : '-'}</span>
            </div>
            {quotation.agreedAt && (
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Tgl Deal</span>
                <span className="font-medium text-emerald-600">{format(new Date(quotation.agreedAt), 'dd MMM yyyy HH:mm')}</span>
              </div>
            )}
          </Card>
        </div>
      </div>
      </div>
      </div>

      <Modal isOpen={showClientModal} onClose={() => setShowClientModal(false)} title="Tambah Klien Baru">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Nama Perusahaan / Klien *</label>
            <Input 
              value={newClientData.companyName || ''}
              onChange={e => setNewClientData({...newClientData, companyName: e.target.value})}
              placeholder="PT. ABC atau Budi"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Alamat Lengkap</label>
            <Input 
              value={newClientData.address || ''}
              onChange={e => setNewClientData({...newClientData, address: e.target.value})}
              placeholder="Alamat kantor/proyek"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Email</label>
              <Input 
                type="email"
                value={newClientData.email || ''}
                onChange={e => setNewClientData({...newClientData, email: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Telepon / WA</label>
              <Input 
                value={newClientData.phone || ''}
                onChange={e => setNewClientData({...newClientData, phone: e.target.value})}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setShowClientModal(false)}>Batal</Button>
            <Button onClick={handleSaveClient} disabled={isSavingClient}>
              {isSavingClient ? 'Menyimpan...' : 'Simpan Klien'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Hapus Penawaran"
        message={`Apakah Anda yakin ingin menghapus penawaran ${quotation.quotationNumber}? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleDeleteQuotation}
        onClose={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
