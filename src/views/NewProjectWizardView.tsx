import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { 
  Building, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, 
  Save, ShieldCheck, Users, FileText, Layers, DollarSign, 
  Calendar, Briefcase, Plus, Trash2, Lock, Sparkles, Check,
  XCircle, Clock, Percent, Calculator, ChevronRight, HelpCircle,
  RefreshCw
} from 'lucide-react';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useDrawingTemplate } from '../context/DrawingTemplateContext';
import { 
  Project, Client, DrawingItem, Quotation, FinanceTerm, 
  VendorContract, DrawingPriority, DrawingItemStatus 
} from '../types';
import { 
  CANONICAL_WORKFLOW_STAGES, 
  CanonicalWorkflowStage, 
  WIZARD_ORDERED_STAGES,
  validateWorkflowStage,
  evaluatePreFlightInspection,
  isValidProjectCodeFormat,
  canNavigateToStage
} from '../engine/workflow/projectWorkflow';
import { 
  calculateQuotationTotals, 
  formatRupiah, 
  normalizeMoney 
} from '../engine/financial/financialEngine';
import { collection, getDocs, doc, getDoc, setDoc, query, where, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Button, Card, Input, Badge } from '../components/ui';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

export const DISCIPLINE_NAME_MAP: Record<string, string> = {
  'Arsitektur': 'Jasa Pembuatan Gambar DED Arsitektur Lengkap',
  'Struktur': 'Jasa Pembuatan Gambar DED Struktur & Konstruksi',
  'MEP': 'Jasa Pembuatan Gambar DED MEP (Mekanikal, Elektrikal, Plumbing)',
  'Interior': 'Jasa Pembuatan Gambar DED Desain Interior & Fit-Out',
  'Masterplan': 'Jasa Pembuatan Gambar Masterplan & Kawasan',
  'Infrastruktur': 'Jasa Pembuatan Gambar DED Infrastruktur & Cut/Fill',
  'QS': 'Jasa Perhitungan Quantity Surveyor (QS) & Estimasi Biaya (RAB)'
};

export function generateQuotationItemsFromProjectType(typesString: string, totalVal: number) {
  const types = (typesString || 'Arsitektur').split(', ').map(t => t.trim()).filter(Boolean);
  if (types.length === 0) {
    return [{
      id: uuidv4(),
      description: 'Jasa Pembuatan Gambar DED Lengkap',
      quantity: 1,
      unit: 'Paket',
      unitPrice: totalVal || 0
    }];
  }

  const count = types.length;
  const basePrice = count > 0 && totalVal > 0 ? Math.floor(totalVal / count) : 0;
  const remainder = count > 0 && totalVal > 0 ? totalVal - (basePrice * count) : 0;

  return types.map((t, idx) => ({
    id: uuidv4(),
    description: DISCIPLINE_NAME_MAP[t] || `Jasa Pembuatan Gambar DED ${t}`,
    quantity: 1,
    unit: 'Paket',
    unitPrice: idx === 0 ? (basePrice + remainder) : basePrice
  }));
}

export function NewProjectWizardView() {
  const navigate = useNavigate();
  const { id: routeProjectId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const queryProjectId = searchParams.get('projectId');
  const activeProjectId = routeProjectId || queryProjectId;

  const { projects, createProject, updateProject, activateProject, saveProjectWorkflowDraft } = useProjects();
  const { appUser } = useAuth();
  const { canManageProjects } = usePermissions();
  const { templates } = useDrawingTemplate();

  // Wizard Navigation State
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedStages, setCompletedStages] = useState<CanonicalWorkflowStage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingClients, setExistingClients] = useState<Client[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);

  // Project Identity State (Step 1)
  const [projectName, setProjectName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [projectType, setProjectType] = useState('Arsitektur');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  // Client Setup State (Step 2)
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newClientData, setNewClientData] = useState({
    clientName: '',
    companyName: '',
    email: '',
    phone: '',
    address: '',
    taxId: ''
  });

  // Timeline & Commercial State (Step 3)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split('T')[0];
  });
  const [contractValue, setContractValue] = useState<number>(0);
  const [taxPolicy, setTaxPolicy] = useState<'NON_PPN' | 'PPN_11' | 'PPN_12'>('PPN_11');
  const [targetProfitPercentage, setTargetProfitPercentage] = useState<number>(25);
  const [budgetOperationalPercent, setBudgetOperationalPercent] = useState<number>(0);

  // Drawing Setup State (Step 4 & 6)
  const [drawingSetupMode, setDrawingSetupMode] = useState<'template' | 'manual'>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [drawingItems, setDrawingItems] = useState<DrawingItem[]>([]);

  // Team Setup State (Step 5)
  const [projectLeaderId, setProjectLeaderId] = useState('');
  const [projectLeaderName, setProjectLeaderName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Commercial / Quotation State (Step 7)
  const [hasUserEditedQuotation, setHasUserEditedQuotation] = useState<boolean>(false);
  const [quotationItems, setQuotationItems] = useState<Array<{
    id: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }>>(() => generateQuotationItemsFromProjectType('Arsitektur', 0));
  const [quotationDiscount, setQuotationDiscount] = useState<number>(0);
  const [quotationStatus, setQuotationStatus] = useState<'Draft' | 'Sent' | 'Approved'>('Draft');

  // Payment Terms State (Step 8)
  const [financeTerms, setFinanceTerms] = useState<FinanceTerm[]>([
    { id: uuidv4(), projectId: activeProjectId || '', termName: 'Uang Muka (DP)', triggerType: 'On Quotation Approved', amountType: 'Percentage', percentageValue: 30, sortOrder: 1, createdAt: '', updatedAt: '' },
    { id: uuidv4(), projectId: activeProjectId || '', termName: 'Termin 1 (Progress 50%)', triggerType: 'On Drawing Progress', triggerCondition: '50', amountType: 'Percentage', percentageValue: 40, sortOrder: 2, createdAt: '', updatedAt: '' },
    { id: uuidv4(), projectId: activeProjectId || '', termName: 'Pelunasan (As-Built / Final)', triggerType: 'On Drawing Final', amountType: 'Percentage', percentageValue: 30, sortOrder: 3, createdAt: '', updatedAt: '' }
  ]);

  // Vendor Setup State (Step 9)
  const [hasVendor, setHasVendor] = useState<boolean>(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorScope, setVendorScope] = useState('');
  const [vendorContractValue, setVendorContractValue] = useState<number>(0);

  // Financial Baseline Breakdown (Step 10)
  const [budgetSurvey, setBudgetSurvey] = useState<number>(0);
  const [budgetPlotCAD, setBudgetPlotCAD] = useState<number>(0);
  const [budgetMeeting, setBudgetMeeting] = useState<number>(0);
  const [budgetMiscellaneous, setBudgetMiscellaneous] = useState<number>(0);

  // Validation / Error Banner
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const [stepWarnings, setStepWarnings] = useState<string[]>([]);

  // Load existing clients and users
  useEffect(() => {
    async function loadAuxiliaryData() {
      try {
        const clientSnap = await getDocs(query(collection(db, 'clients'), orderBy('clientName', 'asc')));
        setExistingClients(clientSnap.docs.map(d => ({ id: d.id, ...d.data() } as Client)));

        const usersSnap = await getDocs(collection(db, 'users'));
        setAvailableUsers(usersSnap.docs.map(d => ({ uid: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error loading clients or users", err);
      }
    }
    loadAuxiliaryData();
  }, []);

  // Auto-generate suggested canonical project code if empty
  useEffect(() => {
    if (!projectCode && projects.length >= 0 && !activeProjectId) {
      const year = new Date().getFullYear();
      const prefix = `PRJ-${year}-`;
      let maxSequence = 0;
      
      projects.forEach(p => {
        if (p.projectCode && p.projectCode.startsWith(prefix)) {
          const seqStr = p.projectCode.substring(prefix.length);
          const seq = parseInt(seqStr, 10);
          if (!isNaN(seq) && seq > maxSequence) {
            maxSequence = seq;
          }
        }
      });
      
      const nextSequence = maxSequence + 1;
      setProjectCode(`${prefix}${nextSequence.toString().padStart(3, '0')}`);
    }
  }, [projects, activeProjectId]);

  // Load existing project if activeProjectId provided (Resume Draft)
  useEffect(() => {
    if (!activeProjectId) return;
    const existing = projects.find(p => p.id === activeProjectId);
    if (existing) {
      setProjectName(existing.projectName || '');
      setProjectCode(existing.projectCode || '');
      setProjectType(existing.projectType || 'Arsitektur');
      setLocation(existing.location || '');
      setDescription(existing.description || '');
      setSelectedClientId(existing.clientId || '');
      setStartDate(existing.startDate || new Date().toISOString().split('T')[0]);
      setTargetDate(existing.targetDate || '');
      setContractValue(existing.contractValue || 0);
      if (existing.budgetOtherExpenses && existing.contractValue && existing.contractValue > 0) {
        const pct = Math.round((existing.budgetOtherExpenses / existing.contractValue) * 1000) / 10;
        setBudgetOperationalPercent(Math.min(10, Math.max(0, pct)));
      } else {
        setBudgetOperationalPercent(0);
      }
      setProjectLeaderId(existing.projectLeaderId || '');
      setProjectLeaderName(existing.projectLeaderName || '');
      setSelectedMembers(existing.members || []);
      setTaxPolicy(existing.taxPolicy || 'PPN_11');
      setTargetProfitPercentage(existing.targetProfitPercentage || 25);
      if (existing.completedStages) {
        setCompletedStages(existing.completedStages);
      }
      if (existing.workflowStage) {
        const idx = WIZARD_ORDERED_STAGES.indexOf(existing.workflowStage);
        if (idx >= 0) setCurrentStepIndex(idx);
      }
    }
  }, [activeProjectId, projects]);

  // Automatically sync quotation items when projectType or contractValue changes (unless user manually modified)
  useEffect(() => {
    if (!hasUserEditedQuotation && !activeProjectId) {
      setQuotationItems(generateQuotationItemsFromProjectType(projectType, contractValue));
    }
  }, [projectType, contractValue, hasUserEditedQuotation, activeProjectId]);

  // Quotation Calculations
  const calculatedQuotation = useMemo(() => {
    const taxPct = taxPolicy === 'NON_PPN' ? 0 : taxPolicy === 'PPN_12' ? 12 : 11;
    return calculateQuotationTotals(quotationItems, quotationDiscount, taxPct);
  }, [quotationItems, quotationDiscount, taxPolicy]);

  const effectiveContractValue = calculatedQuotation.grandTotal > 0 ? calculatedQuotation.grandTotal : contractValue;

  const budgetOtherExpenses = useMemo(() => {
    if (!effectiveContractValue || effectiveContractValue <= 0) return 0;
    return Math.round(effectiveContractValue * ((budgetOperationalPercent || 0) / 100));
  }, [effectiveContractValue, budgetOperationalPercent]);

  // Synchronize contractValue with Quotation grandTotal whenever quotation items have positive total
  useEffect(() => {
    if (calculatedQuotation.grandTotal > 0 && contractValue !== calculatedQuotation.grandTotal) {
      setContractValue(calculatedQuotation.grandTotal);
    }
  }, [calculatedQuotation.grandTotal, contractValue]);

  // Build Context for Validators
  const currentWorkflowContext = useMemo(() => {
    const selectedClientObj = existingClients.find(c => c.id === selectedClientId);
    const clientNameFinal = clientMode === 'existing' 
      ? (selectedClientObj?.clientName || '') 
      : (newClientData.clientName || '');

    return {
      project: {
        id: activeProjectId || undefined,
        projectName,
        projectCode,
        projectType,
        location,
        description,
        clientId: selectedClientId,
        clientName: clientNameFinal,
        startDate,
        targetDate,
        contractValue: effectiveContractValue,
        budgetOtherExpenses,
        projectLeaderId,
        projectLeaderName,
        members: selectedMembers,
        taxPolicy,
        targetProfitPercentage
      },
      drawingItems,
      financeTerms,
      quotation: quotationItems.length > 0 ? {
        id: uuidv4(),
        projectId: activeProjectId || '',
        clientId: selectedClientId || '',
        quotationNumber: `QUO-${projectCode || 'DRAFT'}`,
        date: startDate || new Date().toISOString().split('T')[0],
        validUntil: targetDate || '',
        status: quotationStatus,
        items: quotationItems.map(item => ({
          ...item,
          totalPrice: item.quantity * item.unitPrice
        })),
        subTotal: calculatedQuotation.subTotal,
        discount: calculatedQuotation.discount,
        tax: calculatedQuotation.tax,
        taxPercentage: calculatedQuotation.taxPercentage,
        grandTotal: calculatedQuotation.grandTotal,
        notes: '',
        termsAndConditions: '',
        createdBy: appUser?.id || '',
        createdAt: '',
        updatedAt: ''
      } : undefined,
      allProjectCodes: projects.map(p => p.projectCode),
      user: appUser
    };
  }, [
    activeProjectId, projectName, projectCode, projectType, location, description,
    selectedClientId, clientMode, newClientData, startDate, targetDate, effectiveContractValue,
    budgetOtherExpenses, projectLeaderId, projectLeaderName, selectedMembers,
    taxPolicy, targetProfitPercentage, drawingItems, financeTerms, projects, appUser, existingClients,
    quotationItems, calculatedQuotation, quotationStatus
  ]);

  const currentStageName = WIZARD_ORDERED_STAGES[currentStepIndex];
  const currentStageDef = CANONICAL_WORKFLOW_STAGES[currentStageName];

  // Pre-Flight Evaluation
  const preFlightResult = useMemo(() => {
    return evaluatePreFlightInspection(currentWorkflowContext);
  }, [currentWorkflowContext]);

  // Validate current step
  const handleValidateCurrentStep = (): boolean => {
    const val = validateWorkflowStage(currentStageName, currentWorkflowContext);
    setStepErrors(val.errors);
    setStepWarnings(val.warnings);
    return val.valid;
  };

  // Next Step Action
  const handleNext = async () => {
    const isValid = handleValidateCurrentStep();
    if (!isValid) {
      toast.error(`Tahapan ${currentStageDef.label} belum memenuhi syarat.`);
      return;
    }

    // Mark current stage as completed
    const newCompleted = Array.from(new Set([...completedStages, currentStageName]));
    setCompletedStages(newCompleted);

    if (currentStepIndex < WIZARD_ORDERED_STAGES.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      setStepErrors([]);
      setStepWarnings([]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Back Step Action
  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      setStepErrors([]);
      setStepWarnings([]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Save Draft & Exit
  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    try {
      let targetId = activeProjectId;
      if (!targetId) {
        // Create draft project
        targetId = await createProject({
          projectName: projectName || 'Draft Proyek Baru',
          projectCode: projectCode || `PRJ-${Date.now()}`,
          projectType,
          location: location || 'Lokasi Belum Ditentukan',
          startDate,
          targetDate,
          status: 'Planning',
          description,
          members: selectedMembers,
          contractValue,
          budgetOtherExpenses,
          clientName: clientMode === 'existing' 
            ? (existingClients.find(c => c.id === selectedClientId)?.clientName || 'Draft Client') 
            : (newClientData.clientName || 'Draft Client'),
          clientId: selectedClientId,
          projectLeaderId,
          projectLeaderName,
          taxPolicy,
          targetProfitPercentage,
          workflowStage: currentStageName,
          completedStages
        });
      } else {
        await saveProjectWorkflowDraft(targetId, currentStageName, completedStages, {
          projectName,
          projectCode,
          projectType,
          location,
          description,
          startDate,
          targetDate,
          contractValue,
          budgetOtherExpenses,
          clientName: clientMode === 'existing' 
            ? (existingClients.find(c => c.id === selectedClientId)?.clientName || 'Draft Client') 
            : (newClientData.clientName || 'Draft Client'),
          clientId: selectedClientId,
          projectLeaderId,
          projectLeaderName,
          members: selectedMembers,
          taxPolicy,
          targetProfitPercentage
        });
      }
      toast.success("Draft proyek berhasil disimpan. Anda dapat melanjutkan setup kapan saja.");
      navigate('/projects');
    } catch (err: any) {
      toast.error("Gagal menyimpan draft: " + (err.message || "Terjadi kesalahan."));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Final Project Activation
  const handleActivateProject = async () => {
    if (!preFlightResult.isReady) {
      toast.error("Tidak dapat mengaktifkan proyek: Pre-Flight checklist belum memenuhi syarat.");
      return;
    }

    setIsSubmitting(true);
    try {
      let finalProjectId = activeProjectId;
      const clientNameFinal = clientMode === 'existing'
        ? (existingClients.find(c => c.id === selectedClientId)?.clientName || '')
        : newClientData.clientName;

      // If new client was created in wizard, persist client first
      let finalClientId = selectedClientId;
      if (clientMode === 'new' && newClientData.clientName) {
        finalClientId = uuidv4();
        await setDoc(doc(db, 'clients', finalClientId), {
          id: finalClientId,
          ...newClientData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      if (!finalProjectId) {
        finalProjectId = await createProject({
          projectName,
          projectCode,
          projectType,
          location,
          description,
          startDate,
          targetDate,
          status: 'Berjalan',
          members: selectedMembers,
          contractValue,
          budgetOtherExpenses,
          clientName: clientNameFinal,
          clientId: finalClientId,
          projectLeaderId,
          projectLeaderName,
          taxPolicy,
          targetProfitPercentage,
          workflowStage: 'ACTIVE',
          completedStages: WIZARD_ORDERED_STAGES
        }, selectedTemplateId || undefined);
      }

      if (finalProjectId) {
        await activateProject(finalProjectId, currentWorkflowContext);
        toast.success(`Proyek "${projectName}" resmi aktif! Selamat bekerja.`);
        navigate(`/projects/${finalProjectId}`);
      }
    } catch (err: any) {
      toast.error("Aktivasi gagal: " + (err.message || "Terjadi kesalahan sistem."));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Apply selected template
  const handleApplyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) return;

    // Convert template items to drawingItems preview
    const newItems: DrawingItem[] = [];
    let sort = 1;
    tpl.groups?.forEach(g => {
      g.items?.forEach(it => {
        newItems.push({
          id: uuidv4(),
          projectId: activeProjectId || '',
          groupId: null,
          drawingNumber: it.drawingNumber,
          drawingName: it.drawingName,
          scale: it.scale || '1:100',
          picId: '',
          picName: '',
          deadline: null,
          status: 'Belum Mulai',
          progress: 0,
          priority: 'Normal',
          notes: '',
          revisionCount: 0,
          isDeleted: false,
          sortOrder: sort++,
          createdBy: appUser?.uid || 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });
    });
    setDrawingItems(newItems);
    toast.success(`Template "${tpl.templateName}" diterapkan (${newItems.length} lembar gambar).`);
  };

  const progressPercent = Math.round(((currentStepIndex + 1) / WIZARD_ORDERED_STAGES.length) * 100);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-24 text-[var(--color-text-primary)]">
      {/* HEADER BAR */}
      <header className="sticky top-0 z-30 bg-[var(--color-surface)]/90 backdrop-blur-md border-b border-[var(--color-border)] px-4 lg:px-8 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
              <span>Proyek Baru</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-[var(--color-accent-blue)]">Step {currentStepIndex + 1} of {WIZARD_ORDERED_STAGES.length}</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-[var(--color-text-primary)] font-bold">{currentStageDef.label}</span>
            </div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-[var(--color-text-primary)] mt-0.5 flex items-center gap-2">
              <Building className="w-6 h-6 text-[var(--color-accent-blue)]" />
              {projectName || 'Penyusunan Proyek Baru'}
              {projectCode && (
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[var(--color-text-secondary)]">
                  {projectCode}
                </span>
              )}
            </h1>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="gap-1.5"
            >
              <Save className="w-4 h-4 text-[var(--color-text-secondary)]" />
              Simpan Draft & Keluar
            </Button>
          </div>
        </div>

        {/* PROGRESS STRIP */}
        <div className="max-w-7xl mx-auto mt-4">
          <div className="flex items-center justify-between text-xs font-semibold mb-1 text-[var(--color-text-secondary)]">
            <span>Kemajuan Setup: {progressPercent}%</span>
            <span>{currentStepIndex + 1} / {WIZARD_ORDERED_STAGES.length} Tahapan Selesai</span>
          </div>
          <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </header>

      {/* ONE-LANE HORIZONTAL STEPPER NAVIGATION */}
      <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 lg:px-8 py-3 overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto flex items-center gap-2 min-w-max">
          {WIZARD_ORDERED_STAGES.map((stg, idx) => {
            const def = CANONICAL_WORKFLOW_STAGES[stg];
            const isCompleted = completedStages.includes(stg);
            const isCurrent = idx === currentStepIndex;
            const isLocked = idx > currentStepIndex + 1 && !isCompleted;

            return (
              <button
                key={stg}
                disabled={isLocked}
                onClick={() => {
                  const navCheck = canNavigateToStage(stg, currentStageName, completedStages, currentWorkflowContext);
                  if (navCheck.allowed) {
                    setCurrentStepIndex(idx);
                    setStepErrors([]);
                    setStepWarnings([]);
                  } else {
                    toast.error(navCheck.reason || "Tahapan ini masih terkunci.");
                  }
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  isCurrent
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 shadow-sm ring-1 ring-blue-500/20'
                    : isCompleted
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                    : isLocked
                    ? 'opacity-40 cursor-not-allowed border-transparent text-[var(--color-text-tertiary)]'
                    : 'border-[var(--color-border)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--color-text-secondary)]'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  isCurrent ? 'bg-blue-600 text-white' :
                  isCompleted ? 'bg-emerald-600 text-white' :
                  'bg-black/10 dark:bg-white/10 text-[var(--color-text-secondary)]'
                }`}>
                  {isCompleted ? <Check className="w-3 h-3" /> : idx + 1}
                </div>
                <span>{def.label}</span>
                {isLocked && <Lock className="w-3 h-3 text-[var(--color-text-tertiary)]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="max-w-4xl mx-auto px-4 lg:px-6 pt-8 space-y-6">
        {/* STAGE DESCRIPTION BANNER */}
        <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-bold text-blue-900 dark:text-blue-300">
              Tahap {currentStepIndex + 1}: {currentStageDef.label}
            </h2>
            <p className="text-xs text-blue-800/80 dark:text-blue-300/80 mt-0.5">
              {currentStageDef.description}
            </p>
          </div>
        </div>

        {/* ERROR / WARNING NOTIFIER */}
        {stepErrors.length > 0 && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200 space-y-1">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-rose-700 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Perbaiki Data Sebelum Melanjutkan:
            </div>
            <ul className="list-disc list-inside text-xs space-y-0.5 pl-2">
              {stepErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* STEP 1: PROJECT IDENTITY */}
        {currentStageName === 'PROJECT_SETUP' && (
          <Card className="p-6 space-y-5">
            <h3 className="text-base font-bold text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-3 flex items-center gap-2">
              <Building className="w-4 h-4 text-[var(--color-accent-blue)]" />
              Identitas & Klasifikasi Proyek
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Nama Proyek <span className="text-rose-500">*</span>
                </label>
                <Input 
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Contoh: Gedung Perkantoran Menara Mandiri"
                  className="font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] flex items-center justify-between">
                  <span>ID Proyek (Kode) <span className="text-rose-500">*</span></span>
                  <span className="text-[11px] text-[var(--color-text-tertiary)]">Format: PRJ-YYYY-XXX</span>
                </label>
                <Input 
                  value={projectCode}
                  onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
                  placeholder="PRJ-2026-001"
                  className="font-mono uppercase font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Jenis / Bidang Pekerjaan <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'Arsitektur', label: 'Arsitektur' },
                    { id: 'Struktur', label: 'Struktur' },
                    { id: 'MEP', label: 'MEP' },
                    { id: 'Interior', label: 'Interior' },
                    { id: 'Masterplan', label: 'Masterplan' },
                    { id: 'Infrastruktur', label: 'Infrastruktur' },
                    { id: 'QS', label: 'Quantity Surveyor (QS)' }
                  ].map(type => {
                    const isSelected = projectType.split(', ').includes(type.id);
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          const types = projectType.split(', ').filter(Boolean);
                          let updated = '';
                          if (isSelected) {
                            updated = types.filter(t => t !== type.id).join(', ');
                          } else {
                            updated = [...types, type.id].join(', ');
                          }
                          setProjectType(updated);
                          if (!hasUserEditedQuotation) {
                            setQuotationItems(generateQuotationItemsFromProjectType(updated, contractValue));
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          isSelected 
                            ? 'bg-[var(--color-accent-blue)] text-white shadow-sm border-[var(--color-accent-blue)]' 
                            : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
                        } border`}
                      >
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Lokasi Pekerjaan <span className="text-rose-500">*</span>
                </label>
                <Input 
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Contoh: Jl. Sudirman Kav. 25, Jakarta Selatan"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Deskripsi Ringkas & Ruang Lingkup
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Tuliskan catatan khusus atau ruang lingkup pekerjaan gambar..."
                className="w-full p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:ring-2"
              />
            </div>
          </Card>
        )}

        {/* STEP 2: CLIENT SETUP */}
        {currentStageName === 'CLIENT_SETUP' && (
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="text-base font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[var(--color-accent-blue)]" />
                Data Klien Pemberi Tugas
              </h3>
              <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setClientMode('existing')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    clientMode === 'existing' 
                      ? 'bg-[var(--color-surface)] shadow text-[var(--color-accent-blue)]' 
                      : 'text-[var(--color-text-secondary)]'
                  }`}
                >
                  Pilih Klien Terdaftar
                </button>
                <button
                  type="button"
                  onClick={() => setClientMode('new')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    clientMode === 'new' 
                      ? 'bg-[var(--color-surface)] shadow text-[var(--color-accent-blue)]' 
                      : 'text-[var(--color-text-secondary)]'
                  }`}
                >
                  + Daftarkan Klien Baru
                </button>
              </div>
            </div>

            {clientMode === 'existing' ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                    Pilih Klien Dari Master Data
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm focus:ring-2 font-medium"
                  >
                    <option value="">-- Pilih Klien --</option>
                    {existingClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.clientName} {c.companyName ? `(${c.companyName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedClientId && (
                  (() => {
                    const c = existingClients.find(item => item.id === selectedClientId);
                    if (!c) return null;
                    return (
                      <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--color-border)] grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-[var(--color-text-tertiary)] block">Perusahaan:</span>
                          <span className="font-semibold">{c.companyName || '-'}</span>
                        </div>
                        <div>
                          <span className="text-[var(--color-text-tertiary)] block">Kontak / Email:</span>
                          <span className="font-semibold">{c.email || c.phone || '-'}</span>
                        </div>
                        <div>
                          <span className="text-[var(--color-text-tertiary)] block">NPWP:</span>
                          <span className="font-mono font-semibold">{c.taxId || 'Tidak Ada NPWP'}</span>
                        </div>
                        <div>
                          <span className="text-[var(--color-text-tertiary)] block">Alamat:</span>
                          <span className="font-semibold">{c.address || '-'}</span>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                    Nama Klien / Representatif <span className="text-rose-500">*</span>
                  </label>
                  <Input 
                    value={newClientData.clientName}
                    onChange={(e) => setNewClientData({ ...newClientData, clientName: e.target.value })}
                    placeholder="Contoh: Bpk. Hendra Wijaya"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                    Nama Perusahaan / Instansi
                  </label>
                  <Input 
                    value={newClientData.companyName}
                    onChange={(e) => setNewClientData({ ...newClientData, companyName: e.target.value })}
                    placeholder="PT. Graha Mega Properti"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                    Email Resmi
                  </label>
                  <Input 
                    type="email"
                    value={newClientData.email}
                    onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                    placeholder="klien@perusahaan.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                    Nomor Telepon / WhatsApp
                  </label>
                  <Input 
                    value={newClientData.phone}
                    onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                    placeholder="0812-XXXX-XXXX"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                    Nomor Pokok Wajib Pajak (NPWP)
                  </label>
                  <Input 
                    value={newClientData.taxId}
                    onChange={(e) => setNewClientData({ ...newClientData, taxId: e.target.value })}
                    placeholder="Contoh: 01.234.567.8-901.000"
                    className="font-mono"
                  />
                </div>
              </div>
            )}
          </Card>
        )}

        {/* STEP 3: TIMELINE & COMMERCIAL BASELINE */}
        {currentStageName === 'TIMELINE_COMMERCIAL' && (
          <Card className="p-6 space-y-5">
            <h3 className="text-base font-bold text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--color-accent-blue)]" />
              Jadwal Waktu & Baseline Komersial
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Tanggal Mulai Proyek <span className="text-rose-500">*</span>
                </label>
                <Input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Target Selesai Pekerjaan <span className="text-rose-500">*</span>
                </label>
                <Input 
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Estimasi Nilai Kontrak (IDR) <span className="text-rose-500">*</span>
                </label>
                <Input 
                  type="number"
                  min="0"
                  value={contractValue || ''}
                  onChange={(e) => setContractValue(normalizeMoney(e.target.value))}
                  placeholder="Rp 0"
                  className="font-mono font-bold"
                />
                <span className="text-[11px] text-[var(--color-text-tertiary)]">
                  Terbilang: {formatRupiah(contractValue)}
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Kebijakan PPN Faktur
                </label>
                <select
                  value={taxPolicy}
                  onChange={(e) => setTaxPolicy(e.target.value as any)}
                  className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm focus:ring-2 font-medium"
                >
                  <option value="PPN_11">PPN 11% (Standar UU HPP)</option>
                  <option value="PPN_12">PPN 12% (Kenaikan Tarif)</option>
                  <option value="NON_PPN">Non-PPN (Bebas Pajak / Perorangan)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Target Margin Profit Bersih (%)
                </label>
                <Input 
                  type="number"
                  min="0"
                  max="100"
                  value={targetProfitPercentage}
                  onChange={(e) => setTargetProfitPercentage(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] flex items-center gap-1.5">
                    <span>Alokasi Budget Operasional Awal (%)</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-[var(--color-accent-blue)] border border-blue-500/20">
                      Maks. 10%
                    </span>
                  </label>
                  {contractValue > 0 && (
                    <span className="text-[11px] font-mono text-[var(--color-text-secondary)]">
                      Pagu Maks. 10%: <strong className="text-[var(--color-text-primary)]">Rp {Math.round(contractValue * 0.1).toLocaleString('id-ID')}</strong>
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Input 
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={budgetOperationalPercent !== undefined ? budgetOperationalPercent : ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (isNaN(val)) {
                        setBudgetOperationalPercent(0);
                      } else {
                        setBudgetOperationalPercent(val);
                      }
                    }}
                    placeholder="0"
                    className={`font-mono text-sm font-semibold pr-8 ${budgetOperationalPercent > 10 ? 'border-rose-500 focus:ring-rose-500 text-rose-500' : ''}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-xs text-[var(--color-text-tertiary)] pointer-events-none">
                    %
                  </span>
                </div>

                {/* Quick Preset Percentage Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-[var(--color-text-tertiary)] mr-1">Preset:</span>
                  {[0, 2.5, 5, 7.5, 10].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setBudgetOperationalPercent(pct)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                        budgetOperationalPercent === pct
                          ? 'bg-[var(--color-accent-blue)] text-white border-transparent shadow-xs'
                          : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      {pct}% {pct === 10 ? '(Maks)' : ''}
                    </button>
                  ))}
                </div>

                {/* Exceeded Warning Alert */}
                {budgetOperationalPercent > 10 && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-between gap-2 text-xs text-rose-600 dark:text-rose-400">
                    <span>
                      ⚠️ Persentase melebihi batas maksimal 10% (Saat ini: {budgetOperationalPercent}%)
                    </span>
                    <button
                      type="button"
                      onClick={() => setBudgetOperationalPercent(10)}
                      className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[11px] shrink-0 cursor-pointer"
                    >
                      Setel ke 10%
                    </button>
                  </div>
                )}

                {/* Real-time Nominal Summary Card */}
                <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--color-border)] space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--color-text-secondary)]">Nominal Budget Operasional:</span>
                    <span className="font-mono font-bold text-[var(--color-accent-blue)] text-sm">
                      Rp {budgetOtherExpenses.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--color-text-tertiary)] truncate">
                    Terbilang: {formatRupiah(budgetOtherExpenses)}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* STEP 4: DRAWING SETUP */}
        {currentStageName === 'DRAWING_SETUP' && (
          <Card className="p-6 space-y-5">
            <h3 className="text-base font-bold text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[var(--color-accent-blue)]" />
              Struktur Lembar Gambar & Template
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div 
                onClick={() => setDrawingSetupMode('template')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  drawingSetupMode === 'template' 
                    ? 'bg-blue-500/10 border-blue-500/40 ring-2 ring-blue-500/20' 
                    : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)]">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  Gunakan Template Master
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  Menerapkan grup gambar dan daftar lembar kerja standar (Arsitektur, Struktur, MEP) secara instan.
                </p>
              </div>

              <div 
                onClick={() => setDrawingSetupMode('manual')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  drawingSetupMode === 'manual' 
                    ? 'bg-blue-500/10 border-blue-500/40 ring-2 ring-blue-500/20' 
                    : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)]">
                  <Plus className="w-4 h-4 text-emerald-500" />
                  Mulai Manual / Kosong
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  Susun daftar gambar kerja dari awal atau impor file Excel di langkah berikutnya.
                </p>
              </div>
            </div>

            {drawingSetupMode === 'template' && (
              <div className="space-y-4 pt-2">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Pilih Template Master Yang Sesuai:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {templates.map(tpl => {
                    const isSelected = selectedTemplateId === tpl.id;
                    const itemsCount = tpl.groups?.reduce((acc, g) => acc + (g.items?.length || 0), 0) || 0;
                    return (
                      <div 
                        key={tpl.id}
                        onClick={() => handleApplyTemplate(tpl.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30' 
                            : 'border-[var(--color-border)] hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--color-text-primary)]">{tpl.templateName}</span>
                          <Badge variant={isSelected ? 'success' : 'info'} className="text-[11px]">
                            {tpl.groups?.length || 0} Grup • {itemsCount} Gambar
                          </Badge>
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                          {tpl.description || 'Struktur gambar kerja AutoCAD standar.'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {drawingItems.length > 0 && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <span>Struktur gambar terdaftar: <strong>{drawingItems.length} lembar gambar</strong> siap di-review.</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Siap Lanjut</span>
              </div>
            )}
          </Card>
        )}

        {/* STEP 5: TEAM SETUP */}
        {currentStageName === 'TEAM_SETUP' && (
          <Card className="p-6 space-y-5">
            <h3 className="text-base font-bold text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--color-accent-blue)]" />
              Penetapan Project Leader & Tim Drafter
            </h3>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                <label className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  Project Leader (Mandatory / Penanggung Jawab Teknis) <span className="text-rose-500">*</span>
                </label>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                  Project Leader bertindak sebagai penanggung jawab utama gambar dan validasi teknis proyek.
                </p>
                <select
                  value={projectLeaderId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    setProjectLeaderId(selId);
                    const usr = availableUsers.find(u => u.uid === selId);
                    setProjectLeaderName(usr?.name || usr?.email || '');
                  }}
                  className="flex h-10 w-full rounded-lg border border-amber-300 dark:border-amber-800/60 bg-[var(--color-surface)] px-3 text-sm focus:ring-2 font-semibold"
                >
                  <option value="">-- Pilih Project Leader --</option>
                  {availableUsers.map(u => (
                    <option key={u.uid} value={u.uid}>
                      {u.name || u.email} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Anggota Tim Drafter & Engineer Lainnya:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 border border-[var(--color-border)] rounded-xl">
                  {availableUsers.filter(u => u.uid !== projectLeaderId).map(u => {
                    const isChecked = selectedMembers.includes(u.uid);
                    return (
                      <label 
                        key={u.uid}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                          isChecked 
                            ? 'bg-blue-500/10 border-blue-500/30 font-semibold text-blue-600 dark:text-blue-400' 
                            : 'border-[var(--color-border)] hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMembers([...selectedMembers, u.uid]);
                            } else {
                              setSelectedMembers(selectedMembers.filter(id => id !== u.uid));
                            }
                          }}
                          className="rounded border-[var(--color-border)] text-blue-600"
                        />
                        <span className="truncate">{u.name || u.email}</span>
                        <span className="text-[11px] text-[var(--color-text-tertiary)] ml-auto">({u.role})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* STEP 6: COMMERCIAL / QUOTATION */}
        {currentStageName === 'COMMERCIAL_SETUP' && (
          <Card className="p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
              <div>
                <h3 className="text-base font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[var(--color-accent-blue)]" />
                  RAB / Quotation Komersial Resmi
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  Deskripsi pekerjaan otomatis terisi sesuai bidang pekerjaan terpilih: <span className="font-semibold text-[var(--color-text-primary)]">{projectType || 'Arsitektur'}</span>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button 
                  type="button"
                  variant="secondary" 
                  size="sm" 
                  onClick={() => {
                    const synced = generateQuotationItemsFromProjectType(projectType, contractValue);
                    setQuotationItems(synced);
                    setHasUserEditedQuotation(false);
                    toast.success(`Deskripsi pekerjaan disinkronkan dengan bidang (${projectType || 'Arsitektur'}) & nilai kontrak.`);
                  }}
                  className="text-xs gap-1.5 h-8 bg-blue-500/10 hover:bg-blue-500/20 text-[var(--color-accent-blue)] border-blue-500/30 font-semibold"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Muat Ulang dari Bidang
                </Button>

                <Badge variant={quotationStatus === 'Approved' ? 'success' : 'info'} className="text-xs">
                  Status: {quotationStatus}
                </Badge>
                {quotationStatus !== 'Approved' && (
                  <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={() => {
                      setQuotationStatus('Approved');
                      toast.success("Quotation disetujui (Approved) untuk penerbitan termin & invoice.");
                    }}
                    className="text-xs h-8"
                  >
                    Setujui (Approve)
                  </Button>
                )}
              </div>
            </div>

            {/* Quotation Table */}
            <div className="space-y-3">
              <div className="overflow-x-auto border border-[var(--color-border)] rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/5 dark:bg-white/5 border-b border-[var(--color-border)] font-semibold">
                    <tr>
                      <th className="p-2.5">Deskripsi Pekerjaan</th>
                      <th className="p-2.5 w-20">Volume</th>
                      <th className="p-2.5 w-24">Satuan</th>
                      <th className="p-2.5 w-36">Harga Satuan (IDR)</th>
                      <th className="p-2.5 w-36 text-right">Total (IDR)</th>
                      <th className="p-2.5 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {quotationItems.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="p-2">
                          <input 
                            value={item.description}
                            onChange={(e) => {
                              const updated = [...quotationItems];
                              updated[idx].description = e.target.value;
                              setQuotationItems(updated);
                              setHasUserEditedQuotation(true);
                            }}
                            className="w-full p-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-medium"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const updated = [...quotationItems];
                              updated[idx].quantity = Math.max(1, Number(e.target.value));
                              setQuotationItems(updated);
                              setHasUserEditedQuotation(true);
                            }}
                            className="w-full p-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-center"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            value={item.unit}
                            onChange={(e) => {
                              const updated = [...quotationItems];
                              updated[idx].unit = e.target.value;
                              setQuotationItems(updated);
                              setHasUserEditedQuotation(true);
                            }}
                            className="w-full p-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="number"
                            min="0"
                            value={item.unitPrice || ''}
                            onChange={(e) => {
                              const updated = [...quotationItems];
                              updated[idx].unitPrice = normalizeMoney(e.target.value);
                              setQuotationItems(updated);
                              setHasUserEditedQuotation(true);
                            }}
                            className="w-full p-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-mono"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold">
                          {formatRupiah(item.quantity * item.unitPrice)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setQuotationItems(quotationItems.filter((_, i) => i !== idx));
                              setHasUserEditedQuotation(true);
                            }}
                            className="text-rose-500 hover:text-rose-700 cursor-pointer p-1"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Actions & Quick Add Disciplines */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setQuotationItems([
                        ...quotationItems,
                        { id: uuidv4(), description: 'Item Pekerjaan Tambahan', quantity: 1, unit: 'Paket', unitPrice: 0 }
                      ]);
                      setHasUserEditedQuotation(true);
                    }}
                    className="text-xs gap-1 h-7"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Item Manual
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] text-[var(--color-text-tertiary)] mr-1">Tambah Bidang:</span>
                  {[
                    { id: 'Arsitektur', label: '+ DED Arsitektur' },
                    { id: 'Struktur', label: '+ DED Struktur' },
                    { id: 'MEP', label: '+ DED MEP' },
                    { id: 'Interior', label: '+ Interior' },
                    { id: 'Masterplan', label: '+ Masterplan' },
                    { id: 'Infrastruktur', label: '+ Infrastruktur' },
                    { id: 'QS', label: '+ QS & RAB' },
                  ].map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setQuotationItems([
                          ...quotationItems,
                          { 
                            id: uuidv4(), 
                            description: DISCIPLINE_NAME_MAP[b.id] || `Jasa Pembuatan Gambar DED ${b.id}`, 
                            quantity: 1, 
                            unit: 'Paket', 
                            unitPrice: 0 
                          }
                        ]);
                        setHasUserEditedQuotation(true);
                      }}
                      className="px-2 py-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-black/5 dark:hover:bg-white/5 text-[10px] font-semibold text-[var(--color-text-secondary)] transition-all cursor-pointer"
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quotation Summary Card */}
            <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--color-border)] max-w-sm ml-auto space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Subtotal:</span>
                <span className="font-mono font-semibold">{formatRupiah(calculatedQuotation.subTotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--color-text-secondary)]">Diskon:</span>
                <input 
                  type="number"
                  min="0"
                  value={quotationDiscount || ''}
                  onChange={(e) => setQuotationDiscount(normalizeMoney(e.target.value))}
                  placeholder="0"
                  className="w-28 p-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] font-mono text-right text-xs"
                />
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Dasar Pengenaan Pajak (DPP):</span>
                <span className="font-mono font-semibold">{formatRupiah(calculatedQuotation.taxBase)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">PPN ({calculatedQuotation.taxPercentage}%):</span>
                <span className="font-mono font-semibold">{formatRupiah(calculatedQuotation.tax)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[var(--color-border)] text-sm font-bold text-[var(--color-accent-blue)]">
                <span>Grand Total:</span>
                <span className="font-mono">{formatRupiah(calculatedQuotation.grandTotal)}</span>
              </div>
            </div>
          </Card>
        )}

        {/* STEP 8: PAYMENT TERMS */}
        {currentStageName === 'FINANCIAL_SETUP' && (
          <Card className="p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
              <div>
                <h3 className="text-base font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-[var(--color-accent-blue)]" />
                  Termin Penagihan Klien (Payment Terms)
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  Aturan bisnis: Total seluruh persentase termin penagihan WAJIB tepat 100%.
                </p>
              </div>

              {(() => {
                const totalPct = financeTerms.reduce((acc, t) => acc + (t.percentageValue || 0), 0);
                const is100 = Math.abs(totalPct - 100) < 0.01;
                return (
                  <Badge variant={is100 ? 'success' : 'danger'} className="text-xs font-mono font-bold">
                    Total: {totalPct}% {is100 ? '(Valid 100%)' : `(Kurang ${100 - totalPct}%)`}
                  </Badge>
                );
              })()}
            </div>

            {/* Contract Value Reference Banner */}
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Total Nilai Kontrak Acuan:
                </span>
                <div className="text-base font-bold font-mono text-[var(--color-accent-blue)]">
                  {formatRupiah(effectiveContractValue)}
                </div>
              </div>
              <Badge variant="info" className="text-[11px] self-start sm:self-auto">
                {calculatedQuotation.grandTotal > 0 
                  ? 'Tersinkronisasi dari RAB / Quotation (Tahap 6)' 
                  : 'Estimasi Nilai Kontrak (Tahap 3)'}
              </Badge>
            </div>

            <div className="space-y-3">
              {financeTerms.map((term, idx) => (
                <div key={term.id} className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="w-6 h-6 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center font-bold font-mono">
                      {idx + 1}
                    </span>
                    <input 
                      value={term.termName}
                      onChange={(e) => {
                        const updated = [...financeTerms];
                        updated[idx].termName = e.target.value;
                        setFinanceTerms(updated);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] font-semibold flex-1"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <div className="flex items-center gap-1">
                      <input 
                        type="number"
                        min="0"
                        max="100"
                        value={term.percentageValue}
                        onChange={(e) => {
                          const updated = [...financeTerms];
                          updated[idx].percentageValue = Number(e.target.value);
                          setFinanceTerms(updated);
                        }}
                        className="w-16 px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] font-mono font-bold text-right"
                      />
                      <span className="font-bold">%</span>
                    </div>

                    <span className="font-mono font-semibold text-[var(--color-text-secondary)] min-w-[140px] text-right">
                      {formatRupiah((effectiveContractValue * (term.percentageValue || 0)) / 100)}
                    </span>

                    <button
                      type="button"
                      onClick={() => setFinanceTerms(financeTerms.filter((_, i) => i !== idx))}
                      className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                      title="Hapus Termin"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-[var(--color-border)]">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setFinanceTerms([
                      ...financeTerms,
                      {
                        id: uuidv4(),
                        projectId: activeProjectId || '',
                        termName: `Termin Tambahan ${financeTerms.length + 1}`,
                        triggerType: 'On Drawing Progress',
                        amountType: 'Percentage',
                        percentageValue: 0,
                        sortOrder: financeTerms.length + 1,
                        createdAt: '',
                        updatedAt: ''
                      }
                    ]);
                  }}
                  className="text-xs gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Termin Penagihan
                </Button>

                <div className="text-xs text-right font-mono">
                  <span className="text-[var(--color-text-secondary)] mr-2">Total Terjadwal:</span>
                  <span className="font-bold text-[var(--color-text-primary)]">
                    {formatRupiah(financeTerms.reduce((acc, t) => acc + ((effectiveContractValue * (t.percentageValue || 0)) / 100), 0))}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* STEP 9: VENDOR SETUP */}
        {currentStageName === 'VENDOR_SETUP' && (
          <Card className="p-6 space-y-5">
            <h3 className="text-base font-bold text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[var(--color-accent-blue)]" />
              Setup Vendor & Subkontraktor Outsource
            </h3>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--color-border)]">
                <input 
                  type="checkbox"
                  id="vendorToggle"
                  checked={hasVendor}
                  onChange={(e) => setHasVendor(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="vendorToggle" className="text-xs font-semibold cursor-pointer">
                  Proyek ini melibatkan Vendor / Drafter Outsource / Laboratorium Uji
                </label>
              </div>

              {hasVendor ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/10">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[var(--color-text-secondary)]">Nama Vendor / Subkon</label>
                    <Input 
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      placeholder="PT. Mitra Desain Struktur"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[var(--color-text-secondary)]">Nilai Kontrak Vendor (IDR)</label>
                    <Input 
                      type="number"
                      min="0"
                      value={vendorContractValue || ''}
                      onChange={(e) => setVendorContractValue(normalizeMoney(e.target.value))}
                      placeholder="Rp 0"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-semibold text-[var(--color-text-secondary)]">Ruang Lingkup Outsource</label>
                    <Input 
                      value={vendorScope}
                      onChange={(e) => setVendorScope(e.target.value)}
                      placeholder="Contoh: Perhitungan analisis beban gempa ETABS & DED Struktur"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                  Seluruh pekerjaan gambar dan engineering ditangani langsung oleh Tim Internal MDrawing.
                </div>
              )}
            </div>
          </Card>
        )}

        {/* STEP 10: PRE-FLIGHT CHECK & ACTIVATION */}
        {currentStageName === 'PRE_FLIGHT' && (
          <div className="space-y-6">
            <Card className="p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                <div>
                  <h3 className="text-base font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    Pre-Flight Inspection Gate (Verifikasi Kelayakan)
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    Sistem secara server-authoritative memeriksa seluruh prasyarat proyek sebelum aktivasi resmi.
                  </p>
                </div>
                <Badge variant={preFlightResult.isReady ? 'success' : 'danger'} className="text-xs font-bold px-3 py-1">
                  {preFlightResult.isReady ? 'STATUS: READY TO ACTIVATE' : 'STATUS: BLOCKED'}
                </Badge>
              </div>

              {/* CHECKLIST ITEMS */}
              <div className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-xl overflow-hidden text-xs">
                {preFlightResult.items.map((item) => (
                  <div key={item.id} className="p-3.5 flex items-center justify-between gap-3 bg-[var(--color-surface)]">
                    <div className="flex items-center gap-3">
                      {item.isReady ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                      )}
                      <div>
                        <span className={`font-semibold ${item.isReady ? 'text-[var(--color-text-primary)]' : 'text-rose-600 dark:text-rose-400'}`}>
                          {item.label}
                        </span>
                        {!item.isReady && item.reasonIfBlocked && (
                          <p className="text-[11px] text-rose-500/90 dark:text-rose-400/80 mt-0.5">
                            {item.reasonIfBlocked}
                          </p>
                        )}
                      </div>
                    </div>

                    {!item.isReady && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const idx = WIZARD_ORDERED_STAGES.indexOf(item.stageToJump);
                          if (idx >= 0) setCurrentStepIndex(idx);
                        }}
                        className="text-xs h-7 px-2.5 text-blue-600 dark:text-blue-400"
                      >
                        Perbaiki Data
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* SUMMARY CALLOUT */}
              {preFlightResult.isReady ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-xs flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">SELURUH VERIFIKASI LULUS!</span>
                    Proyek ini memenuhi standar kelayakan operasional. Klik tombol <strong>"Aktifkan Proyek Resmi"</strong> di bawah untuk membuka Project Command Center.
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">SISTEM TERKUNCI (GATE BLOCKED)</span>
                    Terdapat {preFlightResult.blockingReasons.length} item mandatory yang belum terpenuhi. Selesaikan perbaikan sebelum aktivasi.
                  </div>
                </div>
              )}
            </Card>

            {/* ACTIVATION BUTTON BAR */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Kembali
              </Button>
              <Button
                variant="primary"
                disabled={!preFlightResult.isReady || isSubmitting}
                onClick={handleActivateProject}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 shadow-md"
              >
                <ShieldCheck className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Mengaktifkan Proyek...' : 'Aktifkan Proyek Resmi (ACTIVE)'}
              </Button>
            </div>
          </div>
        )}

        {/* STEP FOOTER NAVIGATION (For Steps 1 to 9) */}
        {currentStageName !== 'PRE_FLIGHT' && (
          <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
            <Button
              variant="secondary"
              onClick={handleBack}
              disabled={currentStepIndex === 0 || isSubmitting}
              className="gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={handleNext}
                disabled={isSubmitting}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-6 font-semibold"
              >
                <span>Lanjutkan</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
