import { useAuth } from "../context/AuthContext";
import { 
  Capability, 
  hasCapability, 
  canManageUsers, 
  canManageProjects, 
  canManageTransmittal, 
  canAccessProject, 
  canReadProjectData,
  canWriteProjectData,
  canDeleteProjectData,
  canApproveFinancialMutation,
  canVoidFinancialMutation,
  isCompanyWideFinanceRole,
  getAllowedFinanceProjectIds
} from "../security/authorization";

export function usePermissions() {
  const { appUser } = useAuth();

  const canViewFinance = () => hasCapability(appUser, "canViewFinance");
  const canManageFinance = () => hasCapability(appUser, "canEditFinance");
  const canViewVendorCost = () => hasCapability(appUser, "canViewVendorCost");
  const canViewVendorPayment = () => hasCapability(appUser, "canViewVendorPayment");
  const canExportFinanceReport = () => hasCapability(appUser, "canExportFinanceReport");
  const canVoidFinanceTransaction = (projectId?: string) => canVoidFinancialMutation(appUser, projectId);
  const canEditPaidTransaction = () => hasCapability(appUser, "canEditPaidTransaction");
  const canApproveFinance = (projectId?: string) => canApproveFinancialMutation(appUser, projectId);
  const canViewProfit = () => hasCapability(appUser, "canViewProfit");
  const isCompanyWideFinance = () => isCompanyWideFinanceRole(appUser);
  const isOwner = () => appUser?.role === "OWNER";
  const canManageTransmittalPermission = () => canManageTransmittal(appUser);

  return {
    hasCapability: (cap: Capability) => hasCapability(appUser, cap),
    canManageUsers: () => canManageUsers(appUser),
    canManageProjects: () => canManageProjects(appUser),
    canManageTransmittal: canManageTransmittalPermission,
    canAccessProject: (projectId: string) => canAccessProject(appUser, projectId),
    canReadProjectData: (projectId: string) => canReadProjectData(appUser, projectId),
    canWriteProjectData: (projectId: string) => canWriteProjectData(appUser, projectId),
    canDeleteProjectData: (projectId: string) => canDeleteProjectData(appUser, projectId),
    canViewFinance,
    canManageFinance,
    canEditFinance: canManageFinance,
    canViewProfit,
    isOwner,
    isCompanyWideFinance,
    canViewVendorCost,
    canViewVendorPayment,
    canExportFinanceReport,
    canVoidFinanceTransaction,
    canEditPaidTransaction,
    canApproveFinance,
    getAllowedFinanceProjectIds: (allProjects: { id: string }[]) => getAllowedFinanceProjectIds(appUser, allProjects),
    role: appUser?.role,
    isActive: appUser?.isActive ?? false,
    appUser,
    currentUser: appUser
  };
}

