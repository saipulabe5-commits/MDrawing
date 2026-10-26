import { configureDocumentBranding } from '../lib/documentBranding';
import { hasCapability, isCompanyWideFinanceRole } from '../security/authorization';
import { apiRequest } from '../lib/commandClient';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, 
  updateDoc, deleteDoc, orderBy, limit, where 
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { 
  CompanySettings, PdfTemplate, GeneratedDocument, PdfTemplateType, 
  BankAccountInfo 
} from '../types';

interface DocumentContextType {
  companySettings: CompanySettings;
  pdfTemplates: PdfTemplate[];
  generatedDocuments: GeneratedDocument[];
  loadingDocuments: boolean;
  updateCompanySettings: (data: Partial<CompanySettings>) => Promise<void>;
  updatePdfTemplate: (templateId: string, data: Partial<PdfTemplate>) => Promise<void>;
  recordGeneratedDocument: (docData: Omit<GeneratedDocument, 'id' | 'createdAt'>) => Promise<string>;
}

const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  id: 'default',
  companyName: '',
  brandName: 'MDrawing',
  tagline: 'Sistem Manajemen Gambar & Keuangan Proyek',
  address: '',
  city: '',
  postalCode: '',
  phone: '',
  email: '',
  website: '',
  taxId: '',
  bankAccounts: [],
  defaultSignatoryName: '',
  defaultSignatoryTitle: '',
  invoiceTerms: '1. Pembayaran dilakukan via transfer bank ke rekening resmi perusahaan yang dikonfigurasi.\n2. Pembayaran jatuh tempo 14 hari kalender sejak faktur diterbitkan.\n3. Cantumkan nomor faktur pada berita transfer.',
  quotationTerms: '1. Penawaran harga berlaku selama 30 hari kalender sejak tanggal terbit.\n2. Biaya tidak termasuk retribusi perizinan dinas pemerintah (PBG) jika tidak disebutkan khusus.\n3. Perubahan desain di luar batas revisi yang disepakati akan dikenakan biaya tambahan.',
  updatedAt: new Date().toISOString(),
};

const DEFAULT_TEMPLATES: Omit<PdfTemplate, 'id' | 'updatedAt'>[] = [
  {
    templateType: 'quotation',
    name: 'Template Penawaran Harga (Quotation)',
    headerTitle: 'SURAT PENAWARAN HARGA',
    subHeader: 'Jasa Perencanaan & Gambar Arsitektur',
    companyName: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    primaryColor: '#007AFF',
    termsAndConditions: 'Penawaran ini mengikat selama 30 hari sejak tanggal diterbitkan.',
    footerNote: 'Terima kasih atas kepercayaan Anda kepada perusahaan yang dikonfigurasi.',
    signatoryName: '',
    signatoryTitle: '',
    showLetterhead: true,
  },
  {
    templateType: 'invoice',
    name: 'Template Faktur Tagihan (Invoice)',
    headerTitle: 'FAKTUR PENAGIHAN',
    subHeader: 'Komersial / Proyek',
    companyName: '',
    companyAddress: 'Kawasan Bisnis Terpadu, ',
    companyPhone: '',
    companyEmail: '',
    primaryColor: '#007AFF',
    termsAndConditions: 'Pembayaran wajib mencantumkan nomor faktur. Gunakan rekening terverifikasi pada profil perusahaan.',
    footerNote: 'Dokumen ini sah dan diproses secara elektronik melalui MDrawing.',
    signatoryName: '',
    signatoryTitle: '',
    showLetterhead: true,
  },
];

const DocumentContext = createContext<DocumentContextType | null>(null);

export const useDocument = () => {
  const context = useContext(DocumentContext);
  if (!context) throw new Error("useDocument must be used within DocumentProvider");
  return context;
};

export const useDocumentContext = useDocument;

export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, appUser } = useAuth();
  const [companySettings, setCompanySettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [pdfTemplates, setPdfTemplates] = useState<PdfTemplate[]>([]);
  const [generatedDocuments, setGeneratedDocuments] = useState<GeneratedDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  useEffect(()=>{configureDocumentBranding(companySettings);},[companySettings]);

  // Subscribe to Company Settings
  useEffect(() => {
    if (!user) {
      setCompanySettings(DEFAULT_COMPANY_SETTINGS);
      return;
    }

    const docRef = doc(db, 'companySettings', 'default');
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setCompanySettings(snap.data() as CompanySettings);
      } else {
        // Initialize default in Firestore if not existing and user is logged in
        if (user && (appUser?.role === 'OWNER' || appUser?.role === 'ADMIN')) {
          setDoc(docRef, DEFAULT_COMPANY_SETTINGS).catch(console.error);
        }
      }
    }, (err) => {
      console.warn("Notice fetching company settings, using defaults:", err?.message || err);
      setCompanySettings(DEFAULT_COMPANY_SETTINGS);
    });

    return () => unsubscribe();
  }, [user, appUser]);

  // Subscribe to PDF Templates
  useEffect(() => {
    if (!user) {
      setPdfTemplates([]);
      return;
    }

    const q = query(collection(db, 'pdfTemplates'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        // Seed default templates
        if (user && (appUser?.role === 'OWNER' || appUser?.role === 'ADMIN')) {
          DEFAULT_TEMPLATES.forEach(async (tpl, idx) => {
            const ref = doc(collection(db, 'pdfTemplates'));
            await setDoc(ref, {
              ...tpl,
              id: ref.id,
              updatedAt: new Date().toISOString(),
            });
          });
        }
      } else {
        const templates = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as PdfTemplate));
        setPdfTemplates(templates);
      }
    }, (err) => {
      console.warn("Notice fetching templates, using defaults:", err?.message || err);
      setPdfTemplates(DEFAULT_TEMPLATES.map((tpl, idx) => ({
        ...tpl,
        id: `tpl-default-${idx}`,
        updatedAt: new Date().toISOString(),
      })));
    });

    return () => unsubscribe();
  }, [user, appUser]);

  // Subscribe to Generated Documents History
  useEffect(() => {
    let live = true;
    setGeneratedDocuments([]);
    setLoadingDocuments(true);
    if (!user || !appUser?.isActive) {
      setLoadingDocuments(false);
      return;
    }
    const load = async () => {
      try {
        let projectList: any[] = [];
        try {
          const p = await apiRequest('/api/projects');
          projectList = p.projects || [];
        } catch {
          const pSnap = await getDocs(collection(db, 'projects'));
          projectList = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        const rows: any[] = [];
        for (const project of projectList) {
          const q = hasCapability(appUser, 'canViewFinance')
            ? query(collection(db, 'generatedDocuments'), where('projectId', '==', project.id))
            : query(collection(db, 'generatedDocuments'), where('projectId', '==', project.id), where('documentType', '==', 'DrawingTransmittal'));
          const snap = await getDocs(q);
          rows.push(...snap.docs.map(d => ({ ...d.data(), id: d.id })));
        }
        if (live) {
          setGeneratedDocuments(rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 200));
          setLoadingDocuments(false);
        }
      } catch (e) {
        if (live) {
          setGeneratedDocuments([]);
          setLoadingDocuments(false);
        }
        console.warn('Document history unavailable', e);
      }
    };
    load();
    return () => { live = false; };
  }, [user, appUser]);

  const updateCompanySettings = async (data: Partial<CompanySettings>): Promise<void> => {
    const isAuthorized = appUser?.role === 'OWNER' || appUser?.role === 'ADMIN';
    if (!isAuthorized) throw new Error("Akses ditolak: Hanya Owner/Admin yang dapat mengubah Profil Perusahaan.");

    const docRef = doc(db, 'companySettings', 'default');
    const updated = {
      ...companySettings,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(docRef, updated, { merge: true });
    setCompanySettings(updated);
  };

  const updatePdfTemplate = async (templateId: string, data: Partial<PdfTemplate>): Promise<void> => {
    const isAuthorized = appUser?.role === 'OWNER' || appUser?.role === 'ADMIN';
    if (!isAuthorized) throw new Error("Akses ditolak: Hanya Owner/Admin yang dapat mengubah Template Dokumen.");

    const ref = doc(db, 'pdfTemplates', templateId);
    await updateDoc(ref, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  };

  const recordGeneratedDocument = async (docData: Omit<GeneratedDocument, 'id' | 'createdAt'>): Promise<string> => {
    const ref = doc(collection(db, 'generatedDocuments'));
    const newDoc: GeneratedDocument = {
      ...docData,
      id: ref.id,
      createdAt: new Date().toISOString(),
    };
    await setDoc(ref, newDoc);
    setGeneratedDocuments(prev=>[newDoc,...prev].slice(0,200));
    return ref.id;
  };

  return (
    <DocumentContext.Provider
      value={{
        companySettings,
        pdfTemplates,
        generatedDocuments,
        loadingDocuments,
        updateCompanySettings,
        updatePdfTemplate,
        recordGeneratedDocument,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
};
