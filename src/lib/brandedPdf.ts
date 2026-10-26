import jsPDF from 'jspdf';
import { requireDocumentBranding } from './documentBranding';
export function createBrandedPdf(...args:any[]):jsPDF {
  const company=requireDocumentBranding(),doc:jsPDF=new (jsPDF as any)(...args),text=doc.text.bind(doc);
  const replacements:Record<string,string>={
    'PT. ASA PERDANA MANDIRI':company.companyName!,'PT. Asa Perdana Mandiri':company.companyName!,
    'Gedung APM, Lt. 3':company.address!, 'Jl. Teknik Arsitektur No. 1, Jakarta Selatan':company.city||'',
    'Tel: (021) 555-0123 | Email: contact@asaperdana.co.id':[company.phone,company.email].filter(Boolean).join(' | '),
    'www.asaperdana.co.id':company.website||'',
  };
  (doc as any).text=(value:any,...rest:any[])=>text(typeof value==='string'?(replacements[value]??value):value,...rest as [any,any]);
  doc.setProperties({author:company.companyName,title:company.brandName||company.companyName});
  return doc;
}
export function requireInvoiceBank(){const c=requireDocumentBranding();const bank=c.bankAccounts?.find(b=>b.isDefault)||c.bankAccounts?.[0];if(!bank?.accountNumber||!bank.accountHolder||!bank.bankName)throw new Error('Rekening penerima belum diverifikasi pada Pengaturan.');return bank;}
