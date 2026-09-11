/**
 * MDrawing Zero-Trust Rules Evaluation Engine
 * Evaluates access decisions strictly against the logic implemented in firestore.rules and storage.rules.
 * Used for deterministic automated verification of the Dirty Dozen security attack scenarios.
 */

export interface AuthContext {
  uid?: string;
  token?: {
    role?: string;
    email?: string;
    [key: string]: any;
  };
}

export interface UserDocState {
  uid: string;
  role: string;
  isActive: boolean;
  canViewFinance?: boolean;
  canEditFinance?: boolean;
  canApproveFinance?: boolean;
  canViewVendorCost?: boolean;
  canViewVendorPayment?: boolean;
  canManageTransmittal?: boolean;
  assignedProjectIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface ProjectDocState {
  id: string;
  code?: string;
  name?: string;
  projectLeaderId?: string;
  projectLeaderEmail?: string;
  members?: string[];
  contractValue?: number;
  [key: string]: any;
}

export interface DatabaseState {
  users: Record<string, UserDocState>;
  projects: Record<string, ProjectDocState>;
  quotations?: Record<string, any>;
  invoices?: Record<string, any>;
  aiAuditLogs?: Record<string, any>;
  storageObjects?: Record<string, { path: string; projectId?: string; uploadedBy?: string }>;
}

export class RulesEvaluator {
  private db: DatabaseState;

  constructor(initialState: DatabaseState) {
    this.db = initialState;
  }

  public setDb(state: DatabaseState) {
    this.db = state;
  }

  // Helper implementations matching firestore.rules exactly
  public isSignedIn(auth: AuthContext | null): boolean {
    return auth != null && typeof auth.uid === 'string' && auth.uid.length > 0;
  }

  public getUserDoc(auth: AuthContext | null): UserDocState | null {
    if (!auth || !auth.uid) return null;
    return this.db.users[auth.uid] || null;
  }

  public hasOwnerCustomClaim(auth: AuthContext | null): boolean {
    if (!auth || auth?.token?.role !== 'OWNER') return false;
    // Database-First: user doc in Firestore must also confirm role is OWNER
    const userDoc = this.getUserDoc(auth);
    return userDoc?.role === 'OWNER';
  }

  public getPrincipalRole(auth: AuthContext | null): string {
    const userDoc = this.getUserDoc(auth);
    if (userDoc?.role) return userDoc.role;
    if (this.hasOwnerCustomClaim(auth)) return 'OWNER';
    return 'VIEWER';
  }

  public isPrincipalActive(auth: AuthContext | null): boolean {
    if (!this.isSignedIn(auth)) return false;
    const userDoc = this.getUserDoc(auth);
    // User doc must exist in Firestore and have isActive == true
    // Stale OWNER token does NOT bypass isActive: false (Phase 7 fix)
    return userDoc != null && userDoc.isActive === true;
  }

  public isOwnerOrAdmin(auth: AuthContext | null): boolean {
    const role = this.getPrincipalRole(auth);
    return role === 'OWNER' || role === 'ADMIN';
  }

  public canViewFinance(auth: AuthContext | null): boolean {
    if (this.hasOwnerCustomClaim(auth)) return true;
    const userDoc = this.getUserDoc(auth);
    if (userDoc?.canViewFinance === true) return true;
    const role = this.getPrincipalRole(auth);
    return role === 'OWNER' || role === 'ADMIN' || role === 'FINANCE';
  }

  public canEditFinance(auth: AuthContext | null): boolean {
    if (this.hasOwnerCustomClaim(auth)) return true;
    const userDoc = this.getUserDoc(auth);
    if (userDoc?.canEditFinance === true) return true;
    const role = this.getPrincipalRole(auth);
    return role === 'OWNER' || role === 'ADMIN' || role === 'FINANCE';
  }

  public isAssignedToProject(auth: AuthContext | null, projId: string): boolean {
    if (!projId || !this.isSignedIn(auth)) return false;
    const userDoc = this.getUserDoc(auth);
    if (userDoc?.assignedProjectIds?.includes(projId)) return true;

    const project = this.db.projects[projId];
    if (!project) return false;

    if (project.projectLeaderId && project.projectLeaderId === auth!.uid) return true;
    if (auth!.token?.email && project.projectLeaderEmail === auth!.token.email) return true;
    if (project.members && project.members.includes(auth!.uid!)) return true;
    if (auth!.token?.email && project.members && project.members.includes(auth!.token.email)) return true;

    return false;
  }

  public canAccessProjectForRead(auth: AuthContext | null, projId: string): boolean {
    return this.isOwnerOrAdmin(auth) || this.isAssignedToProject(auth, projId);
  }

  public canMutateProjectFinance(auth: AuthContext | null, projId: string): boolean {
    if (!projId || typeof projId !== 'string' || projId.trim() === '') return false;
    const projectExists = Boolean(this.db.projects[projId]);
    if (!projectExists) return false;
    return this.isOwnerOrAdmin(auth) || this.isAssignedToProject(auth, projId);
  }

  public canAccessProjectForWrite(auth: AuthContext | null, projId: string): boolean {
    return this.isOwnerOrAdmin(auth) || 
      (this.getPrincipalRole(auth) === 'PROJECT_LEADER' && this.isAssignedToProject(auth, projId));
  }

  // EVALUATIONS FOR SPECIFIC OPERATIONS

  // Projects
  public evaluateProjectRead(auth: AuthContext | null, projId: string): boolean {
    if (!this.isSignedIn(auth) || !this.isPrincipalActive(auth)) return false;
    return this.canAccessProjectForRead(auth, projId);
  }

  public evaluateProjectCreate(auth: AuthContext | null): boolean {
    if (!this.isSignedIn(auth) || !this.isPrincipalActive(auth)) return false;
    return this.isOwnerOrAdmin(auth);
  }

  public evaluateProjectWrite(auth: AuthContext | null, projId: string): boolean {
    if (!this.isSignedIn(auth) || !this.isPrincipalActive(auth)) return false;
    return this.canAccessProjectForWrite(auth, projId);
  }

  // Users
  public evaluateUserUpdate(
    auth: AuthContext | null, 
    targetUserId: string, 
    incomingData: Partial<UserDocState>, 
    existingData: UserDocState
  ): boolean {
    if (!this.isSignedIn(auth)) return false;
    
    // Self-update
    if (auth.uid === targetUserId) {
      // Self cannot change role or isActive!
      const forbiddenKeys = ['role', 'isActive', 'assignedProjectIds', 'canEditFinance', 'canViewFinance'];
      const attemptedKeys = Object.keys(incomingData).filter(k => (incomingData as any)[k] !== (existingData as any)[k]);
      for (const k of attemptedKeys) {
        if (forbiddenKeys.includes(k)) return false;
      }
      return true;
    }

    // Admin/Owner updating another user
    if (!this.isPrincipalActive(auth) || !this.isOwnerOrAdmin(auth)) return false;

    // Rule: ADMIN cannot appoint or modify an OWNER (only OWNER can touch OWNER role)
    const principalRole = this.getPrincipalRole(auth);
    if (principalRole === 'ADMIN') {
      if (existingData.role === 'OWNER' || incomingData.role === 'OWNER') {
        return false;
      }
    }

    return true;
  }

  // Finance: Invoices
  public evaluateInvoiceRead(auth: AuthContext | null, invoice: { projectId: string }): boolean {
    if (!this.isSignedIn(auth) || !this.isPrincipalActive(auth)) return false;
    if (!this.canViewFinance(auth)) return false;
    return this.canAccessProjectForRead(auth, invoice.projectId);
  }

  public evaluateInvoiceCreate(auth: AuthContext | null, incomingInvoice: { projectId?: string; grandTotal?: number }): boolean {
    if (!this.isSignedIn(auth) || !this.isPrincipalActive(auth)) return false;
    if (!this.canEditFinance(auth)) return false;
    if (!incomingInvoice.projectId || incomingInvoice.projectId.trim() === '') return false;
    return this.canMutateProjectFinance(auth, incomingInvoice.projectId);
  }

  public evaluateClientPaymentCreate(auth: AuthContext | null, incomingPayment: { projectId?: string; amount?: number }): boolean {
    if (!this.isSignedIn(auth) || !this.isPrincipalActive(auth)) return false;
    if (!this.canEditFinance(auth)) return false;
    if (!incomingPayment.projectId || incomingPayment.projectId.trim() === '') return false;
    return this.canMutateProjectFinance(auth, incomingPayment.projectId);
  }

  public evaluateVendorBillCreate(auth: AuthContext | null, incomingBill: { projectId?: string; amount?: number }): boolean {
    if (!this.isSignedIn(auth) || !this.isPrincipalActive(auth)) return false;
    if (!this.canEditFinance(auth)) return false;
    if (!incomingBill.projectId || incomingBill.projectId.trim() === '') return false;
    return this.canMutateProjectFinance(auth, incomingBill.projectId);
  }

  public evaluateVendorPaymentCreate(auth: AuthContext | null, incomingPayment: { projectId?: string; amount?: number }): boolean {
    if (!this.isSignedIn(auth) || !this.isPrincipalActive(auth)) return false;
    if (!this.canEditFinance(auth)) return false;
    if (!incomingPayment.projectId || incomingPayment.projectId.trim() === '') return false;
    return this.canMutateProjectFinance(auth, incomingPayment.projectId);
  }

  public evaluateExpenseCreate(auth: AuthContext | null, incomingExpense: { projectId?: string; amount?: number }): boolean {
    if (!this.isSignedIn(auth) || !this.isPrincipalActive(auth)) return false;
    if (!this.canEditFinance(auth)) return false;
    if (!incomingExpense.projectId || incomingExpense.projectId.trim() === '') return false;
    return this.canMutateProjectFinance(auth, incomingExpense.projectId);
  }

  public evaluateCashflowCreate(auth: AuthContext | null, incomingCashflow: { projectId?: string; amount?: number }): boolean {
    if (!this.isSignedIn(auth) || !this.isPrincipalActive(auth)) return false;
    if (!this.canEditFinance(auth)) return false;
    if (!incomingCashflow.projectId || incomingCashflow.projectId.trim() === '') return false;
    return this.canMutateProjectFinance(auth, incomingCashflow.projectId);
  }

  public evaluateFinancialProjectIdUpdate(
    auth: AuthContext | null,
    existingProjectId: string,
    newProjectId: string
  ): boolean {
    if (!this.isSignedIn(auth) || !this.isPrincipalActive(auth)) return false;
    if (!this.canEditFinance(auth)) return false;
    // Project ID is immutable on all financial records!
    if (existingProjectId !== newProjectId) return false;
    return this.canMutateProjectFinance(auth, existingProjectId);
  }

  public evaluateUserDocUpdate(
    auth: AuthContext | null,
    targetUserId: string,
    incomingData: Partial<UserDocState>
  ): boolean {
    const existing = this.db.users[targetUserId] || {
      uid: targetUserId,
      role: 'VIEWER',
      isActive: false,
    };
    return this.evaluateUserUpdate(auth, targetUserId, incomingData, existing);
  }

  public evaluateUserDocDelete(auth: AuthContext | null, targetUserId: string): boolean {
    if (!this.isSignedIn(auth) || !this.isPrincipalActive(auth)) return false;
    const target = this.db.users[targetUserId];
    if (!target) return false;
    // Security Rule SEC-05: OWNER cannot be deleted by ADMIN or anyone
    if (target.role === 'OWNER') return false;
    return this.isOwnerOrAdmin(auth);
  }

  public evaluateFinancialRead(auth: AuthContext | null, projId: string): boolean {
    if (!this.isSignedIn(auth) || !this.isPrincipalActive(auth)) return false;
    if (!this.canViewFinance(auth)) return false;
    return this.canAccessProjectForRead(auth, projId);
  }

  public evaluateFinancialWrite(auth: AuthContext | null, projId: string): boolean {
    if (!this.isSignedIn(auth) || !this.isPrincipalActive(auth)) return false;
    if (!this.canEditFinance(auth)) return false;
    return this.canMutateProjectFinance(auth, projId);
  }

  public evaluateDrawingRead(auth: AuthContext | null, projId: string): boolean {
    if (!this.isSignedIn(auth) || !this.isPrincipalActive(auth)) return false;
    return this.canAccessProjectForRead(auth, projId);
  }

  public evaluateStorageUpload(auth: AuthContext | null, storagePath: string): boolean {
    if (!this.isSignedIn(auth) || !this.isPrincipalActive(auth)) return false;
    // Format: projects/{projectId}/...
    const parts = storagePath.split('/');
    if (parts[0] === 'projects' && parts[1]) {
      return this.canAccessProjectForWrite(auth, parts[1]);
    }
    return this.isOwnerOrAdmin(auth);
  }

  public evaluateAiAuditLogWrite(auth: AuthContext | null, logId: string): boolean {
    // Audit logs are append-only via backend service; client modification/deletion is strictly denied
    return this.evaluateAuditLogUpdateOrDelete();
  }

  // System: AI Audit Logs
  public evaluateAuditLogUpdateOrDelete(): boolean {
    // Immutable audit trail: allow update, delete: if false;
    return false;
  }

  public evaluateAuditLogCreate(auth: AuthContext | null, incomingLog: { actorUid: string }): boolean {
    if (!this.isSignedIn(auth) || !this.isPrincipalActive(auth)) return false;
    return incomingLog.actorUid === auth.uid;
  }

  // Storage Objects
  public evaluateStorageRead(auth: AuthContext | null, storagePath: string, projectId: string): boolean {
    if (!this.isSignedIn(auth) || !this.isPrincipalActive(auth)) return false;
    return this.canAccessProjectForRead(auth, projectId);
  }

  public evaluateStorageWrite(auth: AuthContext | null, storagePath: string, projectId: string): boolean {
    if (!this.isSignedIn(auth) || !this.isPrincipalActive(auth)) return false;
    return this.canAccessProjectForWrite(auth, projectId);
  }
}
