import { apiRequest } from '../lib/commandClient';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface SolarConfig {
  apiKey: string;
  model: 'solar-pro' | 'solar-mini';
  isConfigured: boolean;
  lastTestedAt?: string;
  lastTestStatus?: 'SUCCESS' | 'FAILED';
  lastTestLatency?: number;
}

export interface SolarDetectedError {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  category: 'Matematika & RAB' | 'Standar Gambar CAD' | 'Kelengkapan Dokumen' | 'Jadwal & Deadline' | 'Kepatuhan Hukum';
  target: string;
  issue: string;
  impact: string;
  recommendation: string;
  suggestedCorrection?: string;
}

export interface SolarErrorDetectionResult {
  score: number;
  overallStatus: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION' | 'CRITICAL';
  summary: string;
  errors: SolarDetectedError[];
  metrics: {
    totalChecked: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
  };
  modelUsed: string;
  latencyMs: number;
  timestamp: string;
}

export interface SolarClauseCheckItem {
  name: string;
  status: 'PASS' | 'WARNING' | 'FAIL' | 'NOT_APPLICABLE';
  summary: string;
  details: string;
  recommendedClause?: string;
}

export interface SolarDocumentCheckResult {
  docTitle: string;
  docType: string;
  complianceScore: number;
  overallStatus: 'SIAP_TERBIT' | 'PERLU_REVISI' | 'BERISIKO_TINGGI';
  executiveSummary: string;
  clauses: SolarClauseCheckItem[];
  missingItems: string[];
  riskWarnings: string[];
  suggestedAmendments: string;
  modelUsed: string;
  latencyMs: number;
  timestamp: string;
}

export interface SolarChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const STORAGE_KEY = 'mdrawing_solar_config_v1';

export class SolarAiService {
  private static localConfig: SolarConfig = {
    apiKey: '',
    model: 'solar-pro',
    isConfigured: false,
  };

  /**
   * Initialize and load configuration from localStorage and Firestore
   */
  public static async loadConfig(): Promise<SolarConfig> {localStorage.removeItem(STORAGE_KEY);try{const s=await apiRequest('/api/solar/config');this.localConfig={...s,apiKey:''};}catch{this.localConfig={apiKey:'',model:'solar-pro',isConfigured:false};}return {...this.localConfig};}

  public static getConfig(): SolarConfig {return {...this.localConfig,apiKey:''};}

  public static async saveConfig(config:Partial<SolarConfig>):Promise<SolarConfig>{localStorage.removeItem(STORAGE_KEY);if(config.apiKey?.trim())throw new Error('Kunci AI harus diatur operator pada environment server, bukan browser.');this.localConfig={...this.localConfig,...config,apiKey:''};return this.loadConfig();}

  private static saveLocal(config:SolarConfig){localStorage.removeItem(STORAGE_KEY);}

  private static async getAuthHeader(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (auth.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch {}
    }
    const currentKey = this.localConfig.apiKey?.trim();
    if (currentKey) {
      headers['x-solar-api-key'] = currentKey;
    }
    return headers;
  }

  /**
   * Validate Upstage Solar API Key
   */
  public static async validateApiKey(apiKey?:string,model:string='solar-pro'):Promise<any>{if(apiKey?.trim())return{valid:false,message:'Atur kunci pada environment server. Kolom browser tidak menyimpan kunci.'};try{const r=await apiRequest('/api/solar/validate-key',{model});await this.loadConfig();return{...r,message:r.message||'Koneksi server berhasil.'};}catch(e:any){return{valid:false,message:e.message};}}

  /**
   * Run deep Error Detection on Quotations, CAD Drawings, or Projects
   */
  public static async detectErrors(params: {
    contextType: 'quotation' | 'drawings' | 'project' | 'custom';
    data: any;
    customPrompt?: string;
  }): Promise<SolarErrorDetectionResult> {
    const headers = await this.getAuthHeader();
    const config = this.getConfig();

    const res = await fetch('/api/solar/detect-errors', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contextType: params.contextType,
        data: params.data,
        customPrompt: params.customPrompt,
        model: config.model || 'solar-pro',
        
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || result.message || 'Gagal menjalankan deteksi kesalahan Solar Pro.');
    }

    return result as SolarErrorDetectionResult;
  }

  /**
   * Run professional Document Checking on Quotes, SPK, Invoices, BAST, or custom text
   */
  public static async checkDocument(params: {
    docType: 'quotation' | 'spk' | 'invoice' | 'bast' | 'drawing_transmittal' | 'custom';
    docTitle: string;
    contentText: string;
    metadata?: Record<string, any>;
  }): Promise<SolarDocumentCheckResult> {
    const headers = await this.getAuthHeader();
    const config = this.getConfig();

    const res = await fetch('/api/solar/check-document', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        docType: params.docType,
        docTitle: params.docTitle,
        contentText: params.contentText,
        metadata: params.metadata,
        model: config.model || 'solar-pro',
        
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || result.message || 'Gagal menjalankan pengecekan dokumen Solar Pro.');
    }

    return result as SolarDocumentCheckResult;
  }

  /**
   * Chat directly with Solar 4 Pro AI Assistant
   */
  public static async chatWithSolar(params: {
    messages: SolarChatMessage[];
    projectContext?: any;
    temperature?: number;
  }): Promise<{ content: string; model: string; latencyMs: number; usage?: any }> {
    const headers = await this.getAuthHeader();
    const config = this.getConfig();

    const res = await fetch('/api/solar/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: params.messages,
        projectContext: params.projectContext,
        model: config.model || 'solar-pro',
        
        temperature: params.temperature ?? 0.2,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || result.message || 'Gagal berkomunikasi dengan Solar Pro Assistant.');
    }

    return result;
  }
}
