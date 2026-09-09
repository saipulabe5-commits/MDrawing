import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, 
  updateDoc, deleteDoc, orderBy, limit 
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
  companyName: 'PT. Asa Perdana Mandiri',
  brandName: 'MDrawing',
  tagline: 'Sistem Manajemen Gambar & Keuangan Proyek',
  address: 'Jl. Boulevard Arsitektur No. 88, Kawasan Bisnis Terpadu',
  city: 'Jakarta Selatan',
  postalCode: '12950',
  phone: '+62 21 555-0199',
  email: 'finance@asaperdana.co.id',
  website: 'https://asaperdana.co.id',
  taxId: '01.234.567.8-012.000',
  bankAccounts: [
    {
      id: 'bank-1',
      bankName: 'Bank Central Asia (BCA)',
      accountNumber: '8830-192-888',
      accountHolder: 'PT. Asa Perdana Mandiri',
      isDefault: true,
    },
    {
      id: 'bank-2',
      bankName: 'Bank Mandiri',
      accountNumber: '122-00-998877-6',
      accountHolder: 'PT. Asa Perdana Mandiri',
      isDefault: false,
    },
  ],
  defaultSignatoryName: 'Saipul Abe, S.T., IAI',
  defaultSignatoryTitle: 'Direktur Utama',
  invoiceTerms: '1. Pembayaran dilakukan via transfer bank ke rekening resmi PT. Asa Perdana Mandiri.\n2. Pembayaran jatuh tempo 14 hari kalender sejak faktur diterbitkan.\n3. Cantumkan nomor faktur pada berita transfer.',
  quotationTerms: '1. Penawaran harga berlaku selama 30 hari kalender sejak tanggal terbit.\n2. Biaya tidak termasuk retribusi perizinan dinas pemerintah (PBG) jika tidak disebutkan khusus.\n3. Perubahan desain di luar batas revisi yang disepakati akan dikenakan biaya tambahan.',
  updatedAt: new Date().toISOString(),
};

const DEFAULT_TEMPLATES: Omit<PdfTemplate, 'id' | 'updatedAt'>[] = [
  {
    templateType: 'quotation',
    name: 'Template Penawaran Harga (Quotation)',
    headerTitle: 'SURAT PENAWARAN HARGA',
    subHeader: 'Jasa Perencanaan & Gambar Arsitektur',
    companyName: 'PT. Asa Perdana Mandiri',
    companyAddress: 'Kawasan Bisnis Terpadu, Jakarta Selatan',
    companyPhone: '+62 21 555-0199',
    companyEmail: 'info@asaperdana.co.id',
    primaryColor: '#007AFF',
    termsAndConditions: 'Penawaran ini mengikat selama 30 hari sejak tanggal diterbitkan.',
    footerNote: 'Terima kasih atas kepercayaan Anda kepada PT. Asa Perdana Mandiri.',
    signatoryName: 'Saipul Abe, S.T., IAI',
    signatoryTitle: 'Direktur Utama',
    showLetterhead: true,
  },
  {
    templateType: 'invoice',
    name: 'Template Faktur Tagihan (Invoice)',
    headerTitle: 'FAKTUR PENAGIHAN',
    subHeader: 'Komersial / Proyek',
    companyName: 'PT. Asa Perdana Mandiri',
    companyAddress: 'Kawasan Bisnis Terpadu, Jakarta Selatan',
    companyPhone: '+62 21 555-0199',
    companyEmail: 'finance@asaperdana.co.id',
    primaryColor: '#007AFF',
    termsAndConditions: 'Pembayaran wajib mencantumkan nomor faktur. Rekening resmi BCA a/n PT. Asa Perdana Mandiri.',
    footerNote: 'Dokumen ini sah dan diproses secara elektronik melalui MDrawing.',
    signatoryName: 'Saipul Abe, S.T., IAI',
    signatoryTitle: 'Direktur Utama',
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

  // Subscribe to Company Settings
  useEffect(() => {
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
      console.error("Error fetching company settings:", err);
    });

    return () => unsubscribe();
  }, [user, appUser]);

  // Subscribe to PDF Templates
  useEffect(() => {
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
      console.error("Error fetching templates:", err);
    });

    return () => unsubscribe();
  }, [user, appUser]);

  // Subscribe to Generated Documents History
  useEffect(() => {
    if (!user) {
      setGeneratedDocuments([]);
      setLoadingDocuments(false);
      return;
    }

    const q = query(collection(db, 'generatedDocuments'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as GeneratedDocument));
      setGeneratedDocuments(list);
      setLoadingDocuments(false);
    }, (err) => {
      console.error("Error fetching generated documents:", err);
      setLoadingDocuments(false);
    });

    return () => unsubscribe();
  }, [user]);

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
