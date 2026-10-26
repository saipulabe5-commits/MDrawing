import type { CompanySettings } from '../types';
let current:Partial<CompanySettings>={};
export function configureDocumentBranding(settings:Partial<CompanySettings>){current={...settings};}
export function documentBranding(){return current;}
export function requireDocumentBranding(){if(!current.companyName?.trim()||!current.address?.trim())throw new Error('Lengkapi dan verifikasi nama/alamat perusahaan di Pengaturan sebelum menerbitkan dokumen resmi.');return current;}
